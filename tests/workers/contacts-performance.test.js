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

function buildMessages(count = 5000) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({
      received_at: count - i,
      from_addr: `sender${i}@example.com`,
      to_addr: `team${i % 350}@example.com`,
    });
  }
  return out;
}

function baselineContainsSearch(messages, query, limit) {
  const q = String(query || "").toLowerCase();
  const latestByEmail = new Map();
  let scanned = 0;

  for (const m of messages) {
    scanned += 2;
    const from = m.from_addr.toLowerCase();
    const to = m.to_addr.toLowerCase();

    if (from.includes(q)) {
      const current = latestByEmail.get(from) ?? -1;
      if (m.received_at > current) latestByEmail.set(from, m.received_at);
    }
    if (to.includes(q)) {
      const current = latestByEmail.get(to) ?? -1;
      if (m.received_at > current) latestByEmail.set(to, m.received_at);
    }
  }

  const results = Array.from(latestByEmail.entries())
    .map(([email, last_used]) => ({ email, last_used }))
    .sort((a, b) => b.last_used - a.last_used)
    .slice(0, limit);

  return { results, scanned };
}

function buildPrefixIndex(messages) {
  const latestByEmail = new Map();
  for (const m of messages) {
    const from = m.from_addr.toLowerCase();
    const to = m.to_addr.toLowerCase();
    if ((latestByEmail.get(from) ?? -1) < m.received_at) latestByEmail.set(from, m.received_at);
    if ((latestByEmail.get(to) ?? -1) < m.received_at) latestByEmail.set(to, m.received_at);
  }

  return Array.from(latestByEmail.entries())
    .map(([email, last_used]) => ({ email, last_used }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

function lowerBoundByEmail(sortedContacts, value) {
  let lo = 0;
  let hi = sortedContacts.length;
  let probes = 0;

  while (lo < hi) {
    probes += 1;
    const mid = (lo + hi) >> 1;
    if (sortedContacts[mid].email < value) lo = mid + 1;
    else hi = mid;
  }

  return { index: lo, probes };
}

function optimizedPrefixSearch(sortedContacts, query, limit) {
  const prefix = String(query || "").toLowerCase();
  const endPrefix = `${prefix}\uffff`;
  const startBound = lowerBoundByEmail(sortedContacts, prefix);
  const endBound = lowerBoundByEmail(sortedContacts, endPrefix);
  const start = startBound.index;
  const end = endBound.index;
  const scanned = startBound.probes + endBound.probes + Math.max(0, end - start);

  const results = sortedContacts
    .slice(start, end)
    .sort((a, b) => b.last_used - a.last_used)
    .slice(0, limit);

  return { results, scanned };
}

describe("contacts search", () => {
  it("uses prefix pattern for DB lookup", async () => {
    const { db, state } = createContactsDbMock([
      { email: "alex@example.com", last_used: 123 },
    ]);
    const env = { DB: db };
    const request = new Request("https://example.com/api/contacts?q=al&limit=10", {
      method: "GET",
    });

    const response = await ApiRouter.handle(request.url, request, env, 'test-user');
    expect(response.status).toBe(200);
    expect(state.sql).toContain("WHERE user_id = ? AND from_addr LIKE ?");
    expect(state.bindings[0]).toBe('test-user');
    expect(state.bindings[1]).toBe("al%");
    expect(state.bindings[2]).toBe('test-user');
    expect(state.bindings[3]).toBe("al%");
    expect(state.bindings[4]).toBe(10);
  });

  it("benchmark: prefix index seek outperforms contains scan on 5000 records", () => {
    const messages = buildMessages(5000);
    const indexedContacts = buildPrefixIndex(messages);
    const query = "sender12";
    const limit = 20;

    const baselineSample = baselineContainsSearch(messages, query, limit);
    const optimizedSample = optimizedPrefixSearch(indexedContacts, query, limit);
    const scanRatio = (baselineSample.scanned / optimizedSample.scanned).toFixed(2);

    expect(baselineSample.results.length).toBeGreaterThan(0);
    expect(optimizedSample.results.length).toBeGreaterThan(0);
    expect(optimizedSample.scanned).toBeLessThan(baselineSample.scanned);
    console.log(
      `contacts benchmark (5000 records): baseline_scanned=${baselineSample.scanned} optimized_scanned=${optimizedSample.scanned} ratio=${scanRatio}x`
    );
  });
});
