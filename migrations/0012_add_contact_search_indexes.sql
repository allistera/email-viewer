-- Migration number: 0012    2026-02-06T00:00:00.000Z
-- Title: Add indexes for contacts prefix search

CREATE INDEX IF NOT EXISTS idx_messages_from_addr_nocase
ON messages(from_addr COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_messages_to_addr_nocase
ON messages(to_addr COLLATE NOCASE);
