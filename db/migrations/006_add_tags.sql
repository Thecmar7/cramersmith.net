-- Migration 006: Add tags array to posts
ALTER TABLE posts ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';
