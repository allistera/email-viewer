import { test, expect } from '@playwright/test';

test('handleMessageReceived should not flood API calls on burst events', async ({ page }) => {
  // Set auth token
  await page.addInitScript(() => {
    localStorage.setItem('email_api_token', 'test-token');
  });

  // Mock API responses
  await page.route('**/api/messages?*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], nextBefore: null })
    });
  });

  await page.route('**/api/messages/counts', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ inbox: 0, archive: 0, spam: 0, sent: 0, tags: {} })
    });
  });

  // Count requests
  let messagesCallCount = 0;
  let countsCallCount = 0;

  const requestListener = request => {
    if (request.url().includes('/api/messages') && !request.url().includes('/counts')) {
      messagesCallCount++;
    }
    if (request.url().includes('/api/messages/counts')) {
      countsCallCount++;
    }
  };
  page.on('request', requestListener);

  // Mock SSE stream with a burst of events
  // We want to ensure these are delivered.
  await page.route('**/api/stream*', async route => {
    const messageEvent = JSON.stringify({
      type: 'message.received',
      message: { id: '123', subject: 'Test' }
    });
    // Send 5 events in a burst
    const streamBody = Array(5).fill(`data: ${messageEvent}\n\n`).join('');

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: streamBody
    });
  });

  // Go to page
  await page.goto('/');

  // Wait for initial load to complete
  // The app shows a list (empty in this case).
  // We can wait for the list to be visible or similar.
  await page.waitForTimeout(3000);

  console.log(`Messages calls: ${messagesCallCount}, Counts calls: ${countsCallCount}`);

  // Without debounce:
  // Initial load: 1 call
  // Stream connects -> 5 events -> 5 calls
  // Total: 6 calls

  // With debounce (e.g., 300ms):
  // Initial load: 1 call
  // Stream connects -> 5 events rapidly -> 1 debounce call (or maybe 2 if timing splits)
  // Total: 2-3 calls

  // So if count > 4, it's definitely not debounced well enough for a burst of 5.
  // With debounce, we expect fewer calls (e.g. 2: 1 initial + 1 coalesced).
  expect(messagesCallCount).toBeLessThan(5);
  expect(countsCallCount).toBeLessThan(10);
});
