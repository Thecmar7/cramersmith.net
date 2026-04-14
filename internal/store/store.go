package store

import (
	"context"
	"io/fs"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Post mirrors the posts table.
type Post struct {
	ID          int        `json:"id"`
	Type        string     `json:"type"`
	Title       *string    `json:"title"`
	Slug        *string    `json:"slug"`
	Content     string     `json:"content"`
	URL         *string    `json:"url"`
	URLTitle    *string    `json:"url_title"`
	ImageURL    *string    `json:"image_url"`
	Tags        []string   `json:"tags"`
	Draft       bool       `json:"draft"`
	PublishedAt *time.Time `json:"published_at"`
	CreatedAt   time.Time  `json:"created_at"`
}

// DiceRoll mirrors the dice_rolls table.
type DiceRoll struct {
	ID        int       `json:"id"`
	RollType  string    `json:"roll_type"`
	DiceCount int       `json:"dice_count"`
	DieSize   int       `json:"die_size"`
	Modifier  int       `json:"modifier"`
	Rolls     []int32   `json:"rolls"`
	Total     int       `json:"total"`
	CreatedAt time.Time `json:"created_at"`
}

// Store holds the DB pool and pre-loaded query strings.
type Store struct {
	db      *pgxpool.Pool
	queries map[string]string
}

// New connects to the database and loads SQL queries from the embedded FS.
func New(ctx context.Context, connStr string, dbFiles fs.FS) (*Store, error) {
	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, err
	}

	queries, err := loadQueries(dbFiles)
	if err != nil {
		return nil, err
	}

	return &Store{db: pool, queries: queries}, nil
}

// loadQueries reads all .sql files from db/queries/ and parses them into a
// map keyed by the -- name: header in each file.
func loadQueries(dbFiles fs.FS) (map[string]string, error) {
	result := map[string]string{}

	files, err := fs.ReadDir(dbFiles, "db/queries")
	if err != nil {
		return nil, err
	}

	for _, f := range files {
		if !strings.HasSuffix(f.Name(), ".sql") {
			continue
		}
		b, err := fs.ReadFile(dbFiles, "db/queries/"+f.Name())
		if err != nil {
			return nil, err
		}
		parseNamedQueries(string(b), result)
	}

	return result, nil
}

// parseNamedQueries splits a SQL file on "-- name: QueryName" headers.
func parseNamedQueries(content string, out map[string]string) {
	var currentName string
	var lines []string

	flush := func() {
		if currentName != "" {
			q := strings.TrimSpace(strings.Join(lines, "\n"))
			// Strip only trailing comment-only lines so that inline SQL comments
			// (e.g. "-- filter by tag") are preserved where they appear.
			splitLines := strings.Split(q, "\n")
			last := -1
			for i, l := range splitLines {
				if !strings.HasPrefix(strings.TrimSpace(l), "--") {
					last = i
				}
			}
			if last >= 0 {
				out[currentName] = strings.TrimSpace(strings.Join(splitLines[:last+1], "\n"))
			}
		}
	}

	for _, line := range strings.Split(content, "\n") {
		if strings.HasPrefix(line, "-- name:") {
			flush()
			currentName = strings.TrimSpace(strings.TrimPrefix(line, "-- name:"))
			lines = nil
		} else {
			lines = append(lines, line)
		}
	}
	flush()
}

// query returns a SQL string by name, panicking if missing (programming error).
func (s *Store) query(name string) string {
	q, ok := s.queries[name]
	if !ok {
		panic("store: unknown query: " + name)
	}
	return q
}

func scanPost(row interface{ Scan(...any) error }) (Post, error) {
	var p Post
	if err := row.Scan(&p.ID, &p.Type, &p.Title, &p.Slug, &p.Content, &p.URL, &p.URLTitle, &p.ImageURL, &p.Tags, &p.Draft, &p.PublishedAt, &p.CreatedAt); err != nil {
		return Post{}, err
	}
	if p.Tags == nil {
		p.Tags = []string{}
	}
	return p, nil
}

// ListPosts returns published posts newest-first. Pass a non-nil tag to filter by tag.
func (s *Store) ListPosts(ctx context.Context, tag *string) ([]Post, error) {
	rows, err := s.db.Query(ctx, s.query("ListPosts"), tag)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []Post
	for rows.Next() {
		p, err := scanPost(rows)
		if err != nil {
			return nil, err
		}
		posts = append(posts, p)
	}
	return posts, rows.Err()
}

