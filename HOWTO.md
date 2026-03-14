# How cramersmith.net Was Built and Deployed

This document explains everything that was done to go from zero to a live website at cramersmith.net. Written so future-you (or anyone) can understand it without needing to remember anything.

---

## What Was Built

A single Go binary that serves both a React frontend and a Go API. The React app is compiled to static files and baked directly into the Go binary at compile time — meaning there's only one thing to deploy: a Docker container.

```
Browser → cramersmith.net → App Runner → Go binary
                                              │
                                   ┌──────────┴──────────┐
                              React pages            API routes
                              (embedded)             /api/...
```

---

## Project Structure

```
web/
├── main.go                        # Go server entry point
├── go.mod / go.sum                # Go module (module: cramersmith.net)
├── Dockerfile                     # 3-stage build (see below)
├── Makefile                       # dev / build / deploy / migrate shortcuts
├── .gitignore
├── HOWTO.md                       # This file
├── db/
│   ├── migrations/
│   │   ├── 001_create_posts.sql   # posts table
│   │   └── 002_create_visits.sql  # visit counter table
│   └── queries/
│       ├── posts.sql              # ListPosts, CreatePost, DeletePost
│       └── visits.sql             # IncrementAndGetVisits
├── internal/
│   ├── api/
│   │   └── router.go              # API route handlers
│   ├── auth/
│   │   └── auth.go                # Admin password middleware (reads from SSM)
│   └── store/
│       └── store.go               # DB connection pool + all queries
└── frontend/                      # React + TypeScript (Vite)
    ├── src/
    │   ├── App.tsx                # Root: BrowserRouter + Nav + Routes
    │   ├── index.css              # Design system (CSS variables)
    │   ├── components/
    │   │   ├── Nav.tsx / Nav.css  # Top nav bar (Portfolio / Feed links)
    │   │   ├── BentoGrid.css      # Grid layout + card positioning
    │   │   └── cards/
    │   │       ├── HeroCard.tsx   # Name + tagline
    │   │       ├── AboutCard.tsx  # Elevator pitch
    │   │       ├── ExperienceCard.tsx  # Work history
    │   │       └── LinksCard.tsx  # GitHub, LinkedIn, Resume (combined)
    │   └── pages/
    │       ├── Portfolio.tsx      # Bento grid (the home page)
    │       ├── Feed.tsx / Feed.css     # Public microblog feed
    │       └── Admin.tsx / Admin.css   # Password-gated post editor
    └── package.json
```

---

## How the Go Embed Works

Go's `//go:embed` directive lets you bake files into the binary at compile time. In `main.go`:

```go
//go:embed frontend/dist
var staticFiles embed.FS
```

When you run `go build`, Go reads everything inside `frontend/dist/` and stores it inside the binary itself. The running server never reads from disk — it serves files from memory. This is why the React app must be built (`npm run build`) *before* the Go binary is compiled.

The server handles routing like this:
- `GET /api/*` → Go handlers in `internal/api/router.go`
- Everything else → serves React static files, falling back to `index.html` so React Router can handle client-side navigation

---

## The Dockerfile (3-Stage Build)

The Dockerfile has three stages so the final image is as small as possible:

**Stage 1 — Node (builds React):**
```dockerfile
FROM node:22-alpine AS frontend
# installs dependencies, runs `npm run build`
# output: frontend/dist/
```

**Stage 2 — Go (compiles binary with React embedded):**
```dockerfile
FROM golang:1.25-alpine AS backend
# copies Go source + the frontend/dist from Stage 1
# runs `go build` → produces a single static binary called `server`
```

**Stage 3 — Alpine (final image):**
```dockerfile
FROM alpine:3.21
RUN apk add --no-cache ca-certificates
# copies only the `server` binary
# Alpine is used instead of scratch because the AWS SDK makes HTTPS calls
# to SSM at startup, which requires CA certificates to verify SSL.
```

The `--platform linux/amd64` flag is required when building on a Mac (which is ARM) for deployment to App Runner (which runs on x86).

---

## AWS Services Used

