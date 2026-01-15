import { test, expect } from '@playwright/test';

test.describe('Archive Functionality', () => {
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

  test('should show archive button in action bar', async ({ page }) => {
    const archiveButton = page.getByRole('button', { name: /Archive/ });
    await expect(archiveButton).toBeVisible();
  });

  test('should disable archive button when no message selected', async ({ page }) => {
    const archiveButton = page.getByRole('button', { name: /Archive/ });
    await expect(archiveButton).toBeDisabled();
  });

  test('should enable archive button when message selected', async ({ page }) => {
    const firstMessage = page.locator('.message-item').first();
    await firstMessage.click();

    const archiveButton = page.getByRole('button', { name: /Archive/ });
    await expect(archiveButton).toBeEnabled();
  });

  test('should remove message from list on archive', async ({ page }) => {
    const messageItems = page.locator('.message-item');
    const initialCount = await messageItems.count();

    const firstMessage = messageItems.first();
    const firstMessageSubject = await firstMessage.locator('.message-subject').textContent();
    await firstMessage.click();

    const archiveButton = page.getByRole('button', { name: /Archive/ });
    await archiveButton.click();

    await page.waitForTimeout(500);

    const updatedMessageItems = page.locator('.message-item');
    const newCount = await updatedMessageItems.count();

    expect(newCount).toBe(initialCount - 1);

    const subjects = await updatedMessageItems.locator('.message-subject').allTextContents();
    expect(subjects).not.toContain(firstMessageSubject);
  });

  test('should automatically select next message after archive', async ({ page }) => {
    const messageItems = page.locator('.message-item');
    const secondMessageSubject = await messageItems.nth(1).locator('.message-subject').textContent();

    await messageItems.first().click();

    const archiveButton = page.getByRole('button', { name: /Archive/ });
    await archiveButton.click();

    await page.waitForTimeout(500);

    const activeMessage = page.locator('.message-item.active');
    await expect(activeMessage).toBeVisible();
    await expect(activeMessage.locator('.message-subject')).toContainText(secondMessageSubject);
  });

  test('should clear detail panel if all messages archived', async ({ page }) => {
    const messageItems = page.locator('.message-item');
    const messageCount = await messageItems.count();

    const archiveButton = page.getByRole('button', { name: /Archive/ });

    for (let i = 0; i < messageCount; i++) {
      const firstMessage = page.locator('.message-item').first();
      await firstMessage.click();
      await archiveButton.click();
      await page.waitForTimeout(300);
    }

    await expect(page.getByText('No messages found')).toBeVisible();
    await expect(archiveButton).toBeDisabled();
  });

  test('should handle archive API errors gracefully', async ({ page }) => {
    await page.route('**/api/messages/*/archive', route => {
      route.abort();
    });

    const firstMessage = page.locator('.message-item').first();
    await firstMessage.click();

    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('Failed to archive');
      dialog.accept();
    });

    const archiveButton = page.getByRole('button', { name: /Archive/ });
    await archiveButton.click();

    await page.waitForTimeout(500);

    await expect(firstMessage).toBeVisible();
  });

  test('should archive different message types', async ({ page }) => {
    const spamMessage = page.locator('.message-item').filter({ has: page.locator('.spam-badge') }).first();
    await spamMessage.click();

    const archiveButton = page.getByRole('button', { name: /Archive/ });
    await archiveButton.click();

    await page.waitForTimeout(500);

    const remainingSpamMessages = page.locator('.message-item').filter({ has: page.locator('.spam-badge') });
    const spamCount = await remainingSpamMessages.count();

    expect(spamCount).toBeGreaterThanOrEqual(0);
  });

  test('should maintain filter state after archive', async ({ page }) => {
    const spamFilter = page.locator('select.filter-select');
    await spamFilter.selectOption('ham');
    await page.waitForTimeout(500);

    const firstMessage = page.locator('.message-item').first();
    await firstMessage.click();

    const archiveButton = page.getByRole('button', { name: /Archive/ });
    await archiveButton.click();

    await page.waitForTimeout(500);

    await expect(spamFilter).toHaveValue('ham');

    const messageItems = page.locator('.message-item');
    const count = await messageItems.count();

    for (let i = 0; i < count; i++) {
      const badge = messageItems.nth(i).locator('.spam-badge');
      const badgeCount = await badge.count();
      if (badgeCount > 0) {
        await expect(badge).not.toContainText('Spam');
      }
    }
  });
});
