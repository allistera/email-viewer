import { test, expect } from '@playwright/test';

const DEBOUNCE_WAIT = 200;

test.describe('Compose Modal - Accessibility', () => {
    test.beforeEach(async ({ page }) => {
        // Mock API endpoints
        await page.route('**/api/messages*', async route => {
            await route.fulfill({ status: 200, body: JSON.stringify({ items: [] }) });
        });
        await page.route('**/api/tags', async route => {
            await route.fulfill({ status: 200, body: JSON.stringify([]) });
        });

        await page.goto('/');
        await page.fill('input[type="password"]', 'dummy-token');
        await page.click('button[type="submit"]');
        await page.getByRole('button', { name: 'Compose' }).click();
        await expect(page.locator('.compose-modal')).toBeVisible();
    });

    test('should have proper dialog roles', async ({ page }) => {
        const modal = page.locator('.compose-modal');
        await expect(modal).toHaveAttribute('role', 'dialog');
        await expect(modal).toHaveAttribute('aria-modal', 'true');
        await expect(modal).toHaveAttribute('aria-labelledby', 'compose-title');

        const title = page.locator('.compose-header h2');
        await expect(title).toHaveId('compose-title');
    });

    test('should have accessible autocomplete', async ({ page }) => {
        // Mock contacts
        await page.route('**/api/contacts*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    contacts: [
                        { email: 'test1@example.com' },
                        { email: 'test2@example.com' }
                    ]
                })
            });
        });

        const input = page.locator('#compose-to');
        const listbox = page.locator('.suggestions-dropdown');

        // Check initial state
        await expect(input).toHaveAttribute('role', 'combobox');
        await expect(input).toHaveAttribute('aria-autocomplete', 'list');
        await expect(input).toHaveAttribute('aria-expanded', 'false');
        await expect(input).toHaveAttribute('aria-controls', 'suggestions-listbox');

        // Type to show suggestions
        await input.fill('test');

        // Wait for suggestions to appear
        await expect(listbox).toBeVisible();

        // Check expanded state
        await expect(input).toHaveAttribute('aria-expanded', 'true');
        await expect(listbox).toHaveId('suggestions-listbox');
        await expect(listbox).toHaveAttribute('role', 'listbox');

        // Check options
        const options = listbox.locator('li');
        await expect(options.nth(0)).toHaveAttribute('role', 'option');
        await expect(options.nth(0)).toHaveAttribute('aria-selected', 'false');

        // Navigate
        await input.press('ArrowDown');

        // Check active descendant and selection
        await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
        const optionId = await options.nth(0).getAttribute('id');
        expect(optionId).toBeTruthy();
        await expect(input).toHaveAttribute('aria-activedescendant', optionId);

        // Navigate again
        await input.press('ArrowDown');
        await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
        const optionId2 = await options.nth(1).getAttribute('id');
        expect(optionId2).toBeTruthy();
        await expect(input).toHaveAttribute('aria-activedescendant', optionId2);
    });
});
