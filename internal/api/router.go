package api

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"cramersmith.net/internal/auth"
	"cramersmith.net/internal/bluesky"
	"cramersmith.net/internal/store"
)

// rateLimiter tracks failed auth attempts per IP and blocks after 10 failures in 15 minutes.
type rateLimiter struct {
	mu   sync.Mutex
	hits map[string][]time.Time
}

func newRateLimiter() *rateLimiter {
	return &rateLimiter{hits: make(map[string][]time.Time)}
}

// clientIP extracts the real client IP from X-Forwarded-For (set by App Runner's
// load balancer), falling back to RemoteAddr when the header is absent.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// X-Forwarded-For may be a comma-separated list; the leftmost is the client.
		if idx := strings.Index(xff, ","); idx >= 0 {
			return strings.TrimSpace(xff[:idx])
		}
		return strings.TrimSpace(xff)
	}
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

// blocked reports whether ip has 10+ recent auth failures. It prunes stale
// entries but does NOT record a new hit — call record() after a failed response.
func (rl *rateLimiter) blocked(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	cutoff := time.Now().Add(-15 * time.Minute)
	var recent []time.Time
	for _, t := range rl.hits[ip] {
		if t.After(cutoff) {
			recent = append(recent, t)
		}
	}
	if len(recent) == 0 {
		delete(rl.hits, ip) // evict empty entries to prevent memory leak
	} else {
		rl.hits[ip] = recent
	}
	return len(recent) >= 10
}

// record adds one auth-failure hit for ip.
func (rl *rateLimiter) record(ip string) {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	rl.hits[ip] = append(rl.hits[ip], time.Now())
}

// statusRecorder wraps ResponseWriter to capture the HTTP status code written
// by the inner handler, so the rate limiter can inspect it after the fact.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (sr *statusRecorder) WriteHeader(code int) {
	sr.status = code
	sr.ResponseWriter.WriteHeader(code)
}

// NewRouter returns a mux with all API routes registered.
// s3Client and bucket may be nil/"" — image uploads are disabled if so.
func NewRouter(st *store.Store, a *auth.Auth, bsky *bluesky.Client, s3Client *s3.Client, bucket string) http.Handler {
	mux := http.NewServeMux()
	rl := newRateLimiter()

	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("GET /visits", handleVisits(st))
	mux.Handle("GET /referral-links", rl.Middleware(a.Middleware(http.HandlerFunc(handleListReferralLinks(st)))))
	mux.Handle("POST /referral-links", rl.Middleware(a.Middleware(http.HandlerFunc(handleCreateReferralLink(st)))))
	mux.HandleFunc("GET /posts", handleListPosts(st, a))
	mux.HandleFunc("GET /posts/slug/{slug}", handleGetPostBySlug(st))
	mux.Handle("POST /posts", rl.Middleware(a.Middleware(http.HandlerFunc(handleCreatePost(st, bsky)))))
	mux.Handle("POST /posts/{id}/publish", rl.Middleware(a.Middleware(http.HandlerFunc(handlePublishPost(st)))))
	mux.Handle("DELETE /posts/{id}", rl.Middleware(a.Middleware(http.HandlerFunc(handleDeletePost(st)))))
	mux.Handle("POST /upload", rl.Middleware(a.Middleware(http.HandlerFunc(handleUploadImage(s3Client, bucket)))))
	mux.HandleFunc("GET /dice-rolls", handleListDiceRolls(st))
	mux.Handle("POST /dice-rolls", rl.Middleware(a.Middleware(http.HandlerFunc(handleSaveDiceRoll(st)))))

	return securityHeaders(mux)
}

func (rl *rateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := clientIP(r)
		if rl.blocked(ip) {
			http.Error(w, "too many requests", http.StatusTooManyRequests)
			return
		}
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		if rec.status == http.StatusUnauthorized || rec.status == http.StatusForbidden {
			rl.record(ip)
		}
	})
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		next.ServeHTTP(w, r)
	})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func handleVisits(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		count, err := s.IncrementAndGetVisits(r.Context())
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if ref := r.URL.Query().Get("ref"); ref != "" {
			// Fire-and-forget; unknown tokens are silently ignored by the query.
			_ = s.IncrementReferralLink(r.Context(), ref)
		}
		writeJSON(w, http.StatusOK, map[string]int64{"count": count})
	}
}

func handleListReferralLinks(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		links, err := s.ListReferralLinks(r.Context())
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if links == nil {
			links = []store.ReferralLink{}
		}
		writeJSON(w, http.StatusOK, links)
	}
}

