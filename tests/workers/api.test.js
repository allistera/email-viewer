import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import worker from "../../workers/api/index.js";

describe("api worker", () => {
  beforeAll(async () => {
    // Schema for users and api_tokens
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        created_at INTEGER NOT NULL
      );
    `).run();
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS api_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at INTEGER,
        expires_at INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `).run();

    // Insert test user and token
    await env.DB.prepare(`
      INSERT INTO users (id, username, created_at) VALUES ('test-user', 'test', 1234567890);
    `).run();
    await env.DB.prepare(`
      INSERT INTO api_tokens (token, user_id, created_at) VALUES ('valid-token', 'test-user', 1234567890);
    `).run();
  });

  it("returns health response without auth", async () => {
    const request = new Request("https://example.com/api/health");
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ ok: true, worker: "api" });
  });

  it("returns 401 without auth header for protected route", async () => {
    const request = new Request("https://example.com/api/messages");
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(401);
  });

  it("returns 401 with invalid token", async () => {
    const request = new Request("https://example.com/api/messages", {
      headers: { Authorization: "Bearer invalid-token" }
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(401);
  });

  it("passes auth with valid token", async () => {
    const request = new Request("https://example.com/api/messages", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const response = await worker.fetch(request, env);
    // If auth succeeds, it tries to fetch messages.
    // If table missing, it throws error or returns 500.
    // If status is NOT 401, auth succeeded.
    expect(response.status).not.toBe(401);
  });
});
