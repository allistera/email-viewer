import { describe, it, expect } from "vitest";
import worker from "../../workers/api/index.js";

describe("api worker security headers", () => {
  it("returns security headers for static assets", async () => {
    const request = new Request("https://mail.infinitywave.design/");

    // Mock env.ASSETS
    const env = {
      ASSETS: {
        fetch: async () => new Response("<html></html>", {
          headers: { "Content-Type": "text/html" }
        })
      }
    };

    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);

    // Check for Security Headers
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("Permissions-Policy")).toContain("geolocation=()");
    expect(response.headers.get("Strict-Transport-Security")).toContain("max-age=31536000");
  });
});
