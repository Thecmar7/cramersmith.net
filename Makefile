ECR_URI        = 068072250063.dkr.ecr.us-west-2.amazonaws.com/cramersmith-net
APP_RUNNER_ARN = arn:aws:apprunner:us-west-2:068072250063:service/cramersmith-net/c264e5d8d15144e88574545eee52efa4
REGION         = us-west-2

.PHONY: dev run build deploy login status clean

## ── Local development ────────────────────────────────────────────────────────

# Start the Vite dev server with hot reload on http://localhost:5173
# Use this when working on the frontend — changes appear instantly.
dev:
	VITE_GIT_HASH=$$(git rev-parse HEAD) VITE_GIT_DATE=$$(git log -1 --format=%Y-%m-%d) npm run dev --prefix frontend

# Build everything and run the full Go server on http://localhost:8080
# Use this to test exactly what will be deployed (no hot reload).
run: build
	./server

## ── Build ────────────────────────────────────────────────────────────────────

# Build the React frontend then compile the Go binary with it embedded.
build:
	VITE_GIT_HASH=$$(git rev-parse HEAD) VITE_GIT_DATE=$$(git log -1 --format=%Y-%m-%d) npm run build --prefix frontend
	go build -o server .

## ── Deploy ───────────────────────────────────────────────────────────────────

# Build and push a new Docker image. App Runner redeploys automatically.
deploy: login
	VITE_GIT_HASH=$$(git rev-parse HEAD) VITE_GIT_DATE=$$(git log -1 --format=%Y-%m-%d) npm run build --prefix frontend
	docker build --platform linux/amd64 -t cramersmith-net .
	docker tag cramersmith-net:latest $(ECR_URI):latest
	docker push $(ECR_URI):latest
	@echo ""
	@echo "Pushed. Run 'make status' to watch the rollout."

# Check whether App Runner has finished deploying.
status:
	@aws apprunner describe-service \
		--region $(REGION) \
		--service-arn $(APP_RUNNER_ARN) \
		--query 'Service.{Status:Status,UpdatedAt:UpdatedAt}' \
		--output table

## ── Helpers ──────────────────────────────────────────────────────────────────

# Authenticate Docker with ECR. Token lasts 12 hours — re-run if push fails.
login:
	aws ecr get-login-password --region $(REGION) | \
		docker login --username AWS --password-stdin $(ECR_URI)

# Remove local build artifacts.
clean:
	rm -f server
	rm -rf frontend/dist

# Run all DB migrations against the RDS instance.
# Requires psql installed locally. DB_URL is fetched from SSM.
migrate:
	$(eval DB_URL := $(shell aws ssm get-parameter --region $(REGION) --name /cramersmith/db-url --with-decryption --query Parameter.Value --output text))
	psql "$(DB_URL)" -f db/migrations/001_create_posts.sql
	psql "$(DB_URL)" -f db/migrations/002_create_visits.sql
	psql "$(DB_URL)" -f db/migrations/003_create_dice_rolls.sql
	psql "$(DB_URL)" -f db/migrations/004_create_referral_links.sql
