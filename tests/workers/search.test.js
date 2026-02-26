import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { DB } from "../../workers/shared/db.js";

describe("Full Text Search", () => {
  beforeAll(async () => {
    // Initialize Database Schema
    const statements = [
      `PRAGMA foreign_keys = ON;`,

      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        received_at INTEGER NOT NULL,
        from_addr TEXT NOT NULL,
        to_addr TEXT NOT NULL,
        subject TEXT,
        date_header TEXT,
        snippet TEXT,
        has_attachments INTEGER NOT NULL DEFAULT 0,
        raw_r2_key TEXT NOT NULL,
        text_body TEXT,
        html_body TEXT,
        headers_json TEXT,
        tag TEXT,
        tag_confidence REAL,
        tag_reason TEXT,
        tag_checked_at INTEGER,
        is_archived INTEGER NOT NULL DEFAULT 0,
        todoist_project_name TEXT,
        todoist_project_url TEXT,
        is_read INTEGER NOT NULL DEFAULT 0,
        snoozed_until INTEGER
      );`,

      `CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages(received_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_messages_is_archived ON messages(is_archived);`,

      `CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        filename TEXT,
        content_type TEXT,
        size_bytes INTEGER,
        sha256 TEXT,
        r2_key TEXT NOT NULL,
        FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE
      );`,

      `CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);`,

      `CREATE TABLE IF NOT EXISTS dedupe (
        dedupe_key TEXT PRIMARY KEY,
        message_id TEXT NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at INTEGER
      );`,

      `CREATE TABLE IF NOT EXISTS message_tags (
        message_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        assigned_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
        PRIMARY KEY (message_id, tag_id),
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );`,

      `CREATE INDEX IF NOT EXISTS idx_message_tags_tag_id ON message_tags(tag_id);`,
      `CREATE INDEX IF NOT EXISTS idx_message_tags_message_id ON message_tags(message_id);`,

      `CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        subject,
        text_body,
        from_addr,
        to_addr,
        tags,
        content='messages',
        content_rowid='rowid'
      );`,

      `CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts(rowid, subject, text_body, from_addr, to_addr, tags)
        VALUES (new.rowid, new.subject, new.text_body, new.from_addr, new.to_addr, new.tag);
      END;`,

      `CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
        INSERT INTO messages_fts(messages_fts, rowid, subject, text_body, from_addr, to_addr, tags)
        VALUES('delete', old.rowid, old.subject, old.text_body, old.from_addr, old.to_addr, old.tag);
      END;`,

      `CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
        INSERT INTO messages_fts(messages_fts, rowid, subject, text_body, from_addr, to_addr, tags)
        VALUES('delete', old.rowid, old.subject, old.text_body, old.from_addr, old.to_addr, old.tag);
        INSERT INTO messages_fts(rowid, subject, text_body, from_addr, to_addr, tags)
        VALUES (new.rowid, new.subject, new.text_body, new.from_addr, new.to_addr, new.tag);
      END;`
    ];

    for (const stmt of statements) {
      await env.DB.prepare(stmt).run();
    }

    // Seed Data
    const messages = [
      {
        id: "msg-1",
        received_at: Date.now(),
        from_addr: "alice@example.com",
        to_addr: "me@example.com",
        subject: "Project Update: Alpha",
        date_header: new Date().toISOString(),
        snippet: "The alpha release is ready.",
        has_attachments: false,
        raw_r2_key: "raw/msg-1",
        text_body: "Hi, just letting you know that the alpha release is ready for testing. Please review.",
        html_body: "<p>Hi, just letting you know that the <strong>alpha release</strong> is ready for testing. Please review.</p>",
        headers_json: "{}",
        tag: null
      },
      {
        id: "msg-2",
        received_at: Date.now() - 1000,
        from_addr: "bob@example.com",
        to_addr: "me@example.com",
        subject: "Invoice #12345",
        date_header: new Date().toISOString(),
        snippet: "Please find attached invoice.",
        has_attachments: true,
        raw_r2_key: "raw/msg-2",
        text_body: "Please find attached invoice #12345 for services rendered in May.",
        html_body: "<p>Please find attached invoice #12345 for services rendered in May.</p>",
        headers_json: "{}",
        tag: "Finance" // Pre-tagged via direct insert (though API usually does it later)
      },
      {
        id: "msg-3",
        received_at: Date.now() - 2000,
        from_addr: "marketing@spammy.com",
        to_addr: "me@example.com",
        subject: "You won a lottery!",
        date_header: new Date().toISOString(),
        snippet: "Click here to claim your prize.",
        has_attachments: false,
        raw_r2_key: "raw/msg-3",
        text_body: "Click here to claim your prize. Limited time offer!",
        html_body: "<p>Click here to claim your prize.</p>",
        headers_json: "{}",
        tag: null
      }
    ];

    for (const msg of messages) {
      await DB.insertMessage(env.DB, msg);
      if (msg.tag) {
          // Manually update tag via DB helper to simulate tagging flow and trigger FTS update
          await DB.addMessageTag(env.DB, msg.id, msg.tag);
      }
    }
  });

  it("searches by unique word in subject", async () => {
    const results = await DB.listMessages(env.DB, { search: "Alpha" });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("msg-1");
  });

  it("searches by unique word in body", async () => {
    const results = await DB.listMessages(env.DB, { search: "rendered" });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("msg-2");
  });

  it("searches by sender email", async () => {
    const results = await DB.listMessages(env.DB, { search: "alice@example.com" });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("msg-1");
  });

  it("searches by partial sender email", async () => {
    const results = await DB.listMessages(env.DB, { search: "spammy" });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("msg-3");
  });

  it("searches by tag (after tagging)", async () => {
    // msg-2 was tagged with 'Finance'
    const results = await DB.listMessages(env.DB, { search: "Finance" });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("msg-2");
  });

  it("searches with multiple terms (AND logic)", async () => {
    // "alpha" in subject, "testing" in body of msg-1
    const results = await DB.listMessages(env.DB, { search: "alpha testing" });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("msg-1");
  });

  it("searches with prefix (partial word)", async () => {
    // "inv" matches "invoice"
    const results = await DB.listMessages(env.DB, { search: "inv" });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("msg-2");
  });

  it("returns empty array when no results found", async () => {
    const results = await DB.listMessages(env.DB, { search: "nonexistent" });
    expect(results.length).toBe(0);
  });

  it("updates FTS index when tag is added later", async () => {
    // Tag msg-3 as 'Spam'
    await DB.addMessageTag(env.DB, "msg-3", "Spam");

    // Search for 'Spam'
    const results = await DB.listMessages(env.DB, { search: "Spam" });
    expect(results.length).toBeGreaterThan(0);
    const msg3 = results.find(m => m.id === "msg-3");
    expect(msg3).toBeDefined();
  });
});
