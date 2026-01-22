-- Migration number: 0004 	 2024-01-22T00:00:00.000Z
-- Title: Create tags table

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at INTEGER
);

-- Seed initial tags if empty (optional, but good for migration)
-- We won't seed here to keep it clean, relying on API to create them.
