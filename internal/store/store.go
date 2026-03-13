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
	ID        int       `json:"id"`
	Type      string    `json:"type"`
	Content   string    `json:"content"`
	URL       *string   `json:"url"`
	URLTitle  *string   `json:"url_title"`
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
			// strip trailing comment lines
			var clean []string
			for _, l := range strings.Split(q, "\n") {
				if !strings.HasPrefix(strings.TrimSpace(l), "--") {
					clean = append(clean, l)
				}
			}
			out[currentName] = strings.TrimSpace(strings.Join(clean, "\n"))
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

// ListPosts returns all posts newest-first.
func (s *Store) ListPosts(ctx context.Context) ([]Post, error) {
	rows, err := s.db.Query(ctx, s.query("ListPosts"))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []Post
	for rows.Next() {
		var p Post
		if err := rows.Scan(&p.ID, &p.Type, &p.Content, &p.URL, &p.URLTitle, &p.CreatedAt); err != nil {
			return nil, err
		}
		posts = append(posts, p)
	}
	return posts, rows.Err()
}

// CreatePost inserts a new post and returns it.
func (s *Store) CreatePost(ctx context.Context, postType, content string, url, urlTitle *string) (*Post, error) {
	var p Post
	err := s.db.QueryRow(ctx, s.query("CreatePost"), postType, content, url, urlTitle).
		Scan(&p.ID, &p.Type, &p.Content, &p.URL, &p.URLTitle, &p.CreatedAt)
	return &p, err
}

// DeletePost removes a post by ID.
func (s *Store) DeletePost(ctx context.Context, id int) error {
	_, err := s.db.Exec(ctx, s.query("DeletePost"), id)
	return err
}

// IncrementAndGetVisits atomically increments the counter and returns the new value.
func (s *Store) IncrementAndGetVisits(ctx context.Context) (int64, error) {
	var count int64
	err := s.db.QueryRow(ctx, s.query("IncrementAndGetVisits")).Scan(&count)
	return count, err
}
