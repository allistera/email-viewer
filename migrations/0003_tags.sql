-- Migration number: 0003 	 2024-11-06T00:00:00.000Z
-- Title: Add tagging fields

ALTER TABLE messages ADD COLUMN tag TEXT;
ALTER TABLE messages ADD COLUMN tag_confidence REAL;
ALTER TABLE messages ADD COLUMN tag_reason TEXT;
ALTER TABLE messages ADD COLUMN tag_checked_at INTEGER;
