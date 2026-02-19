import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { ApiRouter } from "../../workers/api/routes.js";

describe("Contacts API Union Correctness", () => {
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

      `CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages(received_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_messages_snoozed_until ON messages(snoozed_until);`,
      `CREATE INDEX IF NOT EXISTS idx_messages_from_addr_nocase ON messages(from_addr COLLATE NOCASE);`,
      `CREATE INDEX IF NOT EXISTS idx_messages_to_addr_nocase ON messages(to_addr COLLATE NOCASE);`
    ];

    for (const stmt of statements) {
      await env.DB.prepare(stmt).run();
    }

    // Insert Test Data
    const now = Date.now();
    const oneDayAgo = now - 86400000;
    const twoDaysAgo = now - 172800000;

    // 1. Message FROM alice (older)
    await env.DB.prepare(`
      INSERT INTO messages (id, received_at, from_addr, to_addr, raw_r2_key)
      VALUES (?, ?, ?, ?, ?)
    `).bind('msg-1', twoDaysAgo, 'alice@example.com', 'me@myinbox.com', 'raw/1').run();

    // 2. Message TO alice (newer)
    await env.DB.prepare(`
      INSERT INTO messages (id, received_at, from_addr, to_addr, raw_r2_key)
      VALUES (?, ?, ?, ?, ?)
    `).bind('msg-2', oneDayAgo, 'me@myinbox.com', 'alice@example.com', 'raw/2').run();

    // 3. Message FROM bob (irrelevant)
    await env.DB.prepare(`
      INSERT INTO messages (id, received_at, from_addr, to_addr, raw_r2_key)
      VALUES (?, ?, ?, ?, ?)
    `).bind('msg-3', now, 'bob@example.com', 'me@myinbox.com', 'raw/3').run();
  });

  it("merges duplicate contacts and picks the latest timestamp", async () => {
    // We expect 'alice@example.com' to appear once, with 'last_used' = oneDayAgo (not twoDaysAgo)

    // Construct request
    const request = new Request("https://example.com/api/contacts?q=ali&limit=10", {
      method: "GET",
    });

    const response = await ApiRouter.handle(request.url, request, env);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.contacts).toBeDefined();

    const aliceContact = body.contacts.find(c => c.email === 'alice@example.com');
    expect(aliceContact).toBeDefined();

    // Check duplication: filtering by email should yield exactly 1 result
    const aliceMatches = body.contacts.filter(c => c.email === 'alice@example.com');
    expect(aliceMatches.length).toBe(1);

    // Check timestamp correctness
    // We inserted data with specific timestamps.
    // msg-2 (TO alice) was oneDayAgo. msg-1 (FROM alice) was twoDaysAgo.
    // MAX(last_used) should be oneDayAgo.

    // We need to fetch the exact timestamps from the DB setup to be precise, or just check relative order if we had more checks.
    // Here we can check if it matches the 'newer' timestamp.

    // However, since we used Date.now() inside beforeAll, we can't hardcode the expected value easily unless we stored it.
    // But we know msg-2 > msg-1.

    // Let's verify via DB directly what the timestamp is for msg-2
    const msg2 = await env.DB.prepare("SELECT received_at FROM messages WHERE id = 'msg-2'").first();
    const expectedTimestamp = msg2.received_at;

    expect(aliceContact.lastUsed).toBe(expectedTimestamp);
  });
});
