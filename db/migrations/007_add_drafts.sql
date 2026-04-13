-- Migration 007: Add draft support to posts
ALTER TABLE posts ADD COLUMN draft BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN published_at TIMESTAMPTZ;

-- Treat all existing posts as already published, using created_at as their publish time.
UPDATE posts SET published_at = created_at WHERE published_at IS NULL;
