-- Migration 002: Create visits counter table
-- Run this once after 001_create_posts.sql.
-- To apply: psql $DATABASE_URL -f db/migrations/002_create_visits.sql

CREATE TABLE IF NOT EXISTS visits (
    id    INTEGER PRIMARY KEY DEFAULT 1,
    count BIGINT  NOT NULL DEFAULT 0,
    CONSTRAINT single_row CHECK (id = 1)
);

-- Seed the single counter row
INSERT INTO visits (id, count) VALUES (1, 0) ON CONFLICT DO NOTHING;
