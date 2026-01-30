-- Migration number: 0007 	 2024-05-24T00:00:00.000Z
-- Title: Add FTS5 Support

-- Create Virtual Table for Search including tags
CREATE VIRTUAL TABLE messages_fts USING fts5(
  subject, 
  text_body, 
  from_addr, 
  to_addr, 
  tags,
  content='messages', 
  content_rowid='rowid'
);

-- Triggers to keep FTS index in sync with insertions
CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, subject, text_body, from_addr, to_addr, tags) 
  VALUES (new.rowid, new.subject, new.text_body, new.from_addr, new.to_addr, new.tag);
END;

-- Triggers for deletion
CREATE TRIGGER messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, subject, text_body, from_addr, to_addr, tags) 
  VALUES('delete', old.rowid, old.subject, old.text_body, old.from_addr, old.to_addr, old.tag);
END;

-- Triggers for updates
CREATE TRIGGER messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, subject, text_body, from_addr, to_addr, tags) 
  VALUES('delete', old.rowid, old.subject, old.text_body, old.from_addr, old.to_addr, old.tag);
  INSERT INTO messages_fts(rowid, subject, text_body, from_addr, to_addr, tags) 
  VALUES (new.rowid, new.subject, new.text_body, new.from_addr, new.to_addr, new.tag);
END;

-- Populate existing data
INSERT INTO messages_fts(rowid, subject, text_body, from_addr, to_addr, tags)
SELECT rowid, subject, text_body, from_addr, to_addr, tag FROM messages;
