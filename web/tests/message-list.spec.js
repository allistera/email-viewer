import { test, expect } from '@playwright/test';

test.describe('Message List', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await context.addInitScript(() => {
      localStorage.clear();
    });
    await page.goto('/');

    const tokenInput = page.getByPlaceholder('API Token');
    await tokenInput.fill('dev-token-12345');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText('Inbox')).toBeVisible();
  });

  test('should display inbox with messages', async ({ page }) => {
    await expect(page.getByText('Inbox')).toBeVisible();

    const messageItems = page.locator('.message-item');
    await expect(messageItems).toHaveCount(4);
  });

  test('should show message details', async ({ page }) => {
    await expect(page.locator('.message-item').first()).toBeVisible();

    const firstMessage = page.locator('.message-item').first();
    await expect(firstMessage).toContainText('alice@example.com');
    await expect(firstMessage).toContainText('Quarterly Report Ready for Review');
  });

  test('should select message and show detail panel', async ({ page }) => {
    const firstMessage = page.locator('.message-item').first();
    await firstMessage.click();

    await expect(firstMessage).toHaveClass(/active/);

    await expect(page.getByText('Quarterly Report Ready for Review')).toBeVisible();
    await expect(page.getByText('alice@example.com')).toBeVisible();
  });

  test('should display spam badges correctly', async ({ page }) => {
    const spamMessage = page.locator('.message-item').nth(1);
    await expect(spamMessage).toContainText('🎉 AMAZING OFFER');

    const spamBadge = spamMessage.locator('.spam-badge');
    await expect(spamBadge).toBeVisible();
    await expect(spamBadge).toContainText('Spam');
  });

  test('should show attachment icon for messages with attachments', async ({ page }) => {
    const messageWithAttachment = page.locator('.message-item').first();
    await expect(messageWithAttachment.locator('.attachment-icon')).toBeVisible();
  });

  test('should filter messages by spam status', async ({ page }) => {
    const spamFilter = page.locator('select.filter-select');

    await spamFilter.selectOption('spam');
    await page.waitForTimeout(500);

    const messageItems = page.locator('.message-item');
    const count = await messageItems.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const item = messageItems.nth(i);
      await expect(item.locator('.spam-badge')).toContainText('Spam');
    }
  });

  test('should filter messages by ham status', async ({ page }) => {
    const spamFilter = page.locator('select.filter-select');

    await spamFilter.selectOption('ham');
    await page.waitForTimeout(500);

    const messageItems = page.locator('.message-item');
    const count = await messageItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should show relative timestamps', async ({ page }) => {
    const firstMessage = page.locator('.message-item').first();
    const timeElement = firstMessage.locator('.time');

    const timeText = await timeElement.textContent();
    expect(timeText).toMatch(/(ago|Just now)/);
  });

  test('should refresh message list', async ({ page }) => {
    const refreshButton = page.locator('button[title="Refresh"]');
    await refreshButton.click();

    await page.waitForTimeout(500);

    const messageItems = page.locator('.message-item');
    await expect(messageItems).toHaveCount(4);
  });

  test('should show loading state', async ({ page }) => {
    await page.reload();

    const tokenInput = page.getByPlaceholder('API Token');
    await tokenInput.fill('dev-token-12345');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText('Loading messages...')).toBeVisible();
  });

  test('should show empty state when no messages', async ({ page }) => {
    const spamFilter = page.locator('select.filter-select');

    await spamFilter.selectOption('unknown');
    await page.waitForTimeout(500);

    await expect(page.getByText('No messages found')).toBeVisible();
  });
});
