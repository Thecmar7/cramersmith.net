-- Migration 002: Add image_url to posts
ALTER TABLE posts ADD COLUMN image_url TEXT;
