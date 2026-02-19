-- Migration number: 0013    2026-02-19T00:00:00.000Z
-- Title: Add snooze support for messages

ALTER TABLE messages ADD COLUMN snoozed_until INTEGER;

CREATE INDEX IF NOT EXISTS idx_messages_snoozed_until
ON messages(snoozed_until);
