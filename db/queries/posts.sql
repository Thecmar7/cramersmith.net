-- All queries used by the posts API.

-- name: ListPosts
-- Returns published posts newest-first, optionally filtered by tag.
-- Pass NULL for $1 to return all published posts.
SELECT id, type, title, slug, content, url, url_title, image_url, tags, draft, published_at, created_at
FROM posts
WHERE NOT draft
AND ($1::text IS NULL OR $1 = ANY(tags))
ORDER BY published_at DESC;

-- name: ListAllPosts
-- Returns all posts including drafts (admin only), newest created first.
SELECT id, type, title, slug, content, url, url_title, image_url, tags, draft, published_at, created_at
FROM posts
ORDER BY created_at DESC;

-- name: GetPostBySlug
-- Returns a single published post by slug.
SELECT id, type, title, slug, content, url, url_title, image_url, tags, draft, published_at, created_at
FROM posts
WHERE slug = $1 AND NOT draft;

-- name: CreatePost
-- Inserts a new post and returns the full row.
-- Pass published_at as NULL for drafts, NOW() for published posts.
INSERT INTO posts (type, title, slug, content, url, url_title, image_url, tags, draft, published_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING id, type, title, slug, content, url, url_title, image_url, tags, draft, published_at, created_at;

-- name: PublishPost
-- Marks a draft as published and records the publish time.
UPDATE posts
SET draft = false, published_at = NOW()
WHERE id = $1
RETURNING id, type, title, slug, content, url, url_title, image_url, tags, draft, published_at, created_at;

-- name: DeletePost
-- Deletes a post by ID.
DELETE FROM posts WHERE id = $1;
