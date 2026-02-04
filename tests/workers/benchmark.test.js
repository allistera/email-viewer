import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { DB } from "../../workers/shared/db.js";

describe("Benchmark FTS", () => {
  beforeAll(async () => {
    // Initialize Database Schema
    // Split by statement because D1 prepare/run typically handles one statement (unless exec is fully supported and robust)
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
        is_read INTEGER NOT NULL DEFAULT 0
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
      END;`,

      `CREATE TABLE IF NOT EXISTS tagging_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        match_from TEXT,
        match_to TEXT,
        match_subject TEXT,
        match_body TEXT,
        tag_name TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        is_enabled INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );`,

      `CREATE INDEX IF NOT EXISTS idx_tagging_rules_enabled_priority
      ON tagging_rules (is_enabled, priority DESC);`
    ];

    for (const stmt of statements) {
      await env.DB.prepare(stmt).run();
    }

    // Seed Data
    const messages = [];
    const subjects = [
      "Urgent Meeting",
      "Urgent Update",
      "Team Meeting",
      "Project Update",
      "Invoice Attached",
      "Welcome to our service",
      "Weekly Newsletter",
      "Order Confirmed",
      "Shipping Notification",
      "Security Alert"
    ];
    const bodies = [
      "Please review the attached document.",
      "This is urgent.",
      "Let's meet.",
      "Here is the update for the project.",
      "Your invoice is ready.",
      "Thanks for signing up.",
      "Here are the highlights of the week.",
      "Your order has been confirmed.",
      "Your package has shipped.",
      "We detected a login from a new device."
    ];
    const senders = ["boss@example.com", "team@example.com", "billing@example.com", "support@example.com", "marketing@example.com", "orders@example.com", "shipping@example.com", "security@example.com", "events@example.com", "feedback@example.com"];

    for (let i = 0; i < 1000; i++) {
        const id = crypto.randomUUID();
        const subject = subjects[i % subjects.length] + " " + i;
        const body = bodies[i % bodies.length] + " This is message number " + i;
        const sender = senders[i % senders.length];

        messages.push({
            id,
            received_at: Date.now() - i * 1000,
            from_addr: sender,
            to_addr: "me@example.com",
            subject,
            date_header: new Date().toISOString(),
            snippet: body.substring(0, 50),
            has_attachments: false,
            raw_r2_key: `raw/${id}`,
            text_body: body,
            html_body: `<p>${body}</p>`,
            headers_json: "{}",
            tag: null
        });
    }

    // Insert in batches
    for (const msg of messages) {
         await DB.insertMessage(env.DB, msg);
    }
  }, 60000); // 60s timeout for seeding

  it("benchmarks search performance", async () => {
    const searchTerm = "Urgent Meeting";
    const start = performance.now();
    const iterations = 20;

    for (let i = 0; i < iterations; i++) {
      const results = await DB.listMessages(env.DB, { search: searchTerm, limit: 20 });
      expect(results.length).toBeGreaterThan(0);
    }

    const end = performance.now();
    const avgTime = (end - start) / iterations;
    console.log(`Average execution time for search "${searchTerm}": ${avgTime.toFixed(2)}ms`);

    // Log count for verification
    const results = await DB.listMessages(env.DB, { search: searchTerm, limit: 1000 });
    console.log(`Number of results for search "${searchTerm}": ${results.length}`);
    expect(results.length).toBe(100);

    // Verify negative match (partial match shouldn't be returned)
    const resultsUrgentUpdate = await DB.listMessages(env.DB, { search: "Urgent Update", limit: 1000 });
    expect(resultsUrgentUpdate.length).toBe(100);

    const resultsTeamMeeting = await DB.listMessages(env.DB, { search: "Team Meeting", limit: 1000 });
    expect(resultsTeamMeeting.length).toBe(100);
  });
});
