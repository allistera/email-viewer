import { test, expect } from '@playwright/test';

test.describe('Compose Modal - UX Improvements', () => {
    test.beforeEach(async ({ page }) => {
        // Pre-set auth token to bypass auth modal
        await page.addInitScript(() => {
            localStorage.setItem('email_api_token', 'test-token');
        });

        // Mock initial data to ensure clean state
        await page.route('**/api/messages?*', async route => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ items: [], nextBefore: null })
                });
            } else {
                await route.continue();
            }
        });

        await page.route('**/api/messages/counts', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ inbox: 0, archive: 0, spam: 0, tags: {} })
            });
        });

        await page.route('**/api/tags', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([])
            });
        });

        await page.goto('/');
        await expect(page.locator('.discord-sidebar')).toBeVisible({ timeout: 10000 });

        // Open compose modal
        await page.getByRole('button', { name: 'Compose' }).click();
        await expect(page.locator('.compose-modal')).toBeVisible();
    });

    test('should have accessible close button', async ({ page }) => {
        const closeBtn = page.locator('.compose-modal .close-btn');
        await expect(closeBtn).toHaveAttribute('aria-label', 'Close');
    });

    test('should have accessible recipient remove buttons', async ({ page }) => {
        // Add a recipient
        const toInput = page.locator('#compose-to');
        await toInput.fill('test@example.com');
        await toInput.press('Enter');

        const removeBtn = page.locator('.to-pill-remove').first();
        await expect(removeBtn).toHaveAttribute('aria-label', 'Remove test@example.com');
    });

    test('should show spinner and aria-busy when sending', async ({ page }) => {
        // Keep the send pending until we explicitly resolve it
        let resolveSend;
        await page.route('**/api/send**', async route => {
            if (route.request().method() === 'POST') {
                await new Promise(resolve => { resolveSend = resolve; });
                await route.fulfill({
                    status: 200,
                    body: JSON.stringify({ success: true })
                });
            } else {
                await route.continue();
            }
        });

        // Fill form
        await page.locator('#compose-to').fill('recipient@example.com');
        await page.locator('#compose-subject').fill('Test Subject');
        await page.locator('#compose-body').fill('Test Body');

        // Install fake clock before clicking Send so we can control the
        // 5-second undo countdown (setInterval inside handleSend).
        await page.clock.install();

        // Click send — starts the undo countdown
        await page.locator('button[type="submit"]').click();

        // Undo bar should appear while countdown runs
        await expect(page.locator('.undo-send-bar')).toBeVisible();

        // Tick through the 5-second countdown (runFor fires periodic timers
        // multiple times, unlike fastForward which only fires each timer once)
        await page.clock.runFor(5100);

        // Now the actual send is in-flight — verify the loading state
        const sendBtn = page.locator('button[type="submit"]');
        await expect(sendBtn).toHaveAttribute('aria-busy', 'true', { timeout: 3000 });
        await expect(sendBtn).toHaveText(/Sending\.\.\./);
        await expect(sendBtn.locator('.spinner')).toBeVisible();

        // Let the send complete and verify the modal closes
        resolveSend();
        await expect(page.locator('.compose-modal')).toBeHidden({ timeout: 10000 });
    });
});
