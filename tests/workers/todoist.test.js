import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import worker from "../../workers/todoist/index.js";

describe("todoist worker", () => {
  it("rejects invalid message id", async () => {
    const request = new Request(
      "https://example.com/messages/not-a-uuid/todoist",
      { method: "POST" }
    );
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toMatch(/invalid message id/i);
  });
});
