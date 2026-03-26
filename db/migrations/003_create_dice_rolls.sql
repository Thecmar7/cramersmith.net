-- Migration 003: Create dice_rolls table
-- Run this once against the database to initialize the schema.
-- To apply: psql $DATABASE_URL -f db/migrations/003_create_dice_rolls.sql

CREATE TABLE IF NOT EXISTS dice_rolls (
    id          SERIAL      PRIMARY KEY,
    roll_type   TEXT        NOT NULL DEFAULT 'general',
    dice_count  INT         NOT NULL DEFAULT 1,
    die_size    INT         NOT NULL,
    modifier    INT         NOT NULL DEFAULT 0,
    rolls       integer[]   NOT NULL,
    total       INT         NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
