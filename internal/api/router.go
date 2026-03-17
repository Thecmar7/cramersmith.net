package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"cramersmith.net/internal/auth"
	"cramersmith.net/internal/bluesky"
	"cramersmith.net/internal/store"
)

// NewRouter returns a mux with all API routes registered.
func NewRouter(s *store.Store, a *auth.Auth, bsky *bluesky.Client) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("GET /visits", handleVisits(s))
	mux.HandleFunc("GET /posts", handleListPosts(s))
	mux.Handle("POST /posts", a.Middleware(http.HandlerFunc(handleCreatePost(s, bsky))))
	mux.Handle("DELETE /posts/{id}", a.Middleware(http.HandlerFunc(handleDeletePost(s))))

	return mux
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

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
