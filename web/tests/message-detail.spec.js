import { test, expect } from '@playwright/test';

test.describe('Message Detail', () => {
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

    const firstMessage = page.locator('.message-item').first();
    await firstMessage.click();
  });

  test('should display message header information', async ({ page }) => {
    await expect(page.locator('.message-detail')).toBeVisible();
    await expect(page.getByText('From:')).toBeVisible();
    await expect(page.getByText('alice@example.com')).toBeVisible();
    await expect(page.getByText('To:')).toBeVisible();
    await expect(page.getByText('me@mydomain.com')).toBeVisible();
  });

  test('should display message subject', async ({ page }) => {
    await expect(page.getByText('Quarterly Report Ready for Review')).toBeVisible();
  });

  test('should toggle between text and HTML views', async ({ page }) => {
    const textButton = page.getByRole('button', { name: 'Text' });
    const htmlButton = page.getByRole('button', { name: 'HTML' });

    await expect(textButton).toHaveClass(/active/);

    await htmlButton.click();
    await expect(htmlButton).toHaveClass(/active/);
    await expect(textButton).not.toHaveClass(/active/);

    const iframe = page.locator('iframe.html-content');
    await expect(iframe).toBeVisible();

    await textButton.click();
    await expect(textButton).toHaveClass(/active/);
    await expect(iframe).not.toBeVisible();
  });

  test('should display text body content', async ({ page }) => {
    const textBody = page.locator('.text-body');
    await expect(textBody).toBeVisible();
    await expect(textBody).toContainText('I\'ve completed the Q4 report');
  });

  test('should display HTML body in sandboxed iframe', async ({ page }) => {
    const htmlButton = page.getByRole('button', { name: 'HTML' });
    await htmlButton.click();

    const iframe = page.locator('iframe.html-content');
    await expect(iframe).toBeVisible();
    await expect(iframe).toHaveAttribute('sandbox', 'allow-same-origin');
  });

  test('should show spam classification info', async ({ page }) => {
    const secondMessage = page.locator('.message-item').nth(1);
    await secondMessage.click();

    await expect(page.locator('.spam-info')).toBeVisible();
    await expect(page.getByText(/Confidence:/)).toBeVisible();
    await expect(page.getByText(/Reason:/)).toBeVisible();
  });

  test('should display attachments list', async ({ page }) => {
    await expect(page.getByText('Attachments')).toBeVisible();

    const attachmentItem = page.locator('.attachment-item').first();
    await expect(attachmentItem).toBeVisible();
    await expect(attachmentItem).toContainText('Q4-Report.pdf');
    await expect(attachmentItem).toContainText('240 KB');
  });

  test('should download attachment on click', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    const attachmentLink = page.locator('.attachment-item a').first();
    await attachmentLink.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Q4-Report.pdf');
  });

  test('should show loading state when selecting message', async ({ page }) => {
    const secondMessage = page.locator('.message-item').nth(1);

    const loadingPromise = page.waitForSelector('text=Loading...');
    await secondMessage.click();

    await loadingPromise;
  });

  test('should show error state on failed load', async ({ page }) => {
    await page.route('**/api/messages/*', route => {
      route.abort();
    });

    const secondMessage = page.locator('.message-item').nth(1);
    await secondMessage.click();

    await page.waitForTimeout(1000);

    await expect(page.getByText(/Failed to load/)).toBeVisible();
  });

  test('should handle messages without attachments', async ({ page }) => {
    const thirdMessage = page.locator('.message-item').nth(2);
    await thirdMessage.click();

    await expect(page.getByText('No attachments')).toBeVisible();
  });

  test('should display received timestamp', async ({ page }) => {
    const receivedText = page.locator('.message-detail').getByText(/Received:/);
    await expect(receivedText).toBeVisible();
  });
});
