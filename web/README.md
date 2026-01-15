# Email Inbox - Web UI

Vue.js 3 frontend for the email inbox application.

## Development

### With Real Backend

```bash
# Install dependencies
npm install

# Run dev server (with API proxy to worker)
npm run dev
```

The dev server runs on `http://localhost:5173` and proxies `/api/*` requests to the worker running on `http://localhost:8787`.

### With Mock Backend (Recommended for UI Development)

```bash
# Run both mock API and Vite dev server
npm run dev:mock
```

This starts a mock API server with fake data, allowing you to develop the UI without setting up the full Cloudflare infrastructure. See [MOCK_DEV.md](./MOCK_DEV.md) for details.

**Mock auth token**: `dev-token-12345`

## Build

```bash
# Build for production
npm run build
```

Output is generated in the `dist/` directory.

## Deploy

```bash
# Deploy to Cloudflare Pages
cd ..
npm run deploy:pages
```

Or use the GitHub Actions workflow for automatic deployment.

## Structure

```
src/
  components/    # Vue components
  services/      # API and SSE/WebSocket services
  main.js        # App entry point
  App.vue        # Root component
  style.css      # Global styles (Todoist theme)
```

## Todoist-Inspired Design

Color palette:
- Primary: `#db4c3f` (red)
- Primary dark: `#c53727`
- Background: `#ffffff`
- Background secondary: `#f9f9f9`
- Border: `#e0e0e0`
- Text: `#202020`
- Text secondary: `#808080`
- Success: `#058527` (green)
- Warning: `#ff9a14` (orange)
