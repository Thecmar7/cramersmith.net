package api

import (
	"encoding/json"
	"net/http"
)

// NewRouter returns a mux with all API routes registered.
func NewRouter() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", handleHealth)
	// Add more routes here as the site grows, e.g.:
	// mux.HandleFunc("GET /projects", handleProjects)
	// mux.HandleFunc("POST /contact", handleContact)

	return mux
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
