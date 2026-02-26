import { test, expect } from '@playwright/test';

test.describe('Smoke Test', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: 'Authentication Required' })).toBeVisible({ timeout: 10000 });
  });
});
