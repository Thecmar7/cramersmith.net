-- Migration 008: Add blog post type with title and slug
ALTER TABLE posts ADD COLUMN title TEXT;
ALTER TABLE posts ADD COLUMN slug  TEXT UNIQUE;

-- Expand the type check constraint to allow 'blog'.
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_type_check;
ALTER TABLE posts ADD  CONSTRAINT posts_type_check CHECK (type IN ('thought', 'link', 'blog'));
