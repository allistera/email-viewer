import { test, expect } from '@playwright/test';

test.describe('Tags CRUD', () => {
    test.beforeEach(async ({ page }) => {
        // Mock API endpoints to bypass backend/auth and test UI logic directly

        // Mock Messages (needed for auth check pass)
        await page.route('**/api/messages*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ items: [] })
            });
        });

        // Mock initial Tags with Spam and a User tag
        await page.route('**/api/tags', async route => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([
                        { id: '1', name: 'ExistingTag' },
                        { id: 'spam-id', name: 'Spam' }
                    ])
                });
            } else {
                await route.continue();
            }
        });

        await page.goto('/');

        // Handle Auth
        await page.fill('input[type="password"]', 'dummy-token');
        await page.click('button[type="submit"]');
        await expect(page.locator('.modal')).toBeHidden();
    });

    test('should display existing tags including Spam', async ({ page }) => {
        await expect(page.locator('.tag-label', { hasText: 'ExistingTag' })).toBeVisible();
        await expect(page.locator('.tag-label', { hasText: 'Spam' })).toBeVisible();
    });

    test('should not show delete button for Spam tag', async ({ page }) => {
        const spamItem = page.locator('.tag-item', { hasText: 'Spam' });
        await spamItem.hover();
        await expect(spamItem.locator('button[aria-label="Delete Tag"]')).toBeHidden();
    });

    test('should show delete button for user tag', async ({ page }) => {
        const userItem = page.locator('.tag-item', { hasText: 'ExistingTag' });
        await userItem.hover();
        await expect(userItem.locator('button[aria-label="Delete Tag"]')).toBeVisible();
    });

    test('should add a new tag', async ({ page }) => {
        // Mock POST /api/tags
        let postRequest;
        await page.route('**/api/tags', async route => {
            if (route.request().method() === 'POST') {
                postRequest = route.request();
                await route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify({ id: '2', name: 'MyNewTag' })
                });
            }
        });

        // Click Add button
        await page.click('button[aria-label="Add Tag"]');

        // Type name and enter
        await page.fill('input[placeholder="New tag..."]', 'MyNewTag');
        await page.press('input[placeholder="New tag..."]', 'Enter');

        // Verify request
        expect(postRequest).toBeTruthy();
        expect(postRequest.postDataJSON()).toEqual({ name: 'MyNewTag' });

        // Verify UI update
        await expect(page.locator('.tag-label', { hasText: 'MyNewTag' })).toBeVisible();
    });

    test('should delete a tag', async ({ page }) => {
        // Mock DELETE /api/tags/1
        let deleteRequest;
        await page.route('**/api/tags/1', async route => {
            if (route.request().method() === 'DELETE') {
                deleteRequest = route.request();
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ ok: true })
                });
            }
        });

        // Handle confirm dialog
        page.on('dialog', dialog => dialog.accept());

        // Hover over tag to see delete button (if CSS requires hover, otherwise force click)
        const tagItem = page.locator('.tag-item', { hasText: 'ExistingTag' });
        await tagItem.hover();

        // Click delete
        await tagItem.locator('button[aria-label="Delete Tag"]').click();

        // Verify request
        expect(deleteRequest).toBeTruthy();

        // Verify UI update
        await expect(page.locator('.tag-label', { hasText: 'ExistingTag' })).toBeHidden();
    });
});

test.describe('Spam tag fallback', () => {
    test.beforeEach(async ({ page }) => {
        await page.route('**/api/messages*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ items: [] })
            });
        });

        await page.route('**/api/tags', async route => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([
                        { id: '1', name: 'ExistingTag' }
                    ])
                });
            }
        });

        await page.goto('/');

        await page.fill('input[type="password"]', 'dummy-token');
        await page.click('button[type="submit"]');
        await expect(page.locator('.modal')).toBeHidden();
    });

    test('should always display Spam tag even when missing from API', async ({ page }) => {
        await expect(page.locator('.tag-label', { hasText: 'Spam' })).toBeVisible();
    });
});
