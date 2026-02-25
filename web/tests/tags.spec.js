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

        // Handle Auth
        await page.fill('#username', 'admin');
        await page.fill('#password', 'password');
        await page.click('button[type="submit"]');
        // Wait for login to complete and redirect/UI update
        // The modal itself might disappear or we might navigate.
        // In the app, the AuthModal has v-if="showAuthModal".
        // When login succeeds, showAuthModal becomes false.
        // BUT, since we have a full view now, we might not have .modal class if it's a page?
        // Wait, LoginView is a page component now at /login.
        // But App.vue still has AuthModal?
        // Let's check App.vue. It has <AuthModal :show="showAuthModal" ... />.
        // AND <div v-if="!showAuthModal" class="app-layout">.
        // Wait, I replaced App.vue to use router-view? No, I didn't update App.vue to use router-view!
        // I created LoginView.vue and updated router/index.js, but I didn't update App.vue to use the router!
        // This explains why the tests failed with timeouts - the UI structure might be weird or mixed.
        // Actually, the previous step just said "Update Frontend Router".
        // I checked `web/src/main.js` and `web/src/App.vue`.
        // I need to update App.vue to use <router-view> and remove the manual AuthModal if I'm switching to a route-based login.
        // OR keep AuthModal if I want a modal login.
        // The prompt asked for a "login page".
        // My plan step said "Update Frontend Router ... Add /login route".
        // So I should have updated App.vue.
        // I MISSED UPDATING APP.VUE TO USE ROUTER-VIEW.
        // This is a critical finding.
        // I will finish fixing the tests assuming I WILL fix App.vue.
        // But first I should probably fix App.vue.
        // Re-reading my previous actions... I wrote `web/src/views/LoginView.vue` and `web/src/router/index.js`.
        // I did NOT modify `web/src/App.vue` to use `<router-view>`.
        // Currently `App.vue` imports `AuthModal` and conditionally renders it.
        // If I change to router-based, `App.vue` should mainly be the layout shell or just `<router-view>`.

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
        // Mock POST /api/tags - must pass through GET so beforeEach's handler can serve initial tags
        const postRequestPromise = page.waitForRequest(
            (req) => req.url().includes('/api/tags') && req.method() === 'POST',
            { timeout: 5000 }
        );

        await page.route('**/api/tags', async route => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify({ id: '2', name: 'MyNewTag' })
                });
            } else {
                await route.continue();
            }
        });

        // Click Add button
        await page.click('button[aria-label="Add Tag"]');

        // Type name and enter
        await page.fill('input[placeholder="New tag..."]', 'MyNewTag');
        await page.press('input[placeholder="New tag..."]', 'Enter');

        // Verify request
        const postRequest = await postRequestPromise;
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
