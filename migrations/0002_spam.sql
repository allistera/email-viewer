-- Add spam classification fields to messages table

ALTER TABLE messages ADD COLUMN spam_status TEXT DEFAULT 'unknown';
ALTER TABLE messages ADD COLUMN spam_confidence REAL;
ALTER TABLE messages ADD COLUMN spam_reason TEXT;
ALTER TABLE messages ADD COLUMN spam_checked_at INTEGER;

-- Create index for filtering by spam status
CREATE INDEX IF NOT EXISTS idx_messages_spam_status
ON messages(spam_status, received_at DESC);
