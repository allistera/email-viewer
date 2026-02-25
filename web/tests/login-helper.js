// Login helper for tests
async function login(page) {
    await page.fill('#username', 'admin');
    await page.fill('#password', 'dummy-token');
    await page.click('button[type="submit"]');
    await expect(page.locator('.modal')).toBeHidden();
}
