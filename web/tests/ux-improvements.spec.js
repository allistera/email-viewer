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
<<<<<<< HEAD
        await expect(page.locator('.tag-sidebar')).toBeVisible({ timeout: 10000 });
=======
        await page.fill('input[type="password"]', 'dev-token-12345');
        await page.click('button[type="submit"]');
        await expect(page.locator('.modal')).toBeHidden();
>>>>>>> d2bd57a (WIP)

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
        // Mock send API with delay
        await page.route('**/api/send**', async route => {
            if (route.request().method() === 'POST') {
                await new Promise(resolve => setTimeout(resolve, 1000));
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

        // Click send
        const sendBtn = page.locator('button[type="submit"]');
        const sendPromise = sendBtn.click();

        // Verify loading state
        await expect(sendBtn).toHaveAttribute('aria-busy', 'true');
        await expect(sendBtn).toHaveText(/Sending.../);
        const spinner = sendBtn.locator('.spinner');
        await expect(spinner).toBeVisible();
        await sendPromise;

        // Wait for completion
        await expect(page.locator('.compose-modal')).toBeHidden();
    });
});
