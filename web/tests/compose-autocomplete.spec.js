import { test, expect } from '@playwright/test';

// Timing constants to match ComposeModal debounce and blur delays
const DEBOUNCE_WAIT = 200; // 150ms debounce + 50ms buffer
const BLUR_WAIT = 300; // 200ms blur delay + 100ms buffer

test.describe('Compose Modal - Email Autocomplete', () => {
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

    test('should show dropdown with suggestions when typing in To field', async ({ page }) => {
        // Mock contacts API
        await page.route('**/api/contacts?q=john**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    contacts: [
                        { email: 'john.doe@example.com' },
                        { email: 'john.smith@example.com' },
                        { email: 'johnny@example.com' }
                    ]
                })
            });
        });

        // Type in the To field
        const toInput = page.locator('#compose-to');
        await toInput.fill('john');

        // Wait for debounce (150ms) + some buffer
        await page.waitForTimeout(DEBOUNCE_WAIT);

        // Verify dropdown is visible
        const dropdown = page.locator('.suggestions-dropdown');
        await expect(dropdown).toBeVisible();

        // Verify suggestions are displayed
        await expect(dropdown.locator('li')).toHaveCount(3);
        await expect(dropdown.locator('li').first()).toHaveText('john.doe@example.com');
        await expect(dropdown.locator('li').nth(1)).toHaveText('john.smith@example.com');
        await expect(dropdown.locator('li').nth(2)).toHaveText('johnny@example.com');
    });

    test('should navigate suggestions with ArrowDown key', async ({ page }) => {
        // Mock contacts API
        await page.route('**/api/contacts?q=test**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    contacts: [
                        { email: 'test1@example.com' },
                        { email: 'test2@example.com' },
                        { email: 'test3@example.com' }
                    ]
                })
            });
        });

        const toInput = page.locator('#compose-to');
        await toInput.fill('test');
        await page.waitForTimeout(DEBOUNCE_WAIT);

        const dropdown = page.locator('.suggestions-dropdown');
        await expect(dropdown).toBeVisible();

        // Press ArrowDown to select first item
        await toInput.press('ArrowDown');
        await expect(dropdown.locator('li').first()).toHaveClass(/selected/);

        // Press ArrowDown again to select second item
        await toInput.press('ArrowDown');
        await expect(dropdown.locator('li').nth(1)).toHaveClass(/selected/);

        // Press ArrowDown again to select third item
        await toInput.press('ArrowDown');
        await expect(dropdown.locator('li').nth(2)).toHaveClass(/selected/);

        // Press ArrowDown again - should stay on last item
        await toInput.press('ArrowDown');
        await expect(dropdown.locator('li').nth(2)).toHaveClass(/selected/);
    });

    test('should navigate suggestions with ArrowUp key', async ({ page }) => {
        // Mock contacts API
        await page.route('**/api/contacts?q=test**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    contacts: [
                        { email: 'test1@example.com' },
                        { email: 'test2@example.com' },
                        { email: 'test3@example.com' }
                    ]
                })
            });
        });

        const toInput = page.locator('#compose-to');
        await toInput.fill('test');
        await page.waitForTimeout(DEBOUNCE_WAIT);

        const dropdown = page.locator('.suggestions-dropdown');
        await expect(dropdown).toBeVisible();

        // Navigate down to second item
        await toInput.press('ArrowDown');
        await toInput.press('ArrowDown');
        await expect(dropdown.locator('li').nth(1)).toHaveClass(/selected/);

        // Press ArrowUp to go back to first item
        await toInput.press('ArrowUp');
        await expect(dropdown.locator('li').first()).toHaveClass(/selected/);

        // Press ArrowUp again - should deselect (index -1)
        await toInput.press('ArrowUp');
        await expect(dropdown.locator('li.selected')).toHaveCount(0);
    });

    test('should select suggestion with Enter key', async ({ page }) => {
        // Mock contacts API
        await page.route('**/api/contacts?q=alice**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    contacts: [
                        { email: 'alice@example.com' },
                        { email: 'alice.smith@example.com' }
                    ]
                })
            });
        });

        const toInput = page.locator('#compose-to');
        await toInput.fill('alice');
        await page.waitForTimeout(DEBOUNCE_WAIT);

        const dropdown = page.locator('.suggestions-dropdown');
        await expect(dropdown).toBeVisible();

        // Navigate to second suggestion
        await toInput.press('ArrowDown');
        await toInput.press('ArrowDown');

        // Press Enter to select
        await toInput.press('Enter');

        // Verify the To field is filled with selected email
        await expect(toInput).toHaveValue('alice.smith@example.com');

        // Verify dropdown is hidden
        await expect(dropdown).toBeHidden();

        // Verify focus moved to subject field
        await expect(page.locator('#compose-subject')).toBeFocused();
    });

    test('should hide dropdown on Escape key', async ({ page }) => {
        // Mock contacts API
        await page.route('**/api/contacts?q=bob**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    contacts: [
                        { email: 'bob@example.com' }
                    ]
                })
            });
        });

        const toInput = page.locator('#compose-to');
        await toInput.fill('bob');
        await page.waitForTimeout(DEBOUNCE_WAIT);

        const dropdown = page.locator('.suggestions-dropdown');
        await expect(dropdown).toBeVisible();

        // Press Escape - this will hide the dropdown and also close the modal (current behavior)
        await page.keyboard.press('Escape');

        // Verify dropdown is hidden (modal will also be closed)
        const modal = page.locator('.compose-modal');
        await expect(modal).toBeHidden();
    });

    test('should hide dropdown on blur', async ({ page }) => {
        // Mock contacts API
        await page.route('**/api/contacts?q=charlie**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    contacts: [
                        { email: 'charlie@example.com' }
                    ]
                })
            });
        });

        const toInput = page.locator('#compose-to');
        await toInput.fill('charlie');
        await page.waitForTimeout(DEBOUNCE_WAIT);

        const dropdown = page.locator('.suggestions-dropdown');
        await expect(dropdown).toBeVisible();

        // Use Tab to move focus away (blur the field)
        await page.keyboard.press('Tab');

        // Wait for blur timer (200ms) + buffer
        await page.waitForTimeout(BLUR_WAIT);

        // Verify dropdown is hidden
        await expect(dropdown).toBeHidden();
    });

    test('should select suggestion by clicking', async ({ page }) => {
        // Mock contacts API
        await page.route('**/api/contacts?q=diana**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    contacts: [
                        { email: 'diana@example.com' },
                        { email: 'diana.prince@example.com' }
                    ]
                })
            });
        });

        const toInput = page.locator('#compose-to');
        await toInput.fill('diana');
        await page.waitForTimeout(DEBOUNCE_WAIT);

        const dropdown = page.locator('.suggestions-dropdown');
        await expect(dropdown).toBeVisible();

        // Click on the second suggestion
        await dropdown.locator('li').nth(1).click();

        // Verify the To field is filled with selected email
        await expect(toInput).toHaveValue('diana.prince@example.com');

        // Verify dropdown is hidden
        await expect(dropdown).toBeHidden();

        // Verify focus moved to subject field
        await expect(page.locator('#compose-subject')).toBeFocused();
    });

    test('should not show dropdown when query is empty', async ({ page }) => {
        const toInput = page.locator('#compose-to');
        const dropdown = page.locator('.suggestions-dropdown');

        // Clear any existing value
        await toInput.fill('');
        await page.waitForTimeout(DEBOUNCE_WAIT);

        // Verify dropdown is not visible
        await expect(dropdown).not.toBeVisible();
    });

    test('should not show dropdown when no contacts match', async ({ page }) => {
        // Mock contacts API with empty results
        await page.route('**/api/contacts?q=xyz**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    contacts: []
                })
            });
        });

        const toInput = page.locator('#compose-to');
        await toInput.fill('xyz');
        await page.waitForTimeout(DEBOUNCE_WAIT);

        const dropdown = page.locator('.suggestions-dropdown');

        // Verify dropdown is not visible when there are no results
        await expect(dropdown).not.toBeVisible();
    });

    test('should update suggestions when typing continues', async ({ page }) => {
        // Mock contacts API for 'e'
        await page.route('**/api/contacts?q=e**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    contacts: [
                        { email: 'eve@example.com' },
                        { email: 'eric@example.com' }
                    ]
                })
            });
        });

        // Mock contacts API for 'ev'
        await page.route('**/api/contacts?q=ev**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    contacts: [
                        { email: 'eve@example.com' }
                    ]
                })
            });
        });

        const toInput = page.locator('#compose-to');
        await toInput.fill('e');
        await page.waitForTimeout(DEBOUNCE_WAIT);

        const dropdown = page.locator('.suggestions-dropdown');
        await expect(dropdown).toBeVisible();
        await expect(dropdown.locator('li')).toHaveCount(2);

        // Type another character
        await toInput.fill('ev');
        await page.waitForTimeout(DEBOUNCE_WAIT);

        // Verify dropdown updated with new results
        await expect(dropdown).toBeVisible();
        await expect(dropdown.locator('li')).toHaveCount(1);
        await expect(dropdown.locator('li').first()).toHaveText('eve@example.com');
    });

    test('should highlight suggestion on mouse hover', async ({ page }) => {
        // Mock contacts API
        await page.route('**/api/contacts?q=frank**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    contacts: [
                        { email: 'frank@example.com' },
                        { email: 'franklin@example.com' }
                    ]
                })
            });
        });

        const toInput = page.locator('#compose-to');
        await toInput.fill('frank');
        await page.waitForTimeout(DEBOUNCE_WAIT);

        const dropdown = page.locator('.suggestions-dropdown');
        await expect(dropdown).toBeVisible();

        // Hover over the second suggestion
        await dropdown.locator('li').nth(1).hover();

        // Verify it's highlighted/selected
        await expect(dropdown.locator('li').nth(1)).toHaveClass(/selected/);
    });
});
