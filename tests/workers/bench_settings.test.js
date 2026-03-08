import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { DB } from "../../workers/shared/db.js";

describe("Settings Performance Benchmark", () => {
  beforeAll(async () => {
    // Initialize Database Schema
    const statements = [
      `PRAGMA foreign_keys = ON;`,
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

  it("benchmark getSetting", async () => {
    await DB.setSetting(env.DB, "retention_days", "30");

    const iterations = 1000;
    const start = Date.now();

    for (let i = 0; i < iterations; i++) {
      await DB.getSetting(env.DB, "retention_days");
    }

    const end = Date.now();
    const duration = end - start;
    const msPerOp = duration / iterations;

    console.log(`[Benchmark] getSetting: ${duration}ms for ${iterations} iterations (${msPerOp.toFixed(3)}ms/op)`);
  });
});
