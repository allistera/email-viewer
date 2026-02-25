import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { DB } from "../../workers/shared/db.js";

describe("Multi-User Isolation", () => {
  beforeAll(async () => {
    // Schema setup
    const statements = [
      `PRAGMA foreign_keys = ON;`,
      `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT, password_hash TEXT, created_at INTEGER);`,
      `CREATE TABLE IF NOT EXISTS api_tokens (token TEXT PRIMARY KEY, user_id TEXT, created_at INTEGER, expires_at INTEGER);`,
      `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, user_id TEXT, received_at INTEGER, from_addr TEXT, to_addr TEXT, subject TEXT, date_header TEXT, snippet TEXT, has_attachments INTEGER DEFAULT 0, raw_r2_key TEXT, text_body TEXT, html_body TEXT, headers_json TEXT, tag TEXT, tag_confidence REAL, tag_reason TEXT, tag_checked_at INTEGER, is_archived INTEGER DEFAULT 0, snoozed_until INTEGER, is_read INTEGER DEFAULT 0, todoist_project_name TEXT, todoist_project_url TEXT);`,
      `CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(subject, content=messages, content_rowid=rowid);`,
      `CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, created_at INTEGER);`,
      `CREATE TABLE IF NOT EXISTS message_tags (message_id TEXT, tag_id TEXT, PRIMARY KEY(message_id, tag_id));`,
      `CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, message_id TEXT NOT NULL, filename TEXT, content_type TEXT, size_bytes INTEGER, sha256 TEXT, r2_key TEXT NOT NULL, FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE);`,
      // Indexes
      `CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);`
    ];
    for (const stmt of statements) {
      await env.DB.prepare(stmt).run();
    }

    // Create Users
    await env.DB.prepare("INSERT INTO users (id, username, created_at) VALUES ('user-a', 'alice', 0)").run();
    await env.DB.prepare("INSERT INTO users (id, username, created_at) VALUES ('user-b', 'bob', 0)").run();

    // Seed Messages
    const baseMsg = {
        received_at: 100,
        from_addr: 'sender@example.com',
        to_addr: 'me@example.com',
        date_header: new Date().toISOString(),
        snippet: 'Snippet',
        has_attachments: false,
        raw_r2_key: 'key',
        text_body: 'Body',
        html_body: null,
        headers_json: '{}',
        snoozed_until: null
    };

    await DB.insertMessage(env.DB, { ...baseMsg, id: 'msg-a', user_id: 'user-a', subject: 'A' });
    await DB.insertMessage(env.DB, { ...baseMsg, id: 'msg-b', user_id: 'user-b', subject: 'B' });
  });

  it("isolates messages between users", async () => {
    // List for User A
    const listA = await DB.listMessages(env.DB, { userId: 'user-a' });
    expect(listA.length).toBe(1);
    expect(listA[0].id).toBe('msg-a');

    // List for User B
    const listB = await DB.listMessages(env.DB, { userId: 'user-b' });
    expect(listB.length).toBe(1);
    expect(listB[0].id).toBe('msg-b');
  });

  it("isolates tags between users", async () => {
    // Create Tag 'Work' for both
    const tagA = await DB.createTag(env.DB, 'Work', 'user-a');
    const tagB = await DB.createTag(env.DB, 'Work', 'user-b');

    expect(tagA.id).not.toBe(tagB.id);

    // Get Tags A
    const tagsA = await DB.getTags(env.DB, 'user-a');
    // Should have Spam, Sent, Work
    expect(tagsA.find(t => t.name === 'Work').id).toBe(tagA.id);
    expect(tagsA.some(t => t.id === tagB.id)).toBe(false);

    // Get Tags B
    const tagsB = await DB.getTags(env.DB, 'user-b');
    expect(tagsB.find(t => t.name === 'Work').id).toBe(tagB.id);
  });

  it("prevents accessing another user's message by ID", async () => {
    const msg = await DB.getMessage(env.DB, 'msg-b', 'user-a');
    expect(msg).toBeNull();

    const msgOK = await DB.getMessage(env.DB, 'msg-b', 'user-b');
    expect(msgOK).not.toBeNull();
    expect(msgOK.id).toBe('msg-b');
  });
});
