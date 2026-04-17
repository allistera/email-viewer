import { beforeAll, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { DB } from '../../workers/shared/db.js';

describe('Inbox filtering', () => {
  beforeAll(async () => {
    const statements = [
      `PRAGMA foreign_keys = ON;`,
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        received_at INTEGER NOT NULL,
        from_addr TEXT NOT NULL,
        to_addr TEXT NOT NULL,
        subject TEXT,
        raw_r2_key TEXT NOT NULL,
        tag TEXT,
        is_archived INTEGER NOT NULL DEFAULT 0,
        is_read INTEGER NOT NULL DEFAULT 0,
        snoozed_until INTEGER
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
      );`
    ];

    for (const stmt of statements) {
      await env.DB.prepare(stmt).run();
    }

    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO messages (id, received_at, from_addr, to_addr, subject, raw_r2_key)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind('msg-inbox', now, 'alice@example.com', 'me@example.com', 'Hello', 'raw/msg-inbox').run();

    await env.DB.prepare(
      `INSERT INTO messages (id, received_at, from_addr, to_addr, subject, raw_r2_key)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind('msg-sent', now - 1000, 'me@example.com', 'bob@example.com', 'Sent item', 'raw/msg-sent').run();

    await DB.addMessageTag(env.DB, 'msg-sent', 'Sent');
  });

  it('supports excluding multiple tags from inbox queries', async () => {
    const results = await DB.listMessages(env.DB, {
      archived: false,
      excludeTag: 'Spam,Sent'
    });

    expect(results.map((message) => message.id)).toEqual(['msg-inbox']);
  });

  it('does not count Sent messages as inbox count', async () => {
    const counts = await DB.getCounts(env.DB);

    expect(counts.inbox).toBe(1);
    expect(counts.sent).toBe(1);
  });
});
