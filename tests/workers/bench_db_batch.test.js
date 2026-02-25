import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { DB } from "../../workers/shared/db.js";

describe("DB Batch Limits", () => {
  beforeAll(async () => {
    // Initialize Database Schema
    const statements = [
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        user_id TEXT,
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

      `CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        filename TEXT,
        content_type TEXT,
        size_bytes INTEGER,
        sha256 TEXT,
        r2_key TEXT NOT NULL,
        FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE
      );`
    ];

    for (const stmt of statements) {
      await env.DB.prepare(stmt).run();
    }
  });

  it("should handle inserting a large number of attachments by batching", async () => {
    const messageId = "msg_batch_test";
    await DB.insertMessage(env.DB, {
        id: messageId,
        user_id: 'test-user',
        received_at: Date.now(),
        from_addr: "test@example.com",
        to_addr: "me@example.com",
        subject: "Batch Test",
        date_header: new Date().toISOString(),
        snippet: "test",
        has_attachments: true,
        raw_r2_key: "key",
        text_body: "body",
        html_body: "body",
        headers_json: "{}",
    });

    const attachments = [];
    const count = 1000; // Greater than 100 to test batch limit
    for (let i = 0; i < count; i++) {
        attachments.push({
            id: `att_${i}`,
            message_id: messageId,
            filename: `file_${i}.txt`,
            content_type: "text/plain",
            size_bytes: 100,
            sha256: "hash",
            r2_key: `key_${i}`
        });
    }

    // This should fail if batch limit is enforced and not handled
    try {
        await DB.insertAttachments(env.DB, attachments);
    } catch (e) {
        console.error("Insert failed:", e);
        throw e;
    }

    // Verify count
    const row = await env.DB.prepare("SELECT count(*) as count FROM attachments WHERE message_id = ?").bind(messageId).first();
    expect(row.count).toBe(count);
  });
});
