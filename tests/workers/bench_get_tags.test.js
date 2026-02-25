import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { DB } from "../../workers/shared/db.js";

describe("Benchmark DB.getTags", () => {
  beforeAll(async () => {
    // Initialize Database Schema (Tags only needed for this benchmark)
    const statements = [
      `PRAGMA foreign_keys = ON;`,

      `CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at INTEGER
      );`
    ];

    for (const stmt of statements) {
      await env.DB.prepare(stmt).run();
    }

    // Seed Data: 50 tags
    const tags = [];
    for (let i = 0; i < 50; i++) {
        tags.push(`Tag ${i}`);
    }

    for (const name of tags) {
        await DB.createTag(env.DB, name);
    }
  });

  it("benchmarks getTags performance", async () => {
    const start = performance.now();
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      const results = await DB.getTags(env.DB);
      expect(results.length).toBeGreaterThanOrEqual(50); // +2 for Spam and Sent
    }

    const end = performance.now();
    const totalTime = end - start;
    const avgTime = totalTime / iterations;

    console.log(`[Baseline] Total time for ${iterations} getTags calls: ${totalTime.toFixed(2)}ms`);
    console.log(`[Baseline] Average execution time: ${avgTime.toFixed(4)}ms`);
  });
});
