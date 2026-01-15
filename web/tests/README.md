# Playwright E2E Tests

End-to-end tests for the email inbox web application using Playwright.

## Test Coverage

### 1. Authentication (`auth.spec.js`)
- ✅ Show auth modal on first visit
- ✅ Login with valid token
- ✅ Handle invalid token errors
- ✅ Persist token in localStorage
- ✅ Toggle password visibility

### 2. Message List (`message-list.spec.js`)
- ✅ Display inbox with messages
- ✅ Show message details (from, subject, snippet)
- ✅ Select message and show detail panel
- ✅ Display spam badges correctly
- ✅ Show attachment icons
- ✅ Filter by spam status (ham/spam/unknown)
- ✅ Show relative timestamps
- ✅ Refresh message list
- ✅ Loading states
- ✅ Empty state

### 3. Message Detail (`message-detail.spec.js`)
- ✅ Display header information (from, to, subject)
- ✅ Toggle between text and HTML views
- ✅ Display text body content
- ✅ Display HTML body in sandboxed iframe
- ✅ Show spam classification info
- ✅ Display attachments list with file size
- ✅ Download attachments
- ✅ Loading and error states
- ✅ Handle messages without attachments

### 4. Custom Filters (`filters.spec.js`)
- ✅ Open filter creation modal
- ✅ Create sender filters
- ✅ Create subject filters
- ✅ Create spam status filters
- ✅ Validate required fields
- ✅ Activate/deactivate filters
- ✅ Remove filters
- ✅ Persist filters in localStorage
- ✅ Apply filters to message list

### 5. Archive (`archive.spec.js`)
- ✅ Show archive button
- ✅ Enable/disable based on selection
- ✅ Remove message from list
- ✅ Auto-select next message
- ✅ Handle empty inbox
- ✅ Handle API errors
- ✅ Archive different message types
- ✅ Maintain filter state after archive

## Running Tests

### Install Dependencies
```bash
npm install
npx playwright install
```

### Run All Tests (Headless)
```bash
npm test
```

### Run Tests in Headed Mode
```bash
npm run test:headed
```

### Run Tests with UI Mode (Interactive)
```bash
npm run test:ui
```

### Debug Tests
```bash
npm run test:debug
```

### View Test Report
```bash
npm run test:report
```

### Run Specific Test File
```bash
npx playwright test auth.spec.js
```

### Run Tests in Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Configuration

Tests are configured in `playwright.config.js` with:
- **baseURL**: `http://localhost:5173`
- **Browsers**: Chromium, Firefox, WebKit
- **Screenshots**: On failure only
- **Traces**: On first retry
- **Web Servers**: Automatically starts mock server (8787) and Vite dev server (5173)

## CI/CD Integration

Tests are configured to run in CI environments with:
- Automatic retries (2 retries in CI)
- Single worker for stability
- Fail fast on `test.only` in CI

## Test Data

Tests use the mock server (`mock-server.js`) which provides:
- **Auth token**: `dev-token-12345`
- **4 sample messages**: mix of ham, spam, and unknown
- **Real-time simulation**: New emails every 30 seconds
- **API endpoints**: All REST and SSE endpoints

## Best Practices

1. **Test Isolation**: Each test clears cookies and localStorage
2. **Authentication**: All tests login before running
3. **Wait Strategies**: Use Playwright's auto-waiting, add explicit waits only when needed
4. **Assertions**: Use Playwright's expect for automatic retries
5. **Selectors**: Prefer role-based and text-based selectors over CSS

## Debugging Tips

1. **Run in headed mode** to see what's happening
2. **Use test:ui** for interactive debugging
3. **Use test:debug** to step through tests
4. **Add `await page.pause()`** to pause execution
5. **Check screenshots** in `test-results/` on failure

## Writing New Tests

```javascript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear state
    await context.clearCookies();
    await context.addInitScript(() => {
      localStorage.clear();
    });

    // Login
    await page.goto('/');
    const tokenInput = page.getByPlaceholder('Enter API token');
    await tokenInput.fill('dev-token-12345');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByText('Inbox')).toBeVisible();
  });

  test('should do something', async ({ page }) => {
    // Your test here
  });
});
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Writing Tests](https://playwright.dev/docs/writing-tests)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Selectors](https://playwright.dev/docs/selectors)
