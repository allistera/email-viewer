import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { DB } from "../../workers/shared/db.js";

const userTagNames = ['Work', 'Personal', 'Finance', 'Travel', 'Urgent'];
const tagIds = {};

describe("Benchmark Counts", () => {
  beforeAll(async () => {
    // Initialize Database Schema
    const statements = [
      `PRAGMA foreign_keys = ON;`,

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

      `CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages(received_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_messages_is_archived ON messages(is_archived);`,
      `CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);`,

      `CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
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
      `CREATE INDEX IF NOT EXISTS idx_message_tags_message_id ON message_tags(message_id);`
    ];

    for (const stmt of statements) {
      await env.DB.prepare(stmt).run();
    }

    // Seed Tags
    const tagsToCreate = ['Spam', 'Sent', ...userTagNames];
    for (const name of tagsToCreate) {
        const id = crypto.randomUUID();
        await env.DB.prepare('INSERT INTO tags (id, user_id, name, created_at) VALUES (?, ?, ?, ?)').bind(id, 'test-user', name, Date.now()).run();
        tagIds[name] = id;
    }

    // Seed Messages
    // Distribution:
    // 20% Archived
    //    Of Archived:
    //      25% Spam
    //      25% Sent
    //      25% User Tag
    //      25% Untagged
    // 80% Unarchived
    //    Of Unarchived:
    //      ~6% Spam (100)
    //      ~6% Sent (100)
    //      ~62% User Tags (1000)
    //      ~25% Untagged (400) - Inbox

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
            user_id: 'test-user',
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
            INSERT INTO messages (id, user_id, received_at, from_addr, to_addr, subject, date_header, snippet, has_attachments, raw_r2_key, text_body, html_body, headers_json, is_archived)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        await env.DB.batch(batch.map(m => stmt.bind(
            m.id, m.user_id, m.received_at, m.from_addr, m.to_addr, m.subject, m.date_header, m.snippet, m.has_attachments, m.raw_r2_key, m.text_body, m.html_body, m.headers_json, m.is_archived
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
    const userId = 'test-user';

    for (let i = 0; i < iterations; i++) {
        const [inboxCount, archiveCount, spamCount, sentCount, ...tagCounts] = await Promise.all([
          DB.countMessages(env.DB, { userId, archived: false, excludeTag: 'Spam' }),
          DB.countMessages(env.DB, { userId, archived: true }),
          DB.countMessages(env.DB, { userId, tag: 'Spam' }),
          DB.countMessages(env.DB, { userId, tag: 'Sent' }),
          ...userTagNames.map(tagName =>
            DB.countMessages(env.DB, { userId, tag: tagName, archived: false })
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
    const userId = 'test-user';

    for (let i = 0; i < iterations; i++) {
        await DB.getCounts(env.DB, userId);
    }

    const end = performance.now();
    const avgTime = (end - start) / iterations;
    console.log(`Average execution time for Optimized Counts: ${avgTime.toFixed(2)}ms`);
  });

  it("verifies correctness of counts", async () => {
      const userId = 'test-user';
      // Legacy behavior note:
      // Legacy code implicitly excludes archived messages from spam, sent, and tag counts
      // because DB.countMessages defaults archived=false if not specified.
      // Our test data includes archived spam/sent/tags, so this test confirms that behavior.
      const [inboxCount, archiveCount, spamCount, sentCount, ...tagCounts] = await Promise.all([
          DB.countMessages(env.DB, { userId, archived: false, excludeTag: 'Spam' }),
          DB.countMessages(env.DB, { userId, archived: true }),
          DB.countMessages(env.DB, { userId, tag: 'Spam' }),
          DB.countMessages(env.DB, { userId, tag: 'Sent' }),
          ...userTagNames.map(tagName =>
            DB.countMessages(env.DB, { userId, tag: tagName, archived: false })
          )
      ]);

      console.log('Legacy Results:', { inboxCount, archiveCount, spamCount, sentCount });

      const newCounts = await DB.getCounts(env.DB, userId);
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
