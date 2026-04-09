-- All queries used by referral link tracking.

-- name: CreateReferralLink
-- Inserts a new referral link; does nothing if the token already exists.
INSERT INTO referral_links (token, label)
VALUES ($1, $2)
ON CONFLICT (token) DO NOTHING
RETURNING token, label, count, created_at;

-- name: IncrementReferralLink
-- Increments the hit count for a token (silently ignores unknown tokens).
UPDATE referral_links SET count = count + 1 WHERE token = $1;

-- name: ListReferralLinks
-- Returns all referral links newest-first.
SELECT token, label, count, created_at FROM referral_links ORDER BY created_at DESC;
