# cramersmith.net — Claude Context

Personal portfolio and microblog. See `README.md` for overview, `docs/deployment.md` for AWS setup.

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
| `frontend/src/pages/` | Portfolio, Feed, Admin |
| `frontend/src/components/` | Nav, bento grid cards |

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | none | Health check |
| GET | `/api/visits` | none | Increment + return visit count |
| GET | `/api/posts` | none | List all posts |
| POST | `/api/posts` | Bearer token | Create a post |
| DELETE | `/api/posts/{id}` | Bearer token | Delete a post |

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
