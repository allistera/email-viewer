import { test, expect } from '@playwright/test';

test.describe('TagSidebar - Accessibility', () => {
    test.beforeEach(async ({ page }) => {
        // Mock initial data
        await page.route('**/api/messages*', async route => {
             await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ items: [] })
            });
        });

        await page.route('**/api/messages/counts', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ inbox: 0, archive: 0, spam: 0, sent: 0, tags: {} })
            });
        });

        await page.route('**/api/tags', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    { id: '1', name: 'Work', label: 'Work' },
                    { id: '2', name: 'Personal', label: 'Personal' }
                ])
            });
        });

        await page.route('**/api/messages/counts', async route => {
             await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ inbox: 5, archive: 10, spam: 2, tags: { 'Work': 3, 'Personal': 1 } })
            });
        });

        await page.route('**/api/auth/login', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ token: 'mock-token', user: { id: 1, email: 'test@example.com' } })
            });
        });

        await page.goto('/');

        await page.evaluate(() => {
            localStorage.setItem('email_api_token', 'mock-token');
        });
        await page.reload();
        await page.waitForSelector('.modal', { state: 'hidden', timeout: 5000 }).catch(() => {});

        await expect(page.locator('.modal')).toBeHidden({ timeout: 5000 });
    });

    test('should have accessible tags with role button', async ({ page }) => {
        // Check Inbox
        const inbox = page.locator('.inbox-item');
        await expect(inbox).toHaveAttribute('role', 'button');
        await expect(inbox).toHaveAttribute('tabindex', '0');

        // Check user tags
        const workTag = page.locator('.tag-item').filter({ hasText: 'Work' }).first();
        await expect(workTag).toHaveAttribute('role', 'button');
        await expect(workTag).toHaveAttribute('tabindex', '0');

        // Check system tags
        const spamTag = page.locator('.tag-item').filter({ hasText: 'Spam' }).first();
        await expect(spamTag).toHaveAttribute('role', 'button');
        await expect(spamTag).toHaveAttribute('tabindex', '0');
    });

    test('should indicate current page', async ({ page }) => {
        // Inbox is selected by default
        const inbox = page.locator('.inbox-item');
        await expect(inbox).toHaveAttribute('aria-current', 'page');

        // Select Work
        const workTag = page.locator('.tag-item').filter({ hasText: 'Work' }).first();
        await workTag.click();

        await expect(workTag).toHaveAttribute('aria-current', 'page');
        await expect(inbox).not.toHaveAttribute('aria-current');
    });

    test('should show actions on focus within', async ({ page }) => {
        const workTag = page.locator('.tag-item').filter({ hasText: 'Work' }).first();
        const editBtn = workTag.locator('.edit-btn');

        // Initially hidden
        await expect(editBtn).not.toBeVisible();

        // Focus the tag
        await workTag.focus();

        // Should be visible now
        await expect(editBtn).toBeVisible();
    });

    test('should allow keyboard activation', async ({ page }) => {
        const workTag = page.locator('.tag-item').filter({ hasText: 'Work' }).first();

        // Focus and press Enter
        await workTag.focus();
        await page.keyboard.press('Enter');

        // Verify it becomes active
        await expect(workTag).toHaveClass(/active/);
        await expect(workTag).toHaveAttribute('aria-current', 'page');
    });
});
