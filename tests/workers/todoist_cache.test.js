import { describe, it, expect, vi } from "vitest";
import { fetchTodoistProjects } from "../../workers/shared/todoist.js";

const TODOIST_PROJECTS_API_URL = 'https://api.todoist.com/rest/v2/projects';

describe("Todoist Cache Optimization", () => {
  it("benchmarks project fetch", async () => {
    // We will benchmark how long it takes to run `fetchTodoistProjects` multiple times.

    // Mock fetch for TODOIST_PROJECTS_API_URL
    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockImplementation(async (url) => {
        return {
            ok: true,
            json: async () => [{id: "1", name: "Inbox"}]
        }
    });

    global.fetch = fetchMock;

    try {
        const token = "mock-token-123";
        const numCalls = 1000;

        const start = performance.now();
        for(let i = 0; i < numCalls; i++) {
           await fetchTodoistProjects(token);
        }
        const end = performance.now();

        console.log(`Execution time for ${numCalls} fetches: ${end - start} ms`);

        // After optimization, only the first call should trigger a fetch
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // Verify output is as expected
        const firstResult = await fetchTodoistProjects(token);
        expect(firstResult).toEqual([{id: "1", name: "Inbox"}]);

    } finally {
        global.fetch = originalFetch;
    }
  });
});
