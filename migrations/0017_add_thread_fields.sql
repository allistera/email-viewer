-- Add email thread tracking fields
ALTER TABLE messages ADD COLUMN message_id_header TEXT;
ALTER TABLE messages ADD COLUMN in_reply_to TEXT;
ALTER TABLE messages ADD COLUMN thread_id TEXT;

-- Index for fast thread lookups
CREATE INDEX IF NOT EXISTS idx_messages_message_id_header ON messages(message_id_header);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
