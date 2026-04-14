-- Migration 005: Add image_url to posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url TEXT;
