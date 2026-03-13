# Stage 1: Build the React frontend
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the Go binary (with React dist embedded)
FROM golang:1.25-alpine AS backend
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /app/frontend/dist ./frontend/dist
RUN CGO_ENABLED=0 GOOS=linux go build -o server .

# Stage 3: Minimal runtime image (alpine needed for SSL certs — AWS SDK requires HTTPS)
FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=backend /app/server /server
EXPOSE 8080
ENTRYPOINT ["/server"]