func handleCreateReferralLink(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Label string `json:"label"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Label == "" {
			http.Error(w, "label is required", http.StatusBadRequest)
			return
		}
		h := sha256.Sum256([]byte(body.Label))
		token := fmt.Sprintf("%x", h)[:12]
		link, err := s.CreateReferralLink(r.Context(), token, body.Label)
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, link)
	}
}

func handleListPosts(s *store.Store, a *auth.Auth) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var tag *string
		if t := r.URL.Query().Get("tag"); t != "" {
			tag = &t
		}

		// include_drafts=true requires a valid auth token — admin only.
		var posts []store.Post
		var err error
		if r.URL.Query().Get("include_drafts") == "true" {
			if !a.Valid(r) {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			posts, err = s.ListAllPosts(r.Context())
		} else {
			posts, err = s.ListPosts(r.Context(), tag)
		}

		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if posts == nil {
			posts = []store.Post{}
		}
		writeJSON(w, http.StatusOK, posts)
	}
}

var (
	slugRe    = regexp.MustCompile(`[^a-z0-9]+`)
	mdHeading = regexp.MustCompile(`#{1,6}\s+`)
	mdBold    = regexp.MustCompile(`\*\*(.+?)\*\*`)
	mdItalic  = regexp.MustCompile(`\*(.+?)\*`)
	mdCode    = regexp.MustCompile("`[^`]+`")
	mdImage   = regexp.MustCompile(`!\[.*?\]\(.*?\)`)
	mdLink    = regexp.MustCompile(`\[(.+?)\]\(.*?\)`)
)

func slugify(s string) string {
	s = strings.ToLower(s)
	s = slugRe.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}

func handleGetPostBySlug(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slug := r.PathValue("slug")
		post, err := s.GetPostBySlug(r.Context(), slug)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				http.Error(w, "not found", http.StatusNotFound)
				return
			}
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, post)
	}
}

