package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"

	"cramersmith.net/internal/api"
)

//go:embed frontend/dist
var staticFiles embed.FS

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	distFS, err := fs.Sub(staticFiles, "frontend/dist")
	if err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()

	// API routes
	mux.Handle("/api/", http.StripPrefix("/api", api.NewRouter()))

	// React app — serve static files, fall back to index.html for client-side routing
	mux.Handle("/", spaHandler(distFS))

	log.Printf("listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

// spaHandler serves static files and falls back to index.html for any path
// that doesn't match a real file, so React Router can handle navigation.
func spaHandler(staticFS fs.FS) http.HandlerFunc {
	fileServer := http.FileServer(http.FS(staticFS))
	return func(w http.ResponseWriter, r *http.Request) {
		// Resolve the path to a file in the embedded FS.
		path := r.URL.Path
		if path == "/" {
			path = "index.html"
		} else {
			path = path[1:] // strip leading "/"
		}
		_, err := fs.Stat(staticFS, path)
		if err != nil {
			// Not a real file — hand off to React Router via index.html.
			r = r.Clone(r.Context())
			r.URL.Path = "/"
		}
		fileServer.ServeHTTP(w, r)
	}
}
