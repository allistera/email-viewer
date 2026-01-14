# Email Inbox - Web UI

Vue.js 3 frontend for the email inbox application.

## Development

```bash
# Install dependencies
npm install

# Run dev server (with API proxy to worker)
npm run dev
```

The dev server runs on `http://localhost:5173` and proxies `/api/*` requests to the worker running on `http://localhost:8787`.

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