func handleCreatePost(s *store.Store, bsky *bluesky.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Type          string   `json:"type"`
			Title         *string  `json:"title"`
			Slug          *string  `json:"slug"`
			Content       string   `json:"content"`
			URL           *string  `json:"url"`
			URLTitle      *string  `json:"url_title"`
			ImageURL      *string  `json:"image_url"`
			Tags          []string `json:"tags"`
			Draft         bool     `json:"draft"`
			PostToBluesky bool     `json:"post_to_bluesky"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		if body.Type != "thought" && body.Type != "link" && body.Type != "blog" {
			http.Error(w, "type must be 'thought', 'link', or 'blog'", http.StatusBadRequest)
			return
		}
		if body.Type == "thought" && body.Content == "" {
			http.Error(w, "content is required for thoughts", http.StatusBadRequest)
			return
		}
		if body.Type == "blog" && (body.Title == nil || *body.Title == "") {
			http.Error(w, "title is required for blog posts", http.StatusBadRequest)
			return
		}

		// Auto-generate slug from title if not provided.
		if body.Type == "blog" && (body.Slug == nil || *body.Slug == "") {
			s := slugify(*body.Title)
			body.Slug = &s
		}

		post, err := s.CreatePost(r.Context(), body.Type, body.Title, body.Slug, body.Content, body.URL, body.URLTitle, body.ImageURL, body.Tags, body.Draft)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				http.Error(w, "a post with that slug already exists", http.StatusConflict)
				return
			}
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		if !body.Draft && body.PostToBluesky && bsky != nil {
			text := body.Content
			if body.Type == "link" && body.URL != nil {
				text = fmt.Sprintf("%s\n\n%s", body.Content, *body.URL)
				if body.Content == "" {
					text = *body.URL
				}
			}
			if err := bsky.Post(r.Context(), text); err != nil {
				log.Printf("bluesky post failed: %v", err)
			}
		}

		writeJSON(w, http.StatusCreated, post)
	}
}

// handleUploadImage accepts a multipart image upload, stores it in S3, and returns the public URL.
func handleUploadImage(s3Client *s3.Client, bucket string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s3Client == nil || bucket == "" {
			http.Error(w, "image uploads not configured", http.StatusServiceUnavailable)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, 10<<20) // 10 MB limit
		if err := r.ParseMultipartForm(10 << 20); err != nil {
			http.Error(w, "file too large (max 10 MB)", http.StatusBadRequest)
			return
		}

		file, header, err := r.FormFile("image")
		if err != nil {
			http.Error(w, "image field required", http.StatusBadRequest)
			return
		}
		defer file.Close()

		ext := strings.ToLower(filepath.Ext(header.Filename))
		allowed := map[string]string{
			".jpg":  "image/jpeg",
			".jpeg": "image/jpeg",
			".png":  "image/png",
			".gif":  "image/gif",
			".webp": "image/webp",
			".avif": "image/avif",
		}
		contentType, ok := allowed[ext]
		if !ok {
			http.Error(w, "unsupported file type; allowed: jpg, png, gif, webp, avif", http.StatusBadRequest)
			return
		}

		var buf [16]byte
		if _, err := rand.Read(buf[:]); err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		key := fmt.Sprintf("posts/%x%s", buf, ext)

		_, err = s3Client.PutObject(r.Context(), &s3.PutObjectInput{
			Bucket:        aws.String(bucket),
			Key:           aws.String(key),
			Body:          file,
			ContentType:   aws.String(contentType),
			ContentLength: aws.Int64(header.Size),
		})
		if err != nil {
			log.Printf("s3 upload failed: %v", err)
			http.Error(w, "upload failed", http.StatusInternalServerError)
			return
		}

		imageURL := fmt.Sprintf("https://%s.s3.us-west-2.amazonaws.com/%s", bucket, key)
		writeJSON(w, http.StatusOK, map[string]string{"url": imageURL})
	}
}

func handlePublishPost(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(r.PathValue("id"))
		if err != nil {
			http.Error(w, "invalid id", http.StatusBadRequest)
			return
		}
		post, err := s.PublishPost(r.Context(), id)
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, post)
	}
}

func handleDeletePost(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(r.PathValue("id"))
		if err != nil {
			http.Error(w, "invalid id", http.StatusBadRequest)
			return
		}
		if err := s.DeletePost(r.Context(), id); err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func handleListDiceRolls(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rolls, err := s.ListDiceRolls(r.Context())
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if rolls == nil {
			rolls = []store.DiceRoll{}
		}
		writeJSON(w, http.StatusOK, rolls)
	}
}

func handleSaveDiceRoll(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			RollType  string  `json:"roll_type"`
			DiceCount int     `json:"dice_count"`
			DieSize   int     `json:"die_size"`
			Modifier  int     `json:"modifier"`
			Rolls     []int32 `json:"rolls"`
			Total     int     `json:"total"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		if body.RollType == "" {
			body.RollType = "general"
		}
		if body.DiceCount < 1 || body.DieSize < 1 || len(body.Rolls) == 0 {
			http.Error(w, "invalid roll", http.StatusBadRequest)
			return
		}
		roll, err := s.SaveDiceRoll(r.Context(), body.RollType, body.DiceCount, body.DieSize, body.Modifier, body.Rolls, body.Total)
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, roll)
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// HandleRSSFeed returns an RSS 2.0 feed of published blog posts.
// Registered at /rss.xml (root level, not under /api/).
func HandleRSSFeed(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		posts, err := s.ListPosts(r.Context(), nil)
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/rss+xml; charset=utf-8")
		fmt.Fprint(w, xml.Header)
		fmt.Fprint(w, `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Cramer Smith</title>
    <link>https://cramersmith.net</link>
    <description>Software engineer. Thoughts, links, and writing.</description>
    <atom:link href="https://cramersmith.net/rss.xml" rel="self" type="application/rss+xml"/>
    <language>en-us</language>
`)
		for _, p := range posts {
			if p.Type != "blog" || p.Title == nil || p.Slug == nil || p.PublishedAt == nil {
				continue
			}
			link := "https://cramersmith.net/blog/" + *p.Slug
			fmt.Fprintf(w, "    <item>\n")
			fmt.Fprintf(w, "      <title>%s</title>\n", rssEscape(*p.Title))
			fmt.Fprintf(w, "      <link>%s</link>\n", link)
			fmt.Fprintf(w, "      <guid isPermaLink=\"true\">%s</guid>\n", link)
			fmt.Fprintf(w, "      <description><![CDATA[%s]]></description>\n", rssExcerpt(p.Content))
			fmt.Fprintf(w, "      <pubDate>%s</pubDate>\n", p.PublishedAt.UTC().Format(time.RFC1123Z))
			fmt.Fprintf(w, "    </item>\n")
		}
		fmt.Fprint(w, "  </channel>\n</rss>")
	}
}

// rssExcerpt strips markdown and truncates content to ~200 chars for feed descriptions.
func rssExcerpt(content string) string {
	s := mdHeading.ReplaceAllString(content, "")
	s = mdBold.ReplaceAllString(s, "$1")
	s = mdItalic.ReplaceAllString(s, "$1")
	s = mdCode.ReplaceAllString(s, "")
	s = mdImage.ReplaceAllString(s, "")
	s = mdLink.ReplaceAllString(s, "$1")
	s = strings.ReplaceAll(s, "\n", " ")
	s = strings.TrimSpace(s)
	if len(s) <= 200 {
		return s
	}
	cut := s[:200]
	if idx := strings.LastIndex(cut, " "); idx > 0 {
		cut = cut[:idx]
	}
	return cut + "…"
}

// rssEscape XML-escapes a string for use in RSS element text content.
func rssEscape(s string) string {
	var b strings.Builder
	xml.EscapeText(&b, []byte(s))
	return b.String()
}
