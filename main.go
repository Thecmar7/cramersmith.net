package main

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/ssm"

	"cramersmith.net/internal/api"
	"cramersmith.net/internal/auth"
	"cramersmith.net/internal/store"
)

//go:embed frontend/dist
var staticFiles embed.FS

//go:embed db
var dbFiles embed.FS

func main() {
	ctx := context.Background()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Load AWS config (uses instance role in production, local credentials in dev)
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion("us-west-2"))
	if err != nil {
		log.Fatalf("failed to load AWS config: %v", err)
	}
	ssmClient := ssm.NewFromConfig(awsCfg)

	// Fetch admin password from SSM
	adminAuth, err := auth.New(ctx, ssmClient, "/cramersmith/admin-password")
	if err != nil {
		log.Fatalf("failed to load admin password from SSM: %v", err)
	}

	// Fetch DB connection string from SSM
	dbURLParam, err := ssmClient.GetParameter(ctx, &ssm.GetParameterInput{
		Name:           strPtr("/cramersmith/db-url"),
		WithDecryption: boolPtr(true),
	})
	if err != nil {
		log.Fatalf("failed to load DB URL from SSM: %v", err)
	}

	// Connect to database
	s, err := store.New(ctx, *dbURLParam.Parameter.Value, dbFiles)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	// Set up routes
	distFS, err := fs.Sub(staticFiles, "frontend/dist")
	if err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()
	mux.Handle("/api/", http.StripPrefix("/api", api.NewRouter(s, adminAuth)))
	mux.Handle("/", spaHandler(distFS))

	log.Printf("listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

// spaHandler serves static files and falls back to index.html for any path
// that doesn't match a real file, so React Router can handle navigation.
func spaHandler(staticFS fs.FS) http.HandlerFunc {
	fileServer := http.FileServer(http.FS(staticFS))
	return func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if path == "/" {
			path = "index.html"
		} else {
			path = path[1:] // strip leading "/"
		}
		_, err := fs.Stat(staticFS, path)
		if err != nil {
			r = r.Clone(r.Context())
			r.URL.Path = "/"
		}
		fileServer.ServeHTTP(w, r)
	}
}

func strPtr(s string) *string  { return &s }
func boolPtr(b bool) *bool     { return &b }
