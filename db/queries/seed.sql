-- Seed data for local development.
-- To apply: psql $DATABASE_URL -f db/queries/seed.sql

INSERT INTO posts (type, content, url, url_title) VALUES
  ('thought', 'Site is live. Built with Go + React, deployed on AWS App Runner.', NULL, NULL),
  ('link',    'The Go embed package is underrated for single-binary deploys.', 'https://pkg.go.dev/embed', 'embed package - Go Packages');
