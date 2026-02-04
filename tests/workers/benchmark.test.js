import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { ApiRouter } from "../../workers/api/routes.js";
import { DB } from "../../workers/shared/db.js";

describe("Performance Benchmark", () => {

  beforeAll(async () => {
    // Apply migrations
    const migrations = import.meta.glob('../../migrations/*.sql', { query: '?raw', eager: true });
    const sortedKeys = Object.keys(migrations).sort();

    for (const key of sortedKeys) {
      const sql = migrations[key].default;
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements) {
         try {
           await env.DB.prepare(stmt).run();
         } catch (e) {}
      }
    }

    // Seed Data
    console.log("Seeding data...");
    const tags = [];
    for (let i = 0; i < 20; i++) {
      const tagName = `Tag_${i}`;
      const t = await DB.createTag(env.DB, tagName);
      tags.push(t.name);
    }
    // Ensure Spam and Sent exist
    await DB.getTags(env.DB);

    const messages = [];
    const batchSize = 50; // Insert in batches if possible, but DB.insertMessage is single
    // DB.insertMessage is single, but fast enough for 1000 in test?

    // Use raw insert for speed
    const placeholders = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    // id, received_at, from_addr, to_addr, subject, date_header, snippet, has_attachments, raw_r2_key, text_body, html_body, headers_json

    const messageInserts = [];
    const messageTagInserts = [];

    // Helper to get Tag ID
    const allTags = await DB.getTags(env.DB); // includes Spam and Sent
    const tagMap = {}; // name -> id
    allTags.forEach(t => tagMap[t.name] = t.id);

    for (let i = 0; i < 1000; i++) {
      const id = crypto.randomUUID();
      const isArchived = Math.random() < 0.2 ? 1 : 0;

      messageInserts.push({
        id,
        received_at: Date.now() - Math.floor(Math.random() * 10000000),
        from_addr: 'sender@example.com',
        to_addr: 'me@example.com',
        subject: `Message ${i}`,
        date_header: new Date().toISOString(),
        snippet: 'snippet',
        has_attachments: 0,
        raw_r2_key: `raw/${id}.eml`,
        text_body: 'body',
        html_body: null,
        headers_json: '{}',
        is_archived: isArchived
      });

      // Tags
      const assignedTags = new Set();
      if (Math.random() < 0.05) assignedTags.add('Spam');
      if (Math.random() < 0.05) assignedTags.add('Sent');

      const numOtherTags = Math.floor(Math.random() * 4); // 0-3
      for (let j = 0; j < numOtherTags; j++) {
        assignedTags.add(tags[Math.floor(Math.random() * tags.length)]);
      }

      for (const tName of assignedTags) {
        if (tagMap[tName]) {
          messageTagInserts.push({ message_id: id, tag_id: tagMap[tName] });
        }
      }
    }

    // Bulk insert messages
    // D1 binding in test might support batch via prepared statement reuse?
    // Or just run loop.
    for (const msg of messageInserts) {
        await env.DB.prepare(`
            INSERT INTO messages (id, received_at, from_addr, to_addr, subject, date_header, snippet, has_attachments, raw_r2_key, text_body, html_body, headers_json, is_archived)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            msg.id, msg.received_at, msg.from_addr, msg.to_addr, msg.subject, msg.date_header, msg.snippet, msg.has_attachments, msg.raw_r2_key, msg.text_body, msg.html_body, msg.headers_json, msg.is_archived
        ).run();
    }

    // Bulk insert message_tags
    for (const mt of messageTagInserts) {
        await env.DB.prepare(`INSERT INTO message_tags (message_id, tag_id) VALUES (?, ?)`).bind(mt.message_id, mt.tag_id).run();
    }

    console.log(`Seeded ${messageInserts.length} messages and ${messageTagInserts.length} tags.`);
  });

  it("measures /api/messages/counts performance", async () => {
    const request = new Request("https://example.com/api/messages/counts", { method: "GET" });

    const start = performance.now();
    const response = await ApiRouter.handle(request.url, request, env);
    const end = performance.now();

    const duration = end - start;
    console.log(`BASELINE DURATION: ${duration.toFixed(2)} ms`);

    const json = await response.json();
    console.log("Counts:", JSON.stringify(json, null, 2));

    expect(response.status).toBe(200);
    expect(json).toHaveProperty("inbox");
    expect(json).toHaveProperty("archive");
    expect(json).toHaveProperty("spam");
    expect(json).toHaveProperty("sent");
    expect(json).toHaveProperty("tags");
  });
});
