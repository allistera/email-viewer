-- Migration number: 0001 	 2024-01-01T00:00:00.000Z
-- Title: Initial Schema

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,                 -- UUID
  received_at INTEGER NOT NULL,         -- unix ms
  from_addr TEXT NOT NULL,
  to_addr TEXT NOT NULL,
  subject TEXT,
  date_header TEXT,
  snippet TEXT,
  has_attachments INTEGER NOT NULL DEFAULT 0,
  raw_r2_key TEXT NOT NULL,             -- raw/<id>.eml
  text_body TEXT,
  html_body TEXT,
  headers_json TEXT                     -- JSON string with selected headers
);

CREATE INDEX IF NOT EXISTS idx_messages_received_at
ON messages(received_at DESC);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,                  -- UUID
  message_id TEXT NOT NULL,
  filename TEXT,
  content_type TEXT,
  size_bytes INTEGER,
  sha256 TEXT,
  r2_key TEXT NOT NULL,                 -- att/<message_id>/<id>/<filename>
  FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attachments_message_id
ON attachments(message_id);

-- Dedupe table for idempotency on join/retry
CREATE TABLE IF NOT EXISTS dedupe (
  dedupe_key TEXT PRIMARY KEY,
  message_id TEXT NOT NULL
);
