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
├── go.mod                         # Go module (module: cramersmith.net)
├── Dockerfile                     # 3-stage build (see below)
├── .gitignore
├── NOTES.md                       # IDs and deployment commands
├── HOWTO.md                       # This file
├── internal/
│   └── api/
│       └── router.go              # API route handlers
└── frontend/                      # React + TypeScript (Vite)
    ├── src/
    │   ├── App.tsx                # Root component, wires up the grid
    │   ├── index.css              # Design system (CSS variables)
    │   └── components/
    │       ├── BentoGrid.css      # Grid layout + card positioning
    │       └── cards/
    │           ├── HeroCard.tsx   # Name + tagline
    │           ├── AboutCard.tsx  # Elevator pitch
    │           ├── ExperienceCard.tsx  # Work history
    │           ├── LinkCard.tsx   # Reusable GitHub / LinkedIn card
    │           └── ResumeCard.tsx # Resume PDF download
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

**Stage 3 — Scratch (final image):**
```dockerfile
FROM scratch
# copies only the `server` binary
# final image is ~10MB, no OS, no shell, nothing else
```

The `--platform linux/amd64` flag is required when building on a Mac (which is ARM) for deployment to App Runner (which runs on x86).

---

## AWS Services Used

| Service | What it does | Where to find it |
|---|---|---|
| **ECR** (Elastic Container Registry) | Stores your Docker image | AWS Console → search "ECR" |
| **App Runner** | Runs your container, handles HTTPS, auto-restarts | AWS Console → search "App Runner" |
| **Route53** | DNS — points cramersmith.net to App Runner | AWS Console → search "Route 53" → Hosted zones |
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

### 7. Update Route53 DNS
The old site was pointing to an EC2 IP (`35.83.52.113`). Those records were replaced.

Records added:
- **A ALIAS** `cramersmith.net` → App Runner (apex domain — Route53 ALIAS is needed because standard DNS doesn't allow CNAME at the root)
- **CNAME** `www.cramersmith.net` → `YOUR-APP-RUNNER-URL`
- **3 × CNAME** — certificate validation records (App Runner uses these to prove you own the domain and issue the SSL cert automatically)

---

## How to Redeploy (Future Updates)

Every time you change the site, run this to push a new version live:

```bash
# 1. Build the React frontend
npm run build --prefix frontend

# 2. Build the Docker image
docker build --platform linux/amd64 -t cramersmith-net .

# 3. Re-authenticate with ECR (if your token has expired — valid 12 hours)
aws ecr get-login-password --region us-west-2 | \
  docker login --username AWS --password-stdin \
  YOUR-AWS-ACCOUNT-ID.dkr.ecr.us-west-2.amazonaws.com

# 4. Tag and push
docker tag cramersmith-net:latest \
  YOUR-ECR-URI:latest
docker push \
  YOUR-ECR-URI:latest

# App Runner detects the new image and redeploys automatically.
# Takes about 2-3 minutes. Watch progress at:
# AWS Console → App Runner → cramersmith-net → Activity
```

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

---

## Still To Do

- [ ] Fill in real elevator pitch in `frontend/src/components/cards/AboutCard.tsx`
- [ ] Fill in real work history in `frontend/src/components/cards/ExperienceCard.tsx`
- [ ] Set GitHub username + LinkedIn URL in `frontend/src/App.tsx` (top of file)
- [ ] Add resume PDF → drop `resume.pdf` in `frontend/public/`, set `resumeAvailable = true` in `ResumeCard.tsx`
