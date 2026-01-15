import { test, expect } from '@playwright/test';

test.describe('Custom Filters', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await context.addInitScript(() => {
      localStorage.clear();
    });
    await page.goto('/');

    const tokenInput = page.getByPlaceholder('API Token');
    await tokenInput.fill('dev-token-12345');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText('Inbox')).toBeVisible();
  });

  test('should show add filter button', async ({ page }) => {
    const addFilterButton = page.getByRole('button', { name: '+ Add Filter' });
    await expect(addFilterButton).toBeVisible();
  });

  test('should open filter modal on add filter click', async ({ page }) => {
    const addFilterButton = page.getByRole('button', { name: '+ Add Filter' });
    await addFilterButton.click();

    await expect(page.getByRole('heading', { name: 'Create Filter' })).toBeVisible();
    await expect(page.getByLabel('Filter Name')).toBeVisible();
    await expect(page.getByLabel('Filter Type')).toBeVisible();
  });

  test('should create sender filter', async ({ page }) => {
    const addFilterButton = page.getByRole('button', { name: '+ Add Filter' });
    await addFilterButton.click();

    await page.getByLabel('Filter Name').fill('Work Emails');
    await page.getByLabel('Filter Type').selectOption('sender');
    await page.getByLabel('Sender Email or Domain').fill('@company.com');

    await page.getByRole('button', { name: 'Create Filter' }).click();

    await expect(page.locator('.filter-chip')).toContainText('Work Emails');
  });

  test('should create subject filter', async ({ page }) => {
    const addFilterButton = page.getByRole('button', { name: '+ Add Filter' });
    await addFilterButton.click();

    await page.getByLabel('Filter Name').fill('Invoices');
    await page.getByLabel('Filter Type').selectOption('subject');
    await page.getByLabel('Subject Keywords').fill('invoice');

    await page.getByRole('button', { name: 'Create Filter' }).click();

    await expect(page.locator('.filter-chip')).toContainText('Invoices');
  });

  test('should create spam status filter', async ({ page }) => {
    const addFilterButton = page.getByRole('button', { name: '+ Add Filter' });
    await addFilterButton.click();

    await page.getByLabel('Filter Name').fill('Only Safe');
    await page.getByLabel('Filter Type').selectOption('spam');
    await page.getByLabel('Spam Status').selectOption('ham');

    await page.getByRole('button', { name: 'Create Filter' }).click();

    await expect(page.locator('.filter-chip')).toContainText('Only Safe');
  });

  test('should validate required fields', async ({ page }) => {
    const addFilterButton = page.getByRole('button', { name: '+ Add Filter' });
    await addFilterButton.click();

    const createButton = page.getByRole('button', { name: 'Create Filter' });
    await expect(createButton).toBeDisabled();

    await page.getByLabel('Filter Name').fill('Test');
    await expect(createButton).toBeDisabled();

    await page.getByLabel('Sender Email or Domain').fill('test@example.com');
    await expect(createButton).toBeEnabled();
  });

  test('should close modal on cancel', async ({ page }) => {
    const addFilterButton = page.getByRole('button', { name: '+ Add Filter' });
    await addFilterButton.click();

    await expect(page.getByRole('heading', { name: 'Create Filter' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('heading', { name: 'Create Filter' })).not.toBeVisible();
  });

  test('should activate filter on click', async ({ page }) => {
    const addFilterButton = page.getByRole('button', { name: '+ Add Filter' });
    await addFilterButton.click();

    await page.getByLabel('Filter Name').fill('Work Emails');
    await page.getByLabel('Filter Type').selectOption('sender');
    await page.getByLabel('Sender Email or Domain').fill('@company.com');
    await page.getByRole('button', { name: 'Create Filter' }).click();

    const filterChip = page.locator('.filter-chip').filter({ hasText: 'Work Emails' });
    await expect(filterChip).not.toHaveClass(/active/);

    await filterChip.click();
    await expect(filterChip).toHaveClass(/active/);
  });

  test('should deactivate filter on second click', async ({ page }) => {
    const addFilterButton = page.getByRole('button', { name: '+ Add Filter' });
    await addFilterButton.click();

    await page.getByLabel('Filter Name').fill('Work Emails');
    await page.getByLabel('Filter Type').selectOption('sender');
    await page.getByLabel('Sender Email or Domain').fill('@company.com');
    await page.getByRole('button', { name: 'Create Filter' }).click();

    const filterChip = page.locator('.filter-chip').filter({ hasText: 'Work Emails' });

    await filterChip.click();
    await expect(filterChip).toHaveClass(/active/);

    await filterChip.click();
    await expect(filterChip).not.toHaveClass(/active/);
  });

  test('should remove filter on × click', async ({ page }) => {
    const addFilterButton = page.getByRole('button', { name: '+ Add Filter' });
    await addFilterButton.click();

    await page.getByLabel('Filter Name').fill('Test Filter');
    await page.getByLabel('Filter Type').selectOption('sender');
    await page.getByLabel('Sender Email or Domain').fill('test@example.com');
    await page.getByRole('button', { name: 'Create Filter' }).click();

    const filterChip = page.locator('.filter-chip').filter({ hasText: 'Test Filter' });
    await expect(filterChip).toBeVisible();

    const removeButton = filterChip.locator('.filter-remove');
    await removeButton.click();

    await expect(filterChip).not.toBeVisible();
  });

  test('should persist filters in localStorage', async ({ page }) => {
    const addFilterButton = page.getByRole('button', { name: '+ Add Filter' });
    await addFilterButton.click();

    await page.getByLabel('Filter Name').fill('Persistent Filter');
    await page.getByLabel('Filter Type').selectOption('sender');
    await page.getByLabel('Sender Email or Domain').fill('persist@example.com');
    await page.getByRole('button', { name: 'Create Filter' }).click();

    await page.reload();

    const tokenInput = page.getByPlaceholder('API Token');
    await tokenInput.fill('dev-token-12345');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.locator('.filter-chip')).toContainText('Persistent Filter');
  });

  test('should filter messages by sender', async ({ page }) => {
    const addFilterButton = page.getByRole('button', { name: '+ Add Filter' });
    await addFilterButton.click();

    await page.getByLabel('Filter Name').fill('Alice Only');
    await page.getByLabel('Filter Type').selectOption('sender');
    await page.getByLabel('Sender Email or Domain').fill('alice');
    await page.getByRole('button', { name: 'Create Filter' }).click();

    const filterChip = page.locator('.filter-chip').filter({ hasText: 'Alice Only' });
    await filterChip.click();

    await page.waitForTimeout(500);

    const visibleMessages = page.locator('.message-item');
    const count = await visibleMessages.count();

    for (let i = 0; i < count; i++) {
      const message = visibleMessages.nth(i);
      await expect(message.locator('.from')).toContainText('alice');
    }
  });
});
