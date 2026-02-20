import { test, expect } from '@playwright/test';

test.describe('Tag Sidebar Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API
    await page.route('**/api/messages*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] })
      });
    });

    await page.route('**/api/tags', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: '1', name: 'Work' },
          { id: '2', name: 'Personal' }
        ])
      });
    });

    await page.goto('/');
    await page.fill('input[type="password"]', 'dummy-token');
    await page.click('button[type="submit"]');
    await expect(page.locator('.modal')).toBeHidden();
  });

  test('should have accessible attributes', async ({ page }) => {
    const inbox = page.locator('.inbox-item');
    await expect(inbox).toHaveAttribute('role', 'button');
    await expect(inbox).toHaveAttribute('tabindex', '0');
    await expect(inbox).toHaveAttribute('aria-label', 'Go to Inbox');

    // Default selection is Inbox
    await expect(inbox).toHaveAttribute('aria-current', 'page');

    const workTag = page.locator('.tag-item').filter({ hasText: 'Work' });
    await expect(workTag).toHaveAttribute('role', 'button');
    await expect(workTag).toHaveAttribute('tabindex', '0');
    await expect(workTag).toHaveAttribute('aria-label', 'Select tag Work');
  });

  test('should support keyboard navigation and activation', async ({ page }) => {
    const inbox = page.locator('.inbox-item');
    const workTag = page.locator('.tag-item').filter({ hasText: 'Work' });

    // Initially Inbox is selected
    await expect(inbox).toHaveClass(/active/);
    await expect(inbox).toHaveAttribute('aria-current', 'page');

    // Click Work tag via keyboard (Enter)
    await workTag.focus();
    await page.keyboard.press('Enter');

    // Verify selection changed
    await expect(workTag).toHaveClass(/active/);
    await expect(workTag).toHaveAttribute('aria-current', 'page');
    await expect(inbox).not.toHaveClass(/active/);
    await expect(inbox).not.toHaveAttribute('aria-current', 'page');

    // Go back to Inbox via keyboard (Space)
    await inbox.focus();
    await page.keyboard.press('Space');

    await expect(inbox).toHaveClass(/active/);
    await expect(inbox).toHaveAttribute('aria-current', 'page');
  });

  test('should reveal actions on focus', async ({ page }) => {
    const workTag = page.locator('.tag-item').filter({ hasText: 'Work' });
    const deleteBtn = workTag.locator('.delete-btn');

    // Initially hidden
    await expect(deleteBtn).toBeHidden();

    // Focus parent
    await workTag.focus();

    // Should be visible (check computed style or visibility)
    // Note: Playwright's toBeVisible() checks strictly for layout visibility.
    // Since we use display: none -> display: flex, it should work.
    await expect(deleteBtn).toBeVisible();
  });
});
