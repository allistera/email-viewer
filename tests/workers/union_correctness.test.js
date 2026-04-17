import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { ApiRouter } from "../../workers/api/routes.js";

describe("Contacts API Union Correctness", () => {
  let oneDayAgo = 0;

  beforeAll(async () => {
    // Initialize Database Schema (Minimal for this test)
    const statements = [
      `PRAGMA foreign_keys = ON;`,
      `CREATE TABLE IF NOT EXISTS contacts (
        email TEXT PRIMARY KEY COLLATE NOCASE,
        display_name TEXT,
        first_seen_at INTEGER NOT NULL,
        last_used_at INTEGER NOT NULL,
        last_direction TEXT NOT NULL DEFAULT 'inbound' CHECK(last_direction IN ('inbound', 'outbound'))
      );`,
      `CREATE INDEX IF NOT EXISTS idx_contacts_last_used_at ON contacts(last_used_at DESC);`
    ];

    for (const stmt of statements) {
      await env.DB.prepare(stmt).run();
    }

    // Insert Test Data
    const now = Date.now();
    oneDayAgo = now - 86400000;
    // Alice was seen inbound earlier...
    await env.DB.prepare(`
      INSERT INTO contacts (email, first_seen_at, last_used_at, last_direction)
      VALUES (?, ?, ?, ?)
    `).bind('alice@example.com', oneDayAgo - 1000, oneDayAgo, 'inbound').run();

    // Bob was used most recently and should rank first for "b" queries.
    await env.DB.prepare(`
      INSERT INTO contacts (email, first_seen_at, last_used_at, last_direction)
      VALUES (?, ?, ?, ?)
    `).bind('bob@example.com', now - 1000, now, 'outbound').run();
  });

  it("returns contacts from the contacts table with latest timestamps", async () => {
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
    expect(aliceContact.lastUsed).toBe(oneDayAgo);
    expect(aliceContact.direction).toBe('inbound');
  });
});
