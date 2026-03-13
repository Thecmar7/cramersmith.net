-- All queries used by the visits counter.

-- name: IncrementAndGetVisits
-- Atomically increments the visit counter and returns the new value.
UPDATE visits SET count = count + 1 WHERE id = 1 RETURNING count;
