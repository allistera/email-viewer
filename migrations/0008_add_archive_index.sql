-- Migration number: 0008 	 2026-01-30T00:00:00.000Z
-- Title: Add index for is_archived column

CREATE INDEX IF NOT EXISTS idx_messages_is_archived ON messages(is_archived);
