-- Migration number: 0014 	 2024-05-22T00:00:00.000Z
-- Title: Multi User Support

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  created_at INTEGER NOT NULL
);

-- Create user_addresses table
CREATE TABLE IF NOT EXISTS user_addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  address TEXT NOT NULL UNIQUE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create api_tokens table
CREATE TABLE IF NOT EXISTS api_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER,
  expires_at INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add user_id to messages
ALTER TABLE messages ADD COLUMN user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);

-- Add user_id to tags
ALTER TABLE tags ADD COLUMN user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

-- Add user_id to tagging_rules
ALTER TABLE tagging_rules ADD COLUMN user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_tagging_rules_user_id ON tagging_rules(user_id);

-- Create Default Admin User
INSERT OR IGNORE INTO users (id, username, created_at)
VALUES ('default-user-id', 'admin', strftime('%s','now') * 1000);

-- Backfill messages
UPDATE messages SET user_id = 'default-user-id' WHERE user_id IS NULL;

-- Backfill tags
UPDATE tags SET user_id = 'default-user-id' WHERE user_id IS NULL;

-- Backfill tagging_rules
UPDATE tagging_rules SET user_id = 'default-user-id' WHERE user_id IS NULL;
