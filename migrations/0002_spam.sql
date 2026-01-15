-- Migration number: 0002 	 2024-01-01T00:00:01.000Z
-- Title: Spam Classification Fields

ALTER TABLE messages ADD COLUMN spam_status TEXT DEFAULT 'unknown'; -- ham, spam, unknown
ALTER TABLE messages ADD COLUMN spam_confidence REAL;
ALTER TABLE messages ADD COLUMN spam_reason TEXT;
ALTER TABLE messages ADD COLUMN spam_checked_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_messages_spam_status
ON messages(spam_status);
