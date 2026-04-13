# cramersmith.net — Claude Context

Personal portfolio and blog. See `README.md` for overview, `docs/deployment.md` for AWS setup, `PLAN.md` for the in-progress blog upgrade work.

## Stack

- **Go** — single binary, serves both the API and embedded React static files
- **React + TypeScript (Vite)** — frontend, compiled into `frontend/dist/` and baked into the Go binary via `//go:embed`
- **PostgreSQL (AWS RDS)** — posts table and visit counter
- **AWS App Runner** — container hosting, auto-deploys on ECR image push
- **AWS SSM Parameter Store** — all secrets (never in code or env vars)

## Key Files

| File | Purpose |
|---|---|
| `main.go` | Entry point — loads SSM secrets, connects DB, registers routes |
| `internal/api/router.go` | All HTTP handlers and route registration |
| `internal/auth/auth.go` | Bearer token middleware — accepts multiple tokens (admin password + shortcut token) |
| `internal/store/store.go` | DB connection pool and all query methods |
| `internal/bluesky/` | Optional Bluesky cross-posting |
| `db/migrations/` | SQL schema — run once via `make migrate` |
| `db/queries/` | Named SQL files loaded at startup |
| `frontend/src/pages/` | Portfolio, Feed, Post (individual blog post), Admin |
| `frontend/src/components/` | Nav, bento grid cards |

## Post Data Model

Posts support three types. All types share the base fields plus new blog-era fields:

```go
type Post struct {
  ID        int       `json:"id"`
  Type      string    `json:"type"`       // "thought" | "link" | "blog"
  Title     *string   `json:"title"`      // blog posts only
  Slug      *string   `json:"slug"`       // blog posts only; unique; used in URL
  Content   string    `json:"content"`    // markdown-formatted text
  URL       *string   `json:"url"`        // link posts only
  URLTitle  *string   `json:"url_title"`  // link posts only
  Tags      []string  `json:"tags"`       // any type; hashtag-style categories
  ImageURL  *string   `json:"image_url"`  // any type; header image
  Draft     bool      `json:"draft"`      // blog posts; true = not publicly visible
  CreatedAt time.Time `json:"created_at"`
}
```

Slugs are auto-generated from the title on creation (lowercased, hyphenated) but can be overridden in the admin. Content is markdown for all post types.

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | none | Health check |
| GET | `/api/visits` | none | Increment + return visit count |
| GET | `/api/posts` | none | List published posts; supports `?tag=`, `?page=`, `?limit=` |
| GET | `/api/posts/:slug` | none | Get single blog post by slug |
| GET | `/api/tags` | none | List all tags in use |
| POST | `/api/posts` | Bearer token | Create a post |
| PATCH | `/api/posts/{id}` | Bearer token | Update post (e.g., toggle draft) |
| DELETE | `/api/posts/{id}` | Bearer token | Delete a post |
| GET | `/rss.xml` | none | RSS feed of published blog posts |

Auth: `Authorization: Bearer <token>`. Two valid tokens: `/cramersmith/admin-password` and `/cramersmith/shortcut-token` (both in SSM).

## SSM Parameters

| Name | What it is |
|---|---|
| `/cramersmith/admin-password` | Admin page password |
| `/cramersmith/db-url` | PostgreSQL connection string |
| `/cramersmith/shortcut-token` | iOS Shortcut bearer token |
| `/cramersmith/bluesky-handle` | Bluesky handle (optional) |
| `/cramersmith/bluesky-app-password` | Bluesky app password (optional) |

## Deploy

```bash
make deploy   # build React + Docker, push to ECR, App Runner auto-redeploys
make status   # watch rollout
make migrate  # run DB migrations (fetches DB URL from SSM automatically)
```

## AWS Key IDs

| Thing | Value |
|---|---|
| Account ID | `YOUR-AWS-ACCOUNT-ID` |
| Region | `us-west-2` |
| ECR URI | `YOUR-ECR-URI` |
| App Runner ARN | `YOUR-APP-RUNNER-ARN` |
| RDS Endpoint | `YOUR-RDS-ENDPOINT` |
