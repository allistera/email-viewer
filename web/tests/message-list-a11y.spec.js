import { test, expect } from '@playwright/test';

test.describe('MessageList Accessibility', () => {
    test.beforeEach(async ({ page }) => {
        // Mock messages API
        await page.route('**/api/messages*', async route => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        items: [
                            {
                                id: 'msg-1',
                                from: 'Sender 1',
                                subject: 'Subject 1',
                                snippet: 'Snippet 1',
                                receivedAt: new Date().toISOString(),
                                isRead: false,
                                hasAttachments: false,
                                tag: 'Inbox'
                            },
                            {
                                id: 'msg-2',
                                from: 'Sender 2',
                                subject: 'Subject 2',
                                snippet: 'Snippet 2',
                                receivedAt: new Date().toISOString(),
                                isRead: true,
                                hasAttachments: true,
                                tag: 'Work'
                            }
                        ],
                        nextBefore: null
                    })
                });
            } else {
                await route.continue();
            }
        });

        // Mock individual message detail API
        await page.route('**/api/messages/msg-1', async route => {
             await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'msg-1',
                    from: 'Sender 1',
                    subject: 'Subject 1',
                    body: 'Body 1',
                    receivedAt: new Date().toISOString(),
                    tag: 'Inbox'
                })
            });
        });

        // Mock counts
        await page.route('**/api/messages/counts', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ inbox: 2 })
            });
        });

        await page.goto('/');
        await page.fill('input[type="password"]', 'dev-token-12345');
        await page.click('button[type="submit"]');
        await expect(page.locator('.modal')).toBeHidden();
    });

    test('message items should have button role and be focusable', async ({ page }) => {
        const messageItem = page.locator('.message-item').first();
        await expect(messageItem).toHaveAttribute('role', 'button');
        await expect(messageItem).toHaveAttribute('tabindex', '0');
    });

    test('should activate message on Enter key', async ({ page }) => {
        const messageItem = page.locator('.message-item').first();

        // Ensure it's not active initially (or check against specific class logic)
        // The first item might be auto-selected on load, so let's check the second one
        const secondMessage = page.locator('.message-item').nth(1);

        await secondMessage.focus();
        await page.keyboard.press('Enter');

        await expect(secondMessage).toHaveClass(/active/);
    });

    test('should activate message on Space key', async ({ page }) => {
        const secondMessage = page.locator('.message-item').nth(1);

        await secondMessage.focus();
        await page.keyboard.press('Space');

        await expect(secondMessage).toHaveClass(/active/);
    });
});