| Service | What it does | Where to find it |
|---|---|---|
| **ECR** (Elastic Container Registry) | Stores your Docker image | AWS Console → search "ECR" |
| **App Runner** | Runs your container, handles HTTPS, auto-restarts | AWS Console → search "App Runner" |
| **Route53** | DNS — points cramersmith.net to App Runner | AWS Console → search "Route 53" → Hosted zones |
| **RDS** (PostgreSQL) | Stores blog posts and visit counter | AWS Console → search "RDS" |
| **SSM Parameter Store** | Stores secrets (DB URL, admin password) encrypted at rest | AWS Console → search "Systems Manager" → Parameter Store |
| **IAM** | Manages permissions | AWS Console → search "IAM" |

No EC2, no load balancer, no certificate manager setup needed. App Runner handles HTTPS/SSL automatically when you associate a custom domain.

---

## AWS Setup — Step by Step

### 1. IAM User (cramersmith-deploy)
Created an IAM user specifically for deployments instead of using the root account. Given these policies:
- `AmazonEC2ContainerRegistryFullAccess`
- `AWSAppRunnerFullAccess`
- `AmazonRoute53FullAccess`
- `AWSCertificateManagerFullAccess`
- `IAMFullAccess` (needed once to create the App Runner role)

Credentials were configured locally via `aws configure`.

### 2. ECR Repository
```bash
aws ecr create-repository \
  --repository-name cramersmith-net \
  --region us-west-2 \
  --image-scanning-configuration scanOnPush=true
```
This created a private Docker registry at:
`YOUR-ECR-URI`

### 3. IAM Role for App Runner
App Runner needs permission to pull images from ECR. This role is created once and reused for all future deployments:
```bash
aws iam create-role \
  --role-name AppRunnerECRAccessRole \
  --assume-role-policy-document '{ "Statement": [{ "Effect": "Allow",
    "Principal": {"Service": "build.apprunner.amazonaws.com"},
    "Action": "sts:AssumeRole" }] }'

aws iam attach-role-policy \
  --role-name AppRunnerECRAccessRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess
```

### 4. Build and Push the Docker Image
```bash
# Authenticate Docker with ECR (token expires after 12 hours)
aws ecr get-login-password --region us-west-2 | \
  docker login --username AWS --password-stdin \
  YOUR-AWS-ACCOUNT-ID.dkr.ecr.us-west-2.amazonaws.com

# Build for linux/amd64 (required — Macs are ARM, App Runner is x86)
docker build --platform linux/amd64 -t cramersmith-net .

# Tag and push
docker tag cramersmith-net:latest \
  YOUR-ECR-URI:latest
docker push \
  YOUR-ECR-URI:latest
```

### 5. Create App Runner Service
```bash
aws apprunner create-service \
  --region us-west-2 \
  --service-name cramersmith-net \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "YOUR-ECR-URI:latest",
      "ImageConfiguration": { "Port": "8080" },
      "ImageRepositoryType": "ECR"
    },
    "AuthenticationConfiguration": {
      "AccessRoleArn": "arn:aws:iam::YOUR-AWS-ACCOUNT-ID:role/AppRunnerECRAccessRole"
    },
    "AutoDeploymentsEnabled": true
  }' \
  --instance-configuration '{"Cpu":"256","Memory":"512"}'
```
`AutoDeploymentsEnabled: true` means every time a new image is pushed to ECR with the `latest` tag, App Runner automatically redeploys. You don't need to trigger anything manually.

### 6. Attach the Custom Domain
```bash
aws apprunner associate-custom-domain \
  --region us-west-2 \
  --service-arn YOUR-APP-RUNNER-ARN \
  --domain-name cramersmith.net \
  --enable-www-subdomain
```
This tells App Runner to provision an SSL certificate for `cramersmith.net` and `www.cramersmith.net`. It returns DNS records that need to be added to Route53 for validation.

### 7. RDS PostgreSQL Database
Created a `db.t3.micro` PostgreSQL instance for storing blog posts and the visit counter.

```bash
aws rds create-db-instance \
  --db-instance-identifier cramersmith-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username cramersmith \
  --master-user-password <password> \
  --allocated-storage 20 \
  --publicly-accessible \
  --region us-west-2
```

DB endpoint: `YOUR-RDS-ENDPOINT`

The DB URL (with credentials) is stored in SSM, not in the code — see below.

### 8. SSM Parameter Store (Secrets)
Secrets are stored as `SecureString` in SSM Parameter Store. They are encrypted at rest and never appear in code, environment variables, or the Docker image.

