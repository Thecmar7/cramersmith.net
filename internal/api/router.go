package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"cramersmith.net/internal/auth"
	"cramersmith.net/internal/bluesky"
	"cramersmith.net/internal/store"
)

// rateLimiter tracks failed auth attempts per IP and blocks after 10 failures in 15 minutes.
type rateLimiter struct {
	mu      sync.Mutex
	hits    map[string][]time.Time
}

func newRateLimiter() *rateLimiter {
	return &rateLimiter{hits: make(map[string][]time.Time)}
}

func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	cutoff := time.Now().Add(-15 * time.Minute)
	var recent []time.Time
	for _, t := range rl.hits[ip] {
		if t.After(cutoff) {
			recent = append(recent, t)
		}
	}
	rl.hits[ip] = recent

	if len(recent) >= 10 {
		return false
	}
	rl.hits[ip] = append(rl.hits[ip], time.Now())
	return true
}

// NewRouter returns a mux with all API routes registered.
func NewRouter(s *store.Store, a *auth.Auth, bsky *bluesky.Client) http.Handler {
	mux := http.NewServeMux()
	rl := newRateLimiter()

	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("GET /visits", handleVisits(s))
	mux.HandleFunc("GET /posts", handleListPosts(s))
	mux.Handle("POST /posts", rl.Middleware(a.Middleware(http.HandlerFunc(handleCreatePost(s, bsky)))))
	mux.Handle("DELETE /posts/{id}", rl.Middleware(a.Middleware(http.HandlerFunc(handleDeletePost(s)))))
	mux.HandleFunc("GET /dice-rolls", handleListDiceRolls(s))
	mux.Handle("POST /dice-rolls", rl.Middleware(a.Middleware(http.HandlerFunc(handleSaveDiceRoll(s)))))

	return securityHeaders(mux)
}

func (rl *rateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := r.RemoteAddr
		if !rl.allow(ip) {
			http.Error(w, "too many requests", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
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
		writeJSON(w, http.StatusOK, map[string]int64{"count": count})
	}
}

func handleListPosts(s *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		posts, err := s.ListPosts(r.Context())
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

func handleCreatePost(s *store.Store, bsky *bluesky.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Type          string  `json:"type"`
			Content       string  `json:"content"`
			URL           *string `json:"url"`
			URLTitle      *string `json:"url_title"`
			PostToBluesky bool    `json:"post_to_bluesky"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		if body.Type != "thought" && body.Type != "link" {
			http.Error(w, "type must be 'thought' or 'link'", http.StatusBadRequest)
			return
		}
		if body.Content == "" {
			http.Error(w, "content is required", http.StatusBadRequest)
			return
		}
		post, err := s.CreatePost(r.Context(), body.Type, body.Content, body.URL, body.URLTitle)
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		if body.PostToBluesky && bsky != nil {
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
