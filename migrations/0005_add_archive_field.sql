-- Migration number: 0005 	 2024-05-22T00:00:00.000Z
-- Title: Add is_archived field

ALTER TABLE messages ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;
