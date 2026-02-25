import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { ApiRouter } from "../../workers/api/routes.js";
import { DB } from "../../workers/shared/db.js";

describe("Attachment Cache Control", () => {
  beforeAll(async () => {
    // Initialize Database Schema
    const statements = [
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,                 -- UUID
        received_at INTEGER NOT NULL,         -- unix ms
        from_addr TEXT NOT NULL,
        to_addr TEXT NOT NULL,
        subject TEXT,
        date_header TEXT,
        snippet TEXT,
        has_attachments INTEGER NOT NULL DEFAULT 0,
        raw_r2_key TEXT NOT NULL,             -- raw/<id>.eml
        text_body TEXT,
        html_body TEXT,
        headers_json TEXT,                    -- JSON string with selected headers
        snoozed_until INTEGER
      );`,

      `CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,                  -- UUID
        message_id TEXT NOT NULL,
        filename TEXT,
        content_type TEXT,
        size_bytes INTEGER,
        sha256 TEXT,
        r2_key TEXT NOT NULL,                 -- att/<message_id>/<id>/<filename>
        FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE
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
  });

  it("should have correct Cache-Control header for attachments", async () => {
    const messageId = "123e4567-e89b-42d3-8456-426614174000";
    const attachmentId = "123e4567-e89b-42d3-8456-426614174001";
    const r2Key = `att/${messageId}/${attachmentId}/test.txt`;

    // 1. Insert Message
    await DB.insertMessage(env.DB, {
      id: messageId,
      received_at: Date.now(),
      from_addr: "test@example.com",
      to_addr: "me@example.com",
      subject: "Test Attachment",
      date_header: new Date().toISOString(),
      snippet: "test",
      has_attachments: true,
      raw_r2_key: "raw/test.eml",
      text_body: "body",
      html_body: "body",
      headers_json: "{}"
    });

    // 2. Insert Attachment manually because DB.insertAttachments might have logic we want to bypass or keep simple
    await env.DB.prepare(`
      INSERT INTO attachments (id, message_id, filename, content_type, size_bytes, sha256, r2_key)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      attachmentId,
      messageId,
      "test.txt",
      "text/plain",
      12,
      "hash",
      r2Key
    ).run();

    // 3. Mock R2
    const mockMailstore = {
      get: async (key) => {
        if (key === r2Key) {
          return {
            body: "Hello World!",
            writeHttpMetadata: () => {}
          };
        }
        return null;
      }
    };
    const testEnv = { ...env, MAILSTORE: mockMailstore };

    // 4. Call API
    const request = new Request(`https://example.com/api/messages/${messageId}/attachments/${attachmentId}`);
    const response = await ApiRouter.handle(request.url, request, testEnv);

    // 5. Assertions
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hello World!");

    // Verify optimization
    const cacheControl = response.headers.get("Cache-Control");
    expect(cacheControl).toBe("public, max-age=31536000, immutable");
  });
});
