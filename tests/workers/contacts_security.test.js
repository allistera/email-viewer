import { describe, expect, it } from "vitest";
import { ApiRouter } from "../../workers/api/routes.js";

function createContactsDbMock(rows = []) {
  const state = { sql: "", bindings: [] };
  const db = {
    prepare(sql) {
      state.sql = sql;
      return {
        bind(...args) {
          state.bindings = args;
          return {
            all: async () => ({ results: rows }),
          };
        },
      };
    },
  };

  return { db, state };
}

describe("contacts security", () => {
  it("uses ESCAPE clause and escapes input to prevent wildcard injection", async () => {
    const { db, state } = createContactsDbMock([
      { email: "alex@example.com", last_used: 123 },
    ]);
    const env = { DB: db };
    // Input contains '%', which allows a user to craft a broader search than intended
    // e.g., "a%l" -> "a%l%" in SQL, matching "apple", "axel", etc.
    const request = new Request("https://example.com/api/contacts?q=a%25l&limit=10", {
      method: "GET",
    });

    const response = await ApiRouter.handle(request.url, request, env);
    expect(response.status).toBe(200);

    // New behavior: The SQL uses ESCAPE clause
    expect(state.sql).toContain("WHERE from_addr LIKE ? ESCAPE '\\'");

    // The binding escapes the % in the input
    // Input: a%l -> Binding: a\%l% (escaped % + wildcard suffix)
    expect(state.bindings[0]).toBe("a\\%l%");
    expect(state.bindings[1]).toBe("a\\%l%");
  });

  it("should escape special characters in LIKE query", async () => {
    const { db, state } = createContactsDbMock([]);
    const env = { DB: db };
    // Input with wildcard characters that should be treated as literals
    // "100%" -> we want to find email "100%@example.com", not "100" followed by anything
    const request = new Request("https://example.com/api/contacts?q=100%25&limit=10", {
      method: "GET",
    });

    const response = await ApiRouter.handle(request.url, request, env);
    expect(response.status).toBe(200);

    // Expect the SQL to use ESCAPE
    expect(state.sql).toContain("LIKE ? ESCAPE '\\'");

    // Expect the binding to be escaped: "100\%" + "%" (suffix)
    expect(state.bindings[0]).toBe("100\\%%");
  });
});
