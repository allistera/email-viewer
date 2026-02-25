import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { DB } from "../../workers/shared/db.js";
import { handleRetention } from "../../workers/shared/retention.js";

describe("Retention Policy", () => {
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
        snoozed_until INTEGER,
        is_archived INTEGER,
        is_read INTEGER,
        todoist_project_name TEXT,
        todoist_project_url TEXT,
        tag TEXT,
        tag_confidence REAL,
        tag_reason TEXT,
        tag_checked_at INTEGER
      );`,
      `CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages(received_at DESC);`,
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
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );`
    ];

    for (const stmt of statements) {
      await env.DB.prepare(stmt).run();
    }
  });

  it("should delete messages older than retention period", async () => {
    // Set retention to 30 days via DB setting
    const RETENTION_DAYS = 30;
    await DB.setSetting(env.DB, 'retention_days', RETENTION_DAYS.toString());

    // We pass env directly, handleRetention will read from DB
    const testEnv = {
      ...env,
      // RETENTION_DAYS: '0', // Ensure env var doesn't override if logic is correct (logic prioritizes DB)
    };

    const cutoff = Date.now() - (RETENTION_DAYS * 24 * 60 * 60 * 1000);

    // 1. Setup Data
    const oldMessageId = "old-msg-1";
    const oldMessageId2 = "old-msg-2";
    const newMessageId = "new-msg-1";

    const oldMsg = {
      id: oldMessageId,
      received_at: cutoff - 10000, // 10s older than cutoff
      from_addr: "old@example.com",
      to_addr: "me@example.com",
      subject: "Old Message",
      raw_r2_key: `raw/${oldMessageId}`,
      has_attachments: true,
      text_body: "body",
      html_body: "body",
      date_header: new Date().toISOString(),
      snippet: "snippet",
      headers_json: "{}"
    };

    const oldMsg2 = {
      id: oldMessageId2,
      received_at: cutoff - 20000,
      from_addr: "old2@example.com",
      to_addr: "me@example.com",
      subject: "Old Message 2",
      raw_r2_key: `raw/${oldMessageId2}`,
      has_attachments: false,
      text_body: "body",
      html_body: "body",
      date_header: new Date().toISOString(),
      snippet: "snippet",
      headers_json: "{}"
    };

    const newMsg = {
      id: newMessageId,
      received_at: cutoff + 10000, // 10s newer than cutoff
      from_addr: "new@example.com",
      to_addr: "me@example.com",
      subject: "New Message",
      raw_r2_key: `raw/${newMessageId}`,
      has_attachments: false,
      text_body: "body",
      html_body: "body",
      date_header: new Date().toISOString(),
      snippet: "snippet",
      headers_json: "{}"
    };

    // Insert DB
    await DB.insertMessage(env.DB, oldMsg);
    await DB.insertMessage(env.DB, oldMsg2);
    await DB.insertMessage(env.DB, newMsg);

    // Insert Attachments for oldMsg
    const attId = "att-1";
    await DB.insertAttachments(env.DB, [{
      id: attId,
      message_id: oldMessageId,
      filename: "test.txt",
      content_type: "text/plain",
      size_bytes: 10,
      sha256: "abc",
      r2_key: `att/${oldMessageId}/${attId}/test.txt`
    }]);

    // Insert dedupe
    await DB.checkDedupe(env.DB, "dedupe-old-1", oldMessageId);
    await DB.checkDedupe(env.DB, "dedupe-new-1", newMessageId);

    // Insert R2 Objects
    await env.MAILSTORE.put(`raw/${oldMessageId}`, "old content");
    await env.MAILSTORE.put(`raw/${oldMessageId2}`, "old content 2");
    await env.MAILSTORE.put(`att/${oldMessageId}/${attId}/test.txt`, "attachment content");
    await env.MAILSTORE.put(`raw/${newMessageId}`, "new content");

    // Verify Setup
    expect(await env.MAILSTORE.get(`raw/${oldMessageId}`)).not.toBeNull();

    // 2. Run Retention
    await handleRetention(testEnv);

    // 3. Verify Deletion
    // Check DB
    const oldMsgCheck = await DB.getMessage(env.DB, oldMessageId);
    expect(oldMsgCheck).toBeNull();

    const oldMsg2Check = await DB.getMessage(env.DB, oldMessageId2);
    expect(oldMsg2Check).toBeNull();

    const newMsgCheck = await DB.getMessage(env.DB, newMessageId);
    expect(newMsgCheck).not.toBeNull();

    // Check R2
    const oldRawR2 = await env.MAILSTORE.get(`raw/${oldMessageId}`);
    expect(oldRawR2).toBeNull();

    const oldAttR2 = await env.MAILSTORE.get(`att/${oldMessageId}/${attId}/test.txt`);
    expect(oldAttR2).toBeNull();

    const newRawR2 = await env.MAILSTORE.get(`raw/${newMessageId}`);
    expect(newRawR2).not.toBeNull();

    // Check Dedupe
    const dedupeOld = await env.DB.prepare("SELECT * FROM dedupe WHERE message_id = ?").bind(oldMessageId).first();
    expect(dedupeOld).toBeNull();

    const dedupeNew = await env.DB.prepare("SELECT * FROM dedupe WHERE message_id = ?").bind(newMessageId).first();
    expect(dedupeNew).not.toBeNull();
  });
});
