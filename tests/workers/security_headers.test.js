import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import worker from "../../workers/api/index.js";

describe("security headers", () => {
  it("adds security headers to asset responses", async () => {
    const mockAssets = {
      fetch: async (req) => new Response("<html></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" }
      })
    };

    // Create a mock env that includes ASSETS
    const mockEnv = { ...env, ASSETS: mockAssets };

    const request = new Request("https://example.com/");
    const response = await worker.fetch(request, mockEnv);

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");

    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("preserves original response status and body", async () => {
    const mockAssets = {
      fetch: async (req) => new Response("Original Content", {
        status: 200,
        headers: { "Content-Type": "text/plain" }
      })
    };

    const mockEnv = { ...env, ASSETS: mockAssets };
    const request = new Request("https://example.com/file.txt");
    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Original Content");
    expect(response.headers.get("Content-Type")).toBe("text/plain");
  });

  it("adds security headers to API responses", async () => {
    const request = new Request("https://example.com/api/health");
    const response = await worker.fetch(request, env);

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });
});
