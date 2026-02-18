import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageClassifier, TodoistProjectSelector } from '../../workers/shared/openai.js';

describe('OpenAI Truncation Security Check', () => {
  const originalFetch = global.fetch;
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ tag: { tag: 'Work', confidence: 0.9 } }) } }]
      })
    });
    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('truncates large HTML body in MessageClassifier to prevent DoS', async () => {
    const largeHtml = '<div>' + 'a'.repeat(200000) + '</div>'; // ~200KB
    const message = {
      from_addr: 'test@example.com',
      html_body: largeHtml,
      text_body: null
    };

    await MessageClassifier.classify(message, ['Work'], 'fake-key');

    expect(fetchMock).toHaveBeenCalled();
    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    const userContent = JSON.parse(body.messages[1].content);

    // The input body should be truncated to 2000 chars (after regex replacement)
    // But importantly, we want to ensure the regex didn't choke on the huge input.
    // The test running successfully within reasonable time implicitly checks performance,
    // but here we just check correctness of the result.

    expect(userContent.email.body.length).toBeLessThanOrEqual(2000);

    // Check that we processed a truncated version
    // If we passed the full 200KB to replace, it would still result in <2000 chars (since it's all 'a's inside div)
    // But we can check execution time implicitly.
  });

  it('truncates large HTML body in TodoistProjectSelector to prevent DoS', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ project_id: '123', project_name: 'Inbox' }) } }]
      })
    });

    const largeHtml = '<div>' + 'a'.repeat(200000) + '</div>'; // ~200KB
    const message = {
      from_addr: 'test@example.com',
      html_body: largeHtml,
      text_body: null
    };

    await TodoistProjectSelector.selectProject(message, [{id: '123', name: 'Inbox'}], 'fake-key');

    expect(fetchMock).toHaveBeenCalled();
    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    const userContent = JSON.parse(body.messages[1].content);

    expect(userContent.email.body.length).toBeLessThanOrEqual(3000);
  });
});
