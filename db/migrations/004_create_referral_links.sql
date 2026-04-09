-- Migration 004: Create referral links table
-- Run this once after 003_create_dice_rolls.sql.
-- To apply: psql $DATABASE_URL -f db/migrations/004_create_referral_links.sql

CREATE TABLE IF NOT EXISTS referral_links (
    token      TEXT        PRIMARY KEY,
    label      TEXT        NOT NULL,
    count      BIGINT      NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
