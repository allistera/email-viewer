-- Migration number: 0012
-- Title: Add indices for contacts search

CREATE INDEX IF NOT EXISTS idx_messages_from_addr ON messages(from_addr);
CREATE INDEX IF NOT EXISTS idx_messages_to_addr ON messages(to_addr);
