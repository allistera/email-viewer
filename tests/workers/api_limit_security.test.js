import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { ApiRouter } from "../../workers/api/routes.js";

describe("Message List API Security", () => {
  beforeAll(async () => {
    // Initialize Database Schema (Minimal for this test)
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

      `CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        subject,
        snippet,
        text_body,
        html_body,
        from_addr,
        to_addr,
        content=messages,
        content_rowid=rowid
      );`,

      `CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS message_tags (
        message_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (message_id, tag_id),
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );`
    ];

    for (const stmt of statements) {
      await env.DB.prepare(stmt).run();
    }

    // Insert 80 dummy messages
    const batchSize = 40;
    const totalMessages = 80;

    for (let i = 0; i < totalMessages; i += batchSize) {
      const batch = [];
      const stmt = env.DB.prepare(`
        INSERT INTO messages (id, received_at, from_addr, to_addr, raw_r2_key, subject)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (let j = 0; j < batchSize; j++) {
        const id = `msg-${i + j}`;
        batch.push(stmt.bind(
          id,
          Date.now() - (i + j) * 1000,
          'sender@example.com',
          'me@example.com',
          'key',
          `Message ${i + j}`
        ));
      }
      await env.DB.batch(batch);
    }
  });

  it("should clamp the limit to 50 items (security fix)", async () => {
    // Request 1000 items
    // Should be clamped to 50

    const request = new Request("https://example.com/api/messages?limit=1000", {
      method: "GET",
    });

    const response = await ApiRouter.handle(request.url, request, env);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.items).toBeDefined();

    // Check length
    // Should be clamped to 50
    expect(body.items.length).toBe(50);
  });
});
