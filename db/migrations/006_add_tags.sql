-- Migration 006: Add tags array to posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