Two parameters:
- `/cramersmith/admin-password` — password for the `/admin` page
- `/cramersmith/db-url` — full PostgreSQL connection string

```bash
# Store the admin password
aws ssm put-parameter \
  --region us-west-2 \
  --name /cramersmith/admin-password \
  --value "your-password" \
  --type SecureString

# Store the DB URL
aws ssm put-parameter \
  --region us-west-2 \
  --name /cramersmith/db-url \
  --value "postgres://cramersmith:<pass>@<host>:5432/cramersmith?sslmode=require" \
  --type SecureString
```

The running container fetches these at startup via the AWS SDK. This requires the App Runner **instance role** (separate from the ECR access role) to have SSM read permissions:

```bash
# Create the instance role
aws iam create-role \
  --role-name AppRunnerInstanceRole \
  --assume-role-policy-document '{ "Statement": [{ "Effect": "Allow",
    "Principal": {"Service": "tasks.apprunner.amazonaws.com"},
    "Action": "sts:AssumeRole" }] }'

aws iam attach-role-policy \
  --role-name AppRunnerInstanceRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess
```

Then attach it to the App Runner service in the AWS Console: App Runner → cramersmith-net → Configuration → Security → Instance role → `AppRunnerInstanceRole`.

### 9. Run DB Migrations
The SQL schema lives in `db/migrations/`. Run these once to set up the tables:

```bash
make migrate
```

This fetches the DB URL from SSM automatically and runs both migration files. Requires `psql` installed (`brew install postgresql`).

### 10. Update Route53 DNS
The old site was pointing to an EC2 IP (`35.83.52.113`). Those records were replaced.

Records added:
- **A ALIAS** `cramersmith.net` → App Runner (apex domain — Route53 ALIAS is needed because standard DNS doesn't allow CNAME at the root)
- **CNAME** `www.cramersmith.net` → `YOUR-APP-RUNNER-URL`
- **3 × CNAME** — certificate validation records (App Runner uses these to prove you own the domain and issue the SSL cert automatically)

---

## The Mini Blog (Feed)

A personal microblog where only you can post. Public readers see the feed; you manage it from a hidden admin page.

### How it works

- **`/feed`** — public page listing all posts, newest first
- **`/admin`** — password-protected page to create and delete posts

Posts have two types:
- **Thought** — just text, like a tweet
- **Link** — a URL with an optional title and optional comment

### Posting

1. Go to `cramersmith.net/admin`
2. Enter your admin password (stored in SSM, not in the code)
3. Select Thought or Link, fill in the fields, hit Post
4. Your post appears on `/feed` immediately

The password is saved in your browser's localStorage so you don't have to re-enter it.

### SQL Queries

All database queries are saved as readable SQL files in `db/queries/`. This is intentional — you can open them and read exactly what the app is doing to the database at any time.

---

## How to Redeploy (Future Updates)

Every time you change the site, just run:

```bash
make deploy
```

That's it. It handles ECR login, frontend build, Docker build, and push. App Runner redeploys automatically when it sees a new image (~2–3 minutes).

Watch the rollout:
```bash
make status
```

Or in the AWS Console: App Runner → cramersmith-net → Activity.

---

## Key IDs (don't lose these)

| Thing | Value |
|---|---|
| AWS Account ID | `YOUR-AWS-ACCOUNT-ID` |
| AWS Region | `us-west-2` |
| ECR URI | `YOUR-ECR-URI` |
| App Runner Service ARN | `YOUR-APP-RUNNER-ARN` |
| App Runner default URL | `YOUR-APP-RUNNER-URL` |
| Route53 Hosted Zone ID | `YOUR-HOSTED-ZONE-ID` |
| RDS Endpoint | `YOUR-RDS-ENDPOINT` |
| SSM: admin password | `/cramersmith/admin-password` |
| SSM: DB URL | `/cramersmith/db-url` |
| IAM ECR role | `AppRunnerECRAccessRole` (used by build.apprunner.amazonaws.com) |
| IAM instance role | `AppRunnerInstanceRole` (used by tasks.apprunner.amazonaws.com — allows SSM access) |

---

## Still To Do

- [ ] Add resume PDF → drop `resume.pdf` in `frontend/public/`, set `resumeAvailable = true` in `frontend/src/components/cards/LinksCard.tsx`
- [ ] Add visit counter display to the Hero card (fetch `GET /api/visits`, render the count)
