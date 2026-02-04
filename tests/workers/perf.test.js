import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import worker from "../../workers/api/index.js";

describe("performance benchmark", () => {
  beforeAll(async () => {
    await env.DB.exec("CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, received_at INTEGER NOT NULL, from_addr TEXT NOT NULL, to_addr TEXT NOT NULL, subject TEXT, date_header TEXT, snippet TEXT, has_attachments INTEGER NOT NULL DEFAULT 0, raw_r2_key TEXT NOT NULL, text_body TEXT, html_body TEXT, headers_json TEXT)");
    await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages(received_at DESC)");
    await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_messages_from_addr ON messages(from_addr)");
    await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_messages_to_addr ON messages(to_addr)");
  });

  it("benchmarks contacts search", async () => {
    // Seed data
    const count = 5000;
    const batchSize = 100;

    console.log(`Seeding ${count} messages...`);

    const statements = [];
    for (let i = 0; i < count; i++) {
        const id = crypto.randomUUID();
        const email = `user${i}@example.com`;
        const otherEmail = `contact${i % 50}@test.com`; // Reuse contacts to have duplicates

        // Alternating from/to to cover both cases
        const fromAddr = i % 2 === 0 ? email : otherEmail;
        const toAddr = i % 2 === 0 ? otherEmail : email;

        const receivedAt = Date.now() - Math.floor(Math.random() * 10000000);

        statements.push(env.DB.prepare(`
            INSERT INTO messages (id, received_at, from_addr, to_addr, subject, has_attachments, raw_r2_key)
            VALUES (?, ?, ?, ?, 'Test Subject', 0, 'key')
        `).bind(id, receivedAt, fromAddr, toAddr));

        if (statements.length >= batchSize) {
            await env.DB.batch(statements);
            statements.length = 0;
        }
    }
    if (statements.length > 0) {
        await env.DB.batch(statements);
    }

    console.log("Seeding complete.");

    // Benchmark
    const query = "contact";
    const request = new Request(`https://example.com/api/contacts?q=${query}&limit=50`);

    // Set Auth
    env.API_TOKEN = "test-token";
    request.headers.set("Authorization", "Bearer test-token");

    // Warmup
    await worker.fetch(new Request(request.url, { headers: request.headers }), env);

    const start = performance.now();
    const response = await worker.fetch(request, env);
    const end = performance.now();

    expect(response.status).toBe(200);
    const data = await response.json();
    console.log(`Contacts search took: ${(end - start).toFixed(2)}ms`);
    console.log(`Found ${data.contacts.length} contacts`);
  });
});
