ECR_URI        = YOUR-ECR-URI
APP_RUNNER_ARN = YOUR-APP-RUNNER-ARN
REGION         = us-west-2

.PHONY: dev run build deploy login status clean

## ── Local development ────────────────────────────────────────────────────────

# Start the Vite dev server with hot reload on http://localhost:5173
# Use this when working on the frontend — changes appear instantly.
dev:
	cd frontend && npm run dev

# Build everything and run the full Go server on http://localhost:8080
# Use this to test exactly what will be deployed (no hot reload).
run: build
	./server

## ── Build ────────────────────────────────────────────────────────────────────

# Build the React frontend then compile the Go binary with it embedded.
build:
	npm run build --prefix frontend
	go build -o server .

## ── Deploy ───────────────────────────────────────────────────────────────────

# Build and push a new Docker image. App Runner redeploys automatically.
deploy: login
	npm run build --prefix frontend
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
