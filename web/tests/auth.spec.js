import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await context.addInitScript(() => {
      localStorage.clear();
    });
    await page.goto('/');
  });

  test('should show auth modal on first visit', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Authentication Required' })).toBeVisible();
    await expect(page.getByPlaceholder('API Token')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  });

  test('should login with valid token', async ({ page }) => {
    const tokenInput = page.getByPlaceholder('API Token');
    await tokenInput.fill('dev-token-12345');

    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText('Inbox')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Authentication Required' })).not.toBeVisible();
  });

  test('should show error with invalid token', async ({ page }) => {
    const tokenInput = page.getByPlaceholder('API Token');
    await tokenInput.fill('invalid-token');

    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.waitForTimeout(1000);

    await expect(tokenInput).toBeVisible();
  });

  test('should persist token in localStorage', async ({ page }) => {
    const tokenInput = page.getByPlaceholder('API Token');
    await tokenInput.fill('dev-token-12345');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText('Inbox')).toBeVisible();

    await page.reload();

    await expect(page.getByText('Inbox')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Authentication Required' })).not.toBeVisible();
  });

  test('should disable continue button when token is empty', async ({ page }) => {
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await expect(continueButton).toBeDisabled();

    const tokenInput = page.getByPlaceholder('API Token');
    await tokenInput.fill('test');

    await expect(continueButton).toBeEnabled();
  });

  test('should have password type input for security', async ({ page }) => {
    const tokenInput = page.getByPlaceholder('API Token');
    await expect(tokenInput).toHaveAttribute('type', 'password');
  });
});
