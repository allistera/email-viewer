import { test, expect } from '@playwright/test';

test.describe('Message List Empty States', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await page.route('**/api/messages*', async route => {
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

    // Login
    await page.goto('/');
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
