import { test, expect } from '@playwright/test';

test.describe('Message List Empty States', () => {
  test.beforeEach(async ({ page, context }) => {
    // Force clear cookies/storage
    await context.clearCookies();

    // Disable Service Worker registration request
    await page.route('**/sw.js', route => route.abort());

    // Mock SSE to prevent background updates and keep tests stable
    await page.route('**/api/stream*', async route => {
        await route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' });
    });

    // Mock API responses
    // Use regex to ensure query parameters are matched robustly
    await page.route(/\/api\/messages.*/, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], nextBefore: null })
      });
    });

    await page.route('**/api/counts', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ inbox: 0, archive: 0, spam: 0, sent: 0, tags: {} })
      });
    });

    // Navigate to app
    await page.goto('/');

    // Explicitly unregister any existing Service Workers to ensure network mocking works
    await page.evaluate(async () => {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
            }
        }
    });

    // Login
    await page.fill('input[type="password"]', 'dev-token-12345');
    await page.click('button[type="submit"]');
    await expect(page.locator('.auth-modal')).toBeHidden();
  });

  test('shows inbox empty state', async ({ page }) => {
    await expect(page.locator('.empty-state')).toContainText("You're all caught up");
    await expect(page.locator('.empty-icon')).toHaveText('🎉');
  });

  test('shows archive empty state', async ({ page }) => {
    // Click Archive tag in sidebar
    await page.click('text=Done');
    await expect(page.locator('.empty-state')).toContainText('Archive is empty');
    await expect(page.locator('.empty-icon')).toHaveText('📦');
  });

  test('shows spam empty state', async ({ page }) => {
    await page.click('text=Spam');
    await expect(page.locator('.empty-state')).toContainText('No spam');
    await expect(page.locator('.empty-icon')).toHaveText('🛡️');
  });

  test('shows search empty state', async ({ page }) => {
    // Type in search box
    await page.fill('input[placeholder*="Search"]', 'missing-email');

    // Verify the text changes.
    await expect(page.locator('.empty-state')).toContainText('No matches found');
    await expect(page.locator('.empty-icon')).toHaveText('🔍');

    // Verify clear button
    const clearBtn = page.locator('button:has-text("Clear search")');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // Should return to inbox state
    await expect(page.locator('.empty-state')).toContainText("You're all caught up");
  });
});
