import { describe, it, expect } from "vitest";
import { authenticate } from "../../workers/shared/auth.js";

const env = {
  API_TOKEN: "super-secret-token-123"
};

describe("auth middleware", () => {
  it("allows health check without auth", async () => {
    const request = new Request("https://example.com/api/health");
    const response = await authenticate(request, env);
    expect(response).toBeNull();
  });

  it("returns 401 for missing authorization header", async () => {
    const request = new Request("https://example.com/api/messages");
    const response = await authenticate(request, env);
    expect(response).not.toBeNull();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Missing or invalid Authorization header");
  });

  it("returns 401 for invalid authorization header format", async () => {
    const request = new Request("https://example.com/api/messages", {
      headers: { Authorization: "Basic dXNlcjpwYXNz" }
    });
    const response = await authenticate(request, env);
    expect(response).not.toBeNull();
    expect(response.status).toBe(401);
  });

  it("returns 401 for incorrect token", async () => {
    const request = new Request("https://example.com/api/messages", {
      headers: { Authorization: "Bearer wrong-token" }
    });
    const response = await authenticate(request, env);
    expect(response).not.toBeNull();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 for token with different length", async () => {
    const request = new Request("https://example.com/api/messages", {
      headers: { Authorization: "Bearer super-secret-token-12" } // one char less
    });
    const response = await authenticate(request, env);
    expect(response).not.toBeNull();
    expect(response.status).toBe(401);
  });

  it("returns 401 for slightly modified token", async () => {
    const request = new Request("https://example.com/api/messages", {
      headers: { Authorization: "Bearer super-secret-token-124" } // one char diff
    });
    const response = await authenticate(request, env);
    expect(response).not.toBeNull();
    expect(response.status).toBe(401);
  });

  it("allows request with correct token", async () => {
    const request = new Request("https://example.com/api/messages", {
      headers: { Authorization: "Bearer super-secret-token-123" }
    });
    const response = await authenticate(request, env);
    expect(response).toBeNull();
  });

  it("allows request with token in query param", async () => {
    const request = new Request("https://example.com/api/messages?token=super-secret-token-123");
    const response = await authenticate(request, env);
    expect(response).toBeNull();
  });
});
