# Deployment Guide

Everything needed to go from zero to a live site at cramersmith.net, or to redeploy after changes.

---

## Architecture

```
cramersmith.net  →  Route53  →  App Runner  →  Go binary
                                                   │
                                        ┌──────────┴──────────┐
                                   React (embedded)        API routes
                                   GET /         →  index.html
                                   GET /assets/* →  JS/CSS
                                   GET /api/*    →  Go handlers
```

The React app is compiled to static files, then baked into the Go binary using Go's `//go:embed` directive. One binary → one Docker image → one service.

### Why App Runner

| Option | Monthly cost | Maintenance | Complexity |
|---|---|---|---|
| App Runner | ~$5–15 | None | Low |
| ECS + ALB | ~$25–40 | Low | Medium |
| EC2 | ~$8–10 | Patch the OS | Low–Medium |

App Runner handles HTTPS, scaling, and restarts automatically. No load balancer or certificate manager setup needed — it provisions SSL automatically when you attach a custom domain.

---

## How the Go Embed Works

Go's `//go:embed` directive bakes files into the binary at compile time. In `main.go`:

```go
//go:embed frontend/dist
var staticFiles embed.FS
```

When you run `go build`, Go reads everything inside `frontend/dist/` and stores it inside the binary. The running server never reads from disk. This is why the React app must be built (`npm run build`) *before* the Go binary is compiled.

---

## Dockerfile (3-Stage Build)

**Stage 1 — Node (builds React):**
```dockerfile
FROM node:22-alpine AS frontend
# installs dependencies, runs `npm run build`
# output: frontend/dist/
```

**Stage 2 — Go (compiles binary with React embedded):**
```dockerfile
FROM golang:1.25-alpine AS backend
# copies Go source + frontend/dist from Stage 1
# runs `go build` → produces a single static binary called `server`
```

**Stage 3 — Alpine (final image):**
```dockerfile
FROM alpine:3.21
RUN apk add --no-cache ca-certificates
# copies only the `server` binary
# Alpine is used (not scratch) because the AWS SDK makes HTTPS calls to SSM
# at startup, which requires CA certificates to verify SSL.
```

The `--platform linux/amd64` flag is required when building on a Mac (ARM) for deployment to App Runner (x86).

---

## AWS Services

| Service | What it does | Where to find it |
|---|---|---|
| **ECR** | Stores the Docker image | AWS Console → ECR |
| **App Runner** | Runs the container, handles HTTPS, auto-restarts | AWS Console → App Runner |
| **Route53** | DNS — points cramersmith.net to App Runner | AWS Console → Route 53 → Hosted zones |
| **RDS** | PostgreSQL — stores feed posts and visit counter | AWS Console → RDS |
| **SSM Parameter Store** | Stores secrets encrypted at rest | AWS Console → Systems Manager → Parameter Store |
| **IAM** | Manages permissions | AWS Console → IAM |

---

## AWS Setup (One-Time)

### 1. IAM User (cramersmith-deploy)

Created an IAM user for deployments instead of using root. Policies attached:
- `AmazonEC2ContainerRegistryFullAccess`
- `AWSAppRunnerFullAccess`
- `AmazonRoute53FullAccess`
- `AWSCertificateManagerFullAccess`
- `IAMFullAccess` (needed once to create the App Runner role)

Credentials configured locally via `aws configure`.

### 2. ECR Repository

```bash
aws ecr create-repository \
  --repository-name cramersmith-net \
  --region us-west-2 \
  --image-scanning-configuration scanOnPush=true
```

Registry URI: `YOUR-ECR-URI`

### 3. IAM Role for App Runner (ECR Access)

App Runner needs permission to pull images from ECR. Created once, reused forever:

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

### 4. IAM Role for App Runner (Instance/SSM Access)

The running container needs to read secrets from SSM:

```bash
aws iam create-role \
  --role-name AppRunnerInstanceRole \
  --assume-role-policy-document '{ "Statement": [{ "Effect": "Allow",
    "Principal": {"Service": "tasks.apprunner.amazonaws.com"},
    "Action": "sts:AssumeRole" }] }'

aws iam attach-role-policy \
  --role-name AppRunnerInstanceRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess
```

Then attach it in the AWS Console: App Runner → cramersmith-net → Configuration → Security → Instance role → `AppRunnerInstanceRole`.

### 5. SSM Parameters (Secrets)

Secrets are stored as `SecureString` — encrypted at rest, never in code or the Docker image.

```bash
aws ssm put-parameter --region us-west-2 --type SecureString \
  --name /cramersmith/admin-password --value "your-password"

aws ssm put-parameter --region us-west-2 --type SecureString \
  --name /cramersmith/db-url \
  --value "postgres://cramersmith:<pass>@<host>:5432/cramersmith?sslmode=require"

aws ssm put-parameter --region us-west-2 --type SecureString \
  --name /cramersmith/shortcut-token \
  --value "$(openssl rand -base64 32)"
```

To retrieve a value later:
```bash
aws ssm get-parameter --name "/cramersmith/shortcut-token" \
  --with-decryption --region us-west-2 --query Parameter.Value --output text
```

### 6. RDS PostgreSQL

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

### 7. Run DB Migrations

```bash
make migrate
```

Fetches the DB URL from SSM automatically and runs all files in `db/migrations/`. Requires `psql` (`brew install postgresql`).

### 8. Create App Runner Service

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

`AutoDeploymentsEnabled: true` means every new image pushed to ECR with the `latest` tag triggers an automatic redeploy.

### 9. Attach Custom Domain

```bash
aws apprunner associate-custom-domain \
  --region us-west-2 \
  --service-arn YOUR-APP-RUNNER-ARN \
  --domain-name cramersmith.net \
  --enable-www-subdomain
```

This provisions an SSL certificate for `cramersmith.net` and `www.cramersmith.net`. It returns DNS records to add to Route53 for validation.

### 10. Route53 DNS

Records configured:
- **A ALIAS** `cramersmith.net` → App Runner (ALIAS required at apex — standard DNS doesn't allow CNAME at root)
- **CNAME** `www.cramersmith.net` → `YOUR-APP-RUNNER-URL`
- **3 × CNAME** — SSL certificate validation records (App Runner uses these to prove domain ownership)

---

## Redeploying (Ongoing)

```bash
make deploy
```

Builds React, builds the Docker image for `linux/amd64`, pushes to ECR. App Runner redeploys automatically.

Watch the rollout:
```bash
make status
```

Or in the AWS Console: App Runner → cramersmith-net → Activity.

---

## Key IDs

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
| SSM: shortcut token | `/cramersmith/shortcut-token` |
| IAM ECR role | `AppRunnerECRAccessRole` |
| IAM instance role | `AppRunnerInstanceRole` |

---

## Still To Do

- [ ] Add resume PDF → drop `resume.pdf` in `frontend/public/`, set `resumeAvailable = true` in `frontend/src/components/cards/LinksCard.tsx`
- [ ] Add visit counter display to the Hero card (fetch `GET /api/visits`, render the count)