// ListAllPosts returns all posts including drafts (admin only).
func (s *Store) ListAllPosts(ctx context.Context) ([]Post, error) {
	rows, err := s.db.Query(ctx, s.query("ListAllPosts"))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []Post
	for rows.Next() {
		p, err := scanPost(rows)
		if err != nil {
			return nil, err
		}
		posts = append(posts, p)
	}
	return posts, rows.Err()
}

// CreatePost inserts a new post and returns it.
// Set draft=true to save without publishing; draft=false publishes immediately.
func (s *Store) CreatePost(ctx context.Context, postType string, title, slug *string, content string, url, urlTitle, imageURL *string, tags []string, draft bool) (*Post, error) {
	if tags == nil {
		tags = []string{}
	}
	var publishedAt *time.Time
	if !draft {
		now := time.Now()
		publishedAt = &now
	}
	p, err := scanPost(s.db.QueryRow(ctx, s.query("CreatePost"), postType, title, slug, content, url, urlTitle, imageURL, tags, draft, publishedAt))
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// GetPostBySlug returns a single published post by slug.
func (s *Store) GetPostBySlug(ctx context.Context, slug string) (*Post, error) {
	p, err := scanPost(s.db.QueryRow(ctx, s.query("GetPostBySlug"), slug))
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// PublishPost marks a draft as published and records the publish time.
func (s *Store) PublishPost(ctx context.Context, id int) (*Post, error) {
	p, err := scanPost(s.db.QueryRow(ctx, s.query("PublishPost"), id))
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// DeletePost removes a post by ID.
func (s *Store) DeletePost(ctx context.Context, id int) error {
	_, err := s.db.Exec(ctx, s.query("DeletePost"), id)
	return err
}

// ReferralLink mirrors the referral_links table.
type ReferralLink struct {
	Token     string    `json:"token"`
	Label     string    `json:"label"`
	Count     int64     `json:"count"`
	CreatedAt time.Time `json:"created_at"`
}

// CreateReferralLink inserts a new referral link and returns it.
// Returns nil, nil if the token already exists (ON CONFLICT DO NOTHING).
func (s *Store) CreateReferralLink(ctx context.Context, token, label string) (*ReferralLink, error) {
	var r ReferralLink
	err := s.db.QueryRow(ctx, s.query("CreateReferralLink"), token, label).
		Scan(&r.Token, &r.Label, &r.Count, &r.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// IncrementReferralLink increments the hit count for a token.
// Silently does nothing if the token doesn't exist.
func (s *Store) IncrementReferralLink(ctx context.Context, token string) error {
	_, err := s.db.Exec(ctx, s.query("IncrementReferralLink"), token)
	return err
}

// ListReferralLinks returns all referral links newest-first.
func (s *Store) ListReferralLinks(ctx context.Context) ([]ReferralLink, error) {
	rows, err := s.db.Query(ctx, s.query("ListReferralLinks"))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var links []ReferralLink
	for rows.Next() {
		var r ReferralLink
		if err := rows.Scan(&r.Token, &r.Label, &r.Count, &r.CreatedAt); err != nil {
			return nil, err
		}
		links = append(links, r)
	}
	return links, rows.Err()
}

// IncrementAndGetVisits atomically increments the counter and returns the new value.
func (s *Store) IncrementAndGetVisits(ctx context.Context) (int64, error) {
	var count int64
	err := s.db.QueryRow(ctx, s.query("IncrementAndGetVisits")).Scan(&count)
	return count, err
}

// SaveDiceRoll inserts a dice roll and returns it.
func (s *Store) SaveDiceRoll(ctx context.Context, rollType string, diceCount, dieSize, modifier int, rolls []int32, total int) (*DiceRoll, error) {
	var r DiceRoll
	err := s.db.QueryRow(ctx, s.query("SaveDiceRoll"), rollType, diceCount, dieSize, modifier, rolls, total).
		Scan(&r.ID, &r.RollType, &r.DiceCount, &r.DieSize, &r.Modifier, &r.Rolls, &r.Total, &r.CreatedAt)
	return &r, err
}

// ListDiceRolls returns the 50 most recent dice rolls.
func (s *Store) ListDiceRolls(ctx context.Context) ([]DiceRoll, error) {
	rows, err := s.db.Query(ctx, s.query("ListDiceRolls"))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rolls []DiceRoll
	for rows.Next() {
		var r DiceRoll
		if err := rows.Scan(&r.ID, &r.RollType, &r.DiceCount, &r.DieSize, &r.Modifier, &r.Rolls, &r.Total, &r.CreatedAt); err != nil {
			return nil, err
		}
		rolls = append(rolls, r)
	}
	return rolls, rows.Err()
}
