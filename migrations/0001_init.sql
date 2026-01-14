-- Initial schema for email inbox app
-- Creates messages, attachments, and dedupe tables

PRAGMA foreign_keys = ON;

-- Messages table: stores email metadata and bodies
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,                 -- UUID
  received_at INTEGER NOT NULL,        -- unix timestamp (ms)
  from_addr TEXT NOT NULL,
  to_addr TEXT NOT NULL,
  subject TEXT,
  date_header TEXT,                    -- Date header from email
  snippet TEXT,                        -- First ~300 chars for preview
  has_attachments INTEGER NOT NULL DEFAULT 0,
  raw_r2_key TEXT NOT NULL,            -- R2 key: raw/<id>.eml
  text_body TEXT,                      -- Plain text body
  html_body TEXT,                      -- HTML body
  headers_json TEXT                    -- JSON string with selected headers
);

CREATE INDEX IF NOT EXISTS idx_messages_received_at
ON messages(received_at DESC);

-- Attachments table: stores attachment metadata
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,                 -- UUID
  message_id TEXT NOT NULL,
  filename TEXT,
  content_type TEXT,
  size_bytes INTEGER,
  sha256 TEXT,
  r2_key TEXT NOT NULL,                -- R2 key: att/<message_id>/<id>/<filename>
  FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attachments_message_id
ON attachments(message_id);

-- Dedupe table: prevents duplicate email processing
CREATE TABLE IF NOT EXISTS dedupe (
  dedupe_key TEXT PRIMARY KEY,         -- sha256 hash for deduplication
  message_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dedupe_message_id
ON dedupe(message_id);
