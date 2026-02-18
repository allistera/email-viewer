import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { DB } from "../../workers/shared/db.js";

describe("Benchmark Counts", () => {
  let userTagNames = ['Work', 'Personal', 'Finance', 'Travel', 'Shopping'];

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
      );`
    ];

    for (const stmt of statements) {
      await env.DB.prepare(stmt).run();
    }

    // Create Tags
    const tags = ['Spam', 'Sent', ...userTagNames];
    const tagIds = {};
    for (const name of tags) {
      const id = crypto.randomUUID();
      await env.DB.prepare('INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)').bind(id, name, Date.now()).run();
      tagIds[name] = id;
    }

    // Seed Data: 2000 messages
    // 20% Archived
    // 5% Spam (Unarchived)
    // 5% Sent (Unarchived)
    // 50% tagged with random user tags (Unarchived)
    // 20% Untagged (Unarchived) - Inbox

    const messages = [];
    const messageTags = [];

    for (let i = 0; i < 2000; i++) {
        const id = crypto.randomUUID();
        const isArchived = i < 400; // 20%
        let msgTags = [];

        // 0-99: Archived Spam
        if (i < 100) {
            msgTags.push('Spam');
        }
        // 100-199: Archived Sent
        else if (i < 200) {
            msgTags.push('Sent');
        }
        // 200-299: Archived User Tag (Tag 0)
        else if (i < 300) {
            msgTags.push(userTagNames[0]);
        }
        // 300-399: Archived Untagged
        else if (i < 400) {
            // No tags
        }
        // 400-1999: Unarchived
        else {
             if (i < 500) { // 400-499: Unarchived Spam (100)
                 msgTags.push('Spam');
             } else if (i < 600) { // 500-599: Unarchived Sent (100)
                 msgTags.push('Sent');
             } else if (i < 1600) { // 600-1599: Unarchived User Tags (1000)
                 // Random user tag
                 const tagName = userTagNames[Math.floor(Math.random() * userTagNames.length)];
                 msgTags.push(tagName);
                 // 10% chance of second tag
                 if (Math.random() < 0.1) {
                    const tagName2 = userTagNames[Math.floor(Math.random() * userTagNames.length)];
                    if (tagName2 !== tagName) msgTags.push(tagName2);
                 }
             }
             // Rest (1600-1999): Inbox (400)
        }

        messages.push({
            id,
            received_at: Date.now() - i * 1000,
            from_addr: "sender@example.com",
            to_addr: "me@example.com",
            subject: "Subject " + i,
            date_header: new Date().toISOString(),
            snippet: "Snippet",
            has_attachments: false,
            raw_r2_key: `raw/${id}`,
            text_body: "Body",
            html_body: null,
            headers_json: "{}",
            is_archived: isArchived ? 1 : 0
        });

        for (const tagName of msgTags) {
            messageTags.push({
                message_id: id,
                tag_id: tagIds[tagName]
            });
        }
    }

    // Batch Insert Messages
    const batchSize = 100;
    for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        const stmt = env.DB.prepare(`
            INSERT INTO messages (id, received_at, from_addr, to_addr, subject, date_header, snippet, has_attachments, raw_r2_key, text_body, html_body, headers_json, is_archived)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        await env.DB.batch(batch.map(m => stmt.bind(
            m.id, m.received_at, m.from_addr, m.to_addr, m.subject, m.date_header, m.snippet, m.has_attachments, m.raw_r2_key, m.text_body, m.html_body, m.headers_json, m.is_archived
        )));
    }

    // Batch Insert Message Tags
    for (let i = 0; i < messageTags.length; i += batchSize) {
        const batch = messageTags.slice(i, i + batchSize);
        const stmt = env.DB.prepare(`INSERT INTO message_tags (message_id, tag_id) VALUES (?, ?)`);
        await env.DB.batch(batch.map(mt => stmt.bind(mt.message_id, mt.tag_id)));
    }

  }, 120000);

  it("benchmarks legacy count performance", async () => {
    const start = performance.now();
    const iterations = 10;

    for (let i = 0; i < iterations; i++) {
        const [inboxCount, archiveCount, spamCount, sentCount, ...tagCounts] = await Promise.all([
          DB.countMessages(env.DB, { archived: false, excludeTag: 'Spam' }),
          DB.countMessages(env.DB, { archived: true }),
          DB.countMessages(env.DB, { tag: 'Spam' }),
          DB.countMessages(env.DB, { tag: 'Sent' }),
          ...userTagNames.map(tagName =>
            DB.countMessages(env.DB, { tag: tagName, archived: false })
          )
        ]);
    }

    const end = performance.now();
    const avgTime = (end - start) / iterations;
    console.log(`Average execution time for Legacy Counts: ${avgTime.toFixed(2)}ms`);
  });

  it("benchmarks optimized count performance", async () => {
    const start = performance.now();
    const iterations = 10;

    for (let i = 0; i < iterations; i++) {
        await DB.getCounts(env.DB);
    }

    const end = performance.now();
    const avgTime = (end - start) / iterations;
    console.log(`Average execution time for Optimized Counts: ${avgTime.toFixed(2)}ms`);
  });

  it("verifies correctness of counts", async () => {
      // Legacy behavior note:
      // Legacy code implicitly excludes archived messages from spam, sent, and tag counts
      // because DB.countMessages defaults archived=false if not specified.
      // Our test data includes archived spam/sent/tags, so this test confirms that behavior.
      const [inboxCount, archiveCount, spamCount, sentCount, ...tagCounts] = await Promise.all([
          DB.countMessages(env.DB, { archived: false, excludeTag: 'Spam' }),
          DB.countMessages(env.DB, { archived: true }),
          DB.countMessages(env.DB, { tag: 'Spam' }),
          DB.countMessages(env.DB, { tag: 'Sent' }),
          ...userTagNames.map(tagName =>
            DB.countMessages(env.DB, { tag: tagName, archived: false })
          )
      ]);

      console.log('Legacy Results:', { inboxCount, archiveCount, spamCount, sentCount });

      const newCounts = await DB.getCounts(env.DB);
      console.log('New Results:', newCounts);

      expect(newCounts.archive).toBe(archiveCount);
      expect(newCounts.inbox).toBe(inboxCount);
      expect(newCounts.spam).toBe(spamCount);
      expect(newCounts.sent).toBe(sentCount);

      userTagNames.forEach((name, i) => {
          expect(newCounts.tagCounts[name] || 0).toBe(tagCounts[i]);
      });
  });

});
