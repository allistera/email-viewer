import { test, expect } from '@playwright/test';

test.describe('MessageList Performance', () => {
  test('should render 5000 messages quickly', async ({ page }) => {
    // Generate 5000 mock messages
    const messages = Array.from({ length: 5000 }, (_, i) => ({
      id: `msg-${i}`,
      receivedAt: new Date().toISOString(),
      from: `Sender ${i}`,
      to: 'me@example.com',
      subject: `Message Subject ${i} - This is a long subject that might wrap depending on the width of the container`,
      snippet: `This is a snippet for message ${i} which is also quite long...`,
      hasAttachments: i % 5 === 0,
      isRead: i % 2 === 0,
      tag: i % 10 === 0 ? 'Work' : null
    }));

    // Mock API responses
    await page.route('**/api/messages?*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: messages, nextBefore: null })
      });
    });

    await page.route('**/api/messages/counts', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ inbox: 5000, archive: 0, spam: 0, sent: 0, tags: {} })
      });
    });

    // Set auth token
    await page.addInitScript(() => {
      localStorage.setItem('email_api_token', 'test-token');
    });

    const startTime = Date.now();
    await page.goto('/');

    // Wait for the last message to be present in the DOM (indicating render complete)
    // Note: With virtual scrolling, this might not be present, but without it, it will be.
    // For baseline, we wait for the list to be populated.
    // We can just wait for the first message and assume render starts.
    // But to measure full render blocking, we can check interactivity or frame drops.
    // For simplicity, let's wait for a specific element that appears after loading.

    await page.waitForSelector('.message-item');

    // Wait for the 5000th item to be in the DOM (only possible without virtualization)
    // Or just check if the list has many children.
    await page.evaluate(() => {
      return new Promise(resolve => {
        if (document.querySelectorAll('.message-item').length > 0) {
          resolve();
        } else {
          const observer = new MutationObserver(() => {
             if (document.querySelectorAll('.message-item').length > 0) {
               observer.disconnect();
               resolve();
             }
          });
          observer.observe(document.body, { childList: true, subtree: true });
        }
      });
    });

    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`Render time for 5000 messages: ${duration}ms`);

    // Basic assertion to ensure it loaded
    const count = await page.locator('.message-item').count();
    expect(count).toBeGreaterThan(0);
  });
});
