-- All queries used by the posts API.

-- name: ListPosts
-- Returns all posts newest-first.
SELECT id, type, content, url, url_title, created_at
FROM posts
ORDER BY created_at DESC;

-- name: CreatePost
-- Inserts a new post and returns the full row.
INSERT INTO posts (type, content, url, url_title)
VALUES ($1, $2, $3, $4)
RETURNING id, type, content, url, url_title, created_at;

-- name: DeletePost
-- Deletes a post by ID.
DELETE FROM posts WHERE id = $1;
