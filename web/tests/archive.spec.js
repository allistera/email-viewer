import { test, expect } from '@playwright/test';

test.describe('Done Message', () => {
    test.beforeEach(async ({ page }) => {
        // Pre-set auth token to bypass auth modal
        await page.addInitScript(() => {
            localStorage.setItem('email_api_token', 'test-token');
        });

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

        await page.route('**/api/messages/counts', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ inbox: 1, archive: 0, spam: 0, tags: {} })
            });
        });

        await page.goto('/');
        await expect(page.locator('.tag-sidebar')).toBeVisible({ timeout: 10000 });
    });

    test('should display Done button in toolbar', async ({ page }) => {
        // Wait for message detail to load
        await expect(page.locator('.toolbar-btn', { hasText: 'Done' })).toBeVisible({ timeout: 10000 });
    });

    test('should mark message as done when clicking Done button', async ({ page }) => {
        // Wait for toolbar
        await expect(page.locator('.toolbar-btn', { hasText: 'Done' })).toBeVisible({ timeout: 10000 });

        const archiveResponsePromise = page.waitForResponse(
            response => response.url().includes('/api/messages/') && response.url().includes('/archive') && response.status() === 200
        );

        // Click Done button
        await page.locator('.toolbar-btn', { hasText: 'Done' }).click();

        // Verify archive API was called
        await archiveResponsePromise;
    });
});
