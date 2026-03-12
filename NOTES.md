# cramersmith.net — Project Notes

## Stack
- **Domain:** cramersmith.net (Route53)
- **Region:** us-west-2 (Oregon)
- **App:** Single Go binary — serves React frontend + Go API
- **Deploy target:** AWS App Runner
- **Container registry:** Amazon ECR

---

## Architecture

```
cramersmith.net  →  Route53  →  App Runner  →  Go binary
                                                   |
                                         ┌─────────┴──────────┐
                                    React (embedded)      API routes
                                    GET /         →  serves index.html
                                    GET /assets/* →  serves JS/CSS
                                    GET /api/*    →  Go handlers
```

The React app is compiled to static files, then baked into the Go binary
using Go's `//go:embed` directive. One binary, one Docker image, one service.

---

## Why App Runner (not EC2 or ECS)

| Option | Monthly cost | Maintenance | Complexity |
|---|---|---|---|
| App Runner | ~$5-15 | None | Low |
| ECS + ALB | ~$25-40 | Low | Medium |
| EC2 | ~$8-10 | Patch the OS | Low-Medium |

App Runner handles HTTPS, scaling, and restarts automatically. Best "set and forget" option.

---

## AWS Console Cheat Sheet

| Service | Find it by... | Notes |
|---|---|---|
| Route53 | Search "Route 53" → Hosted zones → cramersmith.net | |
| ECR | Search "ECR" (Elastic Container Registry) | Stores your Docker image |
| App Runner | Search "App Runner" | Runs your container |
| ACM | Not needed — App Runner provisions the cert automatically when you attach a custom domain |

---

## Deployment Flow (once set up)

```bash
# 1. Build React
cd frontend && npm run build

# 2. Build Go binary (embeds React build output)
cd .. && go build -o server .

# 3. Build & push Docker image
docker build -t cramersmith-net .
docker tag cramersmith-net:latest YOUR-ECR-URI:latest
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin YOUR-ECR-URI
docker push YOUR-ECR-URI:latest

# 4. App Runner picks up the new image automatically (if auto-deploy is on)
#    Or trigger manually in the App Runner console
```

---

## IDs to Fill In

- [x] Route53 Hosted Zone ID: `YOUR-HOSTED-ZONE-ID`
- [x] ECR Repository URI: `YOUR-ECR-URI`
- [x] App Runner Service ARN: `YOUR-APP-RUNNER-ARN`
- [x] App Runner default URL: `YOUR-APP-RUNNER-URL`
- [x] ACM — not needed, App Runner auto-provisions SSL for custom domains

---

## Project Structure (planned)

```
web/
├── main.go              # Go entry point
├── go.mod
├── Dockerfile
├── frontend/            # React app (create-react-app or Vite)
│   ├── src/
│   ├── public/
│   └── package.json
└── internal/
    └── api/             # Go API handlers
```

---

## Status Log

- **2026-03-12** — Project initialized. Domain: cramersmith.net. Region: us-west-2.
                   Stack: single Go binary (embeds React). Deploy: App Runner.
