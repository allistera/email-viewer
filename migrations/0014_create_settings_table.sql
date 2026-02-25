-- Migration number: 0014 	 2026-02-25T00:00:00.000Z
-- Title: Create Settings Table

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
