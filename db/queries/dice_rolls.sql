-- All queries used by the dice rolls API.

-- name: SaveDiceRoll
-- Inserts a dice roll and returns the full row.
INSERT INTO dice_rolls (roll_type, dice_count, die_size, modifier, rolls, total)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, roll_type, dice_count, die_size, modifier, rolls, total, created_at;

-- name: ListDiceRolls
-- Returns the 50 most recent dice rolls.
SELECT id, roll_type, dice_count, die_size, modifier, rolls, total, created_at
FROM dice_rolls
ORDER BY created_at DESC
LIMIT 50;
