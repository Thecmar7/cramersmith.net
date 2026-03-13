-- Migration 001: Create posts table
-- Run this once against the database to initialize the schema.
-- To apply: psql $DATABASE_URL -f db/migrations/001_create_posts.sql

CREATE TABLE IF NOT EXISTS posts (
    id         SERIAL PRIMARY KEY,
    type       TEXT        NOT NULL CHECK (type IN ('thought', 'link')),
    content    TEXT        NOT NULL,
    url        TEXT,
    url_title  TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
