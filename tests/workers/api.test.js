import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import worker from "../../workers/api/index.js";

describe("api worker", () => {
  it("returns health response without auth", async () => {
    const request = new Request("https://example.com/api/health");
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ ok: true, worker: "api" });
  });
});
