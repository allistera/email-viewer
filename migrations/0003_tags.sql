-- Migration number: 0003 	 2024-01-15T00:00:00.000Z
-- Title: Add tagging fields

ALTER TABLE messages ADD COLUMN tag TEXT;
ALTER TABLE messages ADD COLUMN tag_confidence REAL;
ALTER TABLE messages ADD COLUMN tag_reason TEXT;
ALTER TABLE messages ADD COLUMN tagged_at INTEGER;
