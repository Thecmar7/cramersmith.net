# cramersmith.net

Personal portfolio and microblog at [cramersmith.net](https://cramersmith.net).

## Stack

- **Frontend:** React + TypeScript (Vite), embedded into the Go binary at compile time
- **Backend:** Go — serves both the API and the React static files as a single binary
- **Database:** PostgreSQL (AWS RDS) — stores feed posts and visit counter
- **Hosting:** AWS App Runner (auto-deploys on image push)
- **Secrets:** AWS SSM Parameter Store (encrypted at rest, fetched at startup)

## Project Structure

```
web/
├── main.go                   # Server entry point — loads secrets, connects DB, starts HTTP
├── Dockerfile                # 3-stage build: Node → Go → Alpine
├── Makefile                  # Dev, build, deploy, and migration shortcuts
├── db/
│   ├── migrations/           # SQL schema (run once via `make migrate`)
│   └── queries/              # Named SQL queries loaded at runtime
├── internal/
│   ├── api/router.go         # HTTP handlers and route registration
│   ├── auth/auth.go          # Bearer token middleware (supports multiple tokens)
│   ├── bluesky/              # Optional Bluesky cross-posting
│   └── store/store.go        # PostgreSQL connection pool and queries
└── frontend/                 # React app (Vite)
    └── src/
        ├── pages/            # Portfolio, Feed, Admin
        └── components/       # Nav, bento grid cards
```

## Local Development

The app requires a database and AWS credentials at startup. The easiest way to run locally is to point it at the production RDS instance with your local AWS credentials.

```bash
# Build and run the frontend dev server
cd frontend && npm install && npm run dev

# In a separate terminal, run the Go server (requires AWS creds + DB access)
go run .
```

## Deploy

```bash
make deploy
```

Builds the React app, builds the Docker image for `linux/amd64`, pushes to ECR, and App Runner redeploys automatically (~2–3 minutes).

Watch the rollout:
```bash
make status
```

See [docs/deployment.md](docs/deployment.md) for the full AWS setup walkthrough.

## Pages

| Path | Description |
|---|---|
| `/` | Portfolio — bento grid with bio, experience, links |
| `/feed` | Public microblog feed |
| `/admin` | Password-protected post editor |

## Posting from iPhone

Use an iOS Shortcut with a **Get Contents of URL** action:

- **URL:** `https://cramersmith.net/api/posts`
- **Method:** POST
- **Headers:** `Authorization: Bearer <shortcut-token>`
- **Body (JSON):** `{"type": "thought", "content": "your text"}`

The shortcut token is stored separately from the admin password in SSM at `/cramersmith/shortcut-token`.
