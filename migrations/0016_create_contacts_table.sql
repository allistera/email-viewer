-- Migration number: 0016	 2026-04-14T00:00:00.000Z
-- Title: Create contacts table for compose autocomplete

CREATE TABLE IF NOT EXISTS contacts (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  display_name TEXT,
  first_seen_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL,
  last_direction TEXT NOT NULL DEFAULT 'inbound' CHECK(last_direction IN ('inbound', 'outbound'))
);

CREATE INDEX IF NOT EXISTS idx_contacts_email_nocase
ON contacts(email COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_contacts_last_used_at
ON contacts(last_used_at DESC);

-- Best-effort backfill from existing messages.
INSERT INTO contacts (email, first_seen_at, last_used_at, last_direction)
SELECT from_addr, MIN(received_at), MAX(received_at), 'inbound'
FROM messages
WHERE from_addr IS NOT NULL AND TRIM(from_addr) <> ''
GROUP BY LOWER(from_addr)
ON CONFLICT(email) DO UPDATE SET
  first_seen_at = MIN(contacts.first_seen_at, excluded.first_seen_at),
  last_used_at = MAX(contacts.last_used_at, excluded.last_used_at),
  last_direction = CASE
    WHEN excluded.last_used_at >= contacts.last_used_at THEN excluded.last_direction
    ELSE contacts.last_direction
  END;

INSERT INTO contacts (email, first_seen_at, last_used_at, last_direction)
SELECT to_addr, MIN(received_at), MAX(received_at), 'outbound'
FROM messages
WHERE to_addr IS NOT NULL AND TRIM(to_addr) <> ''
GROUP BY LOWER(to_addr)
ON CONFLICT(email) DO UPDATE SET
  first_seen_at = MIN(contacts.first_seen_at, excluded.first_seen_at),
  last_used_at = MAX(contacts.last_used_at, excluded.last_used_at),
  last_direction = CASE
    WHEN excluded.last_used_at >= contacts.last_used_at THEN excluded.last_direction
    ELSE contacts.last_direction
  END;
