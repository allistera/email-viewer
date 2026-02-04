-- Migration number: 0011
-- Title: Add is_read field for unread/read message styling

ALTER TABLE messages ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0;
