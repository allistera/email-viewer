import { test, expect } from '@playwright/test';

// Timing constants to match ComposeModal debounce and blur delays
const DEBOUNCE_WAIT = 200; // 150ms debounce + 50ms buffer

test.describe('Compose Modal - Accessibility', () => {
    test.beforeEach(async ({ page }) => {
        // Mock API endpoints
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
                body: JSON.stringify([])
            });
        });

        await page.goto('/');

        // Authenticate
        await page.fill('input[type="password"]', 'dummy-token');
        await page.click('button[type="submit"]');
        await expect(page.locator('.modal')).toBeHidden();

        // Open compose modal
        await page.getByRole('button', { name: 'Compose' }).click();
        await expect(page.locator('.compose-modal')).toBeVisible();
    });

    test('should have dialog role and accessible name', async ({ page }) => {
        const modal = page.locator('.compose-modal');

        // Check for role="dialog"
        await expect(modal).toHaveAttribute('role', 'dialog');

        // Check for aria-modal="true"
        await expect(modal).toHaveAttribute('aria-modal', 'true');

        // Check for aria-labelledby pointing to the title
        await expect(modal).toHaveAttribute('aria-labelledby', 'compose-modal-title');

        // Check that the title has the correct ID
        const title = modal.locator('h2');
        await expect(title).toHaveId('compose-modal-title');
    });

    test('should have accessible suggestions dropdown', async ({ page }) => {
        // Mock contacts API
        await page.route('**/api/contacts?q=test**', async route => {
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

        const toInput = page.locator('#compose-to');

        // Check initial state of input
        await expect(toInput).toHaveAttribute('aria-haspopup', 'listbox');
        await expect(toInput).toHaveAttribute('aria-expanded', 'false');
        await expect(toInput).toHaveAttribute('autocomplete', 'off'); // Should remain off

        // Type to show suggestions
        await toInput.fill('test');
        await page.waitForTimeout(DEBOUNCE_WAIT);

        // Check expanded state
        await expect(toInput).toHaveAttribute('aria-expanded', 'true');

        const dropdown = page.locator('.suggestions-dropdown');
        await expect(dropdown).toBeVisible();

        // Check dropdown role and label
        await expect(dropdown).toHaveId('compose-suggestions');
        await expect(dropdown).toHaveAttribute('role', 'listbox');
        await expect(dropdown).toHaveAttribute('aria-label', 'Contact suggestions');

        // Check input controls the dropdown
        await expect(toInput).toHaveAttribute('aria-controls', 'compose-suggestions');

        // Check options
        const options = dropdown.locator('li');
        await expect(options).toHaveCount(2);

        const firstOption = options.first();
        await expect(firstOption).toHaveAttribute('role', 'option');
        await expect(firstOption).toHaveId(/suggestion-\d+/); // Should have an ID

        // Navigate to select an option
        await toInput.press('ArrowDown');

        // Check selection state
        await expect(firstOption).toHaveAttribute('aria-selected', 'true');

        // Check active descendant on input
        const firstOptionId = await firstOption.getAttribute('id');
        await expect(toInput).toHaveAttribute('aria-activedescendant', firstOptionId);

        // Navigate to second option
        await toInput.press('ArrowDown');
        const secondOption = options.nth(1);
        await expect(secondOption).toHaveAttribute('aria-selected', 'true');
        await expect(firstOption).toHaveAttribute('aria-selected', 'false');

        const secondOptionId = await secondOption.getAttribute('id');
        await expect(toInput).toHaveAttribute('aria-activedescendant', secondOptionId);
    });
});
