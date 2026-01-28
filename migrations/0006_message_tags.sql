-- Migration number: 0006 	 2024-05-23T00:00:00.000Z
-- Title: Support multiple tags per message

CREATE TABLE IF NOT EXISTS message_tags (
  message_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  assigned_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  PRIMARY KEY (message_id, tag_id),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_message_tags_tag_id ON message_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_message_tags_message_id ON message_tags(message_id);

-- Migrate existing tags
INSERT OR IGNORE INTO message_tags (message_id, tag_id)
SELECT m.id, t.id 
FROM messages m 
JOIN tags t ON m.tag = t.name 
WHERE m.tag IS NOT NULL;
