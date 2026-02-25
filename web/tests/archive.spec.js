import { test, expect } from '@playwright/test';

test.describe('Done Message', () => {
    test.beforeEach(async ({ page }) => {
        // Mock all API endpoints before navigation
        await page.route('**/api/messages/**', async route => {
            const url = route.request().url();
            if (url.includes('/archive')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ ok: true })
                });
            } else {
                // Single message detail
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: 'msg-1',
                        subject: 'Test Email',
                        from: 'sender@test.com',
                        to: 'me@test.com',
                        received_at: new Date().toISOString(),
                        text_body: 'Hello world',
                        tags: []
                    })
                });
            }
        });

        await page.route('**/api/messages?*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    items: [{
                        id: 'msg-1',
                        subject: 'Test Email',
                        from: 'sender@test.com',
                        snippet: 'Hello world',
                        received_at: new Date().toISOString(),
                        tag: null
                    }],
                    nextBefore: null
                })
            });
        });

        await page.route('**/api/tags', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([{ id: 'spam-id', name: 'Spam' }])
            });
        });

        // Mock Login
        await page.route('**/api/auth/login', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    token: 'dummy-token',
                    user: { id: 'user-id', username: 'admin' }
                })
            });
        });

        await page.goto('/');

        // Authenticate
        await page.fill('#username', 'admin');
        await page.fill('#password', 'password');
        await page.click('button[type="submit"]');
    });

    test('should display Done button in toolbar', async ({ page }) => {
        // Wait for message detail to load
        await expect(page.locator('.toolbar-btn', { hasText: 'Done' })).toBeVisible({ timeout: 10000 });
    });

    test('should mark message as done when clicking Done button', async ({ page }) => {
        // Wait for toolbar
        await expect(page.locator('.toolbar-btn', { hasText: 'Done' })).toBeVisible({ timeout: 10000 });

        // Track if archive was called
        let archiveCalled = false;
        await page.route('**/api/messages/*/archive', async route => {
            archiveCalled = true;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ ok: true })
            });
        });

        // Click Done button
        await page.locator('.toolbar-btn', { hasText: 'Done' }).click();

        // Wait for the request to be made
        await page.waitForTimeout(500);

        // Verify archive API was called
        expect(archiveCalled).toBe(true);
    });
});
