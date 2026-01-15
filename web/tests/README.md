# Playwright E2E Tests

Smoke test for the email inbox web application using Playwright.

## Test Coverage

### Smoke Test (`smoke.spec.js`)
- ✅ Homepage loads successfully

## Running Tests

### Install Dependencies
```bash
npm install
npx playwright install
```

### Run Tests
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

## Test Configuration

Tests are configured in `playwright.config.js` with:
- **baseURL**: `http://localhost:5173`
- **Browsers**: Chromium, Firefox, WebKit
- **Screenshots**: On failure only
- **Traces**: On first retry
- **Web Servers**: Automatically starts mock server (8787) and Vite dev server (5173)

## CI/CD Integration

Tests run in GitHub Actions on every push:
- Single worker for stability in CI
- Only Chromium browser in CI (faster)
- Test reports uploaded as artifacts on failure

## Test Data

Tests use the mock server (`mock-server.js`) which provides:
- **Auth token**: `dev-token-12345`
- **4 sample messages**: mix of ham, spam, and unknown
- **API endpoints**: All REST and SSE endpoints

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Writing Tests](https://playwright.dev/docs/writing-tests)
