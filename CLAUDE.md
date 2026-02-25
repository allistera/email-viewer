# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A self-hosted, single-user email inbox built on Cloudflare Workers. The system ingests emails via Email Routing, classifies them with AI tagging (including spam detection), and provides real-time updates through Durable Objects.

**Stack**: Cloudflare Workers + D1 (SQLite) + R2 (object storage) + Vue.js (vanilla JavaScript)

## Architecture

### Multi-Worker System

The application is split into three separate Cloudflare Workers:

1. **API Worker** (`workers/api/`) - Main application worker
   - Entry: `workers/api/index.js`
   - Serves the Vue.js SPA (from `web/dist`)
   - REST API endpoints (`routes.js`)
   - Real-time SSE/WebSocket proxy (`stream.js`)
   - Bindings: D1 (`DB`), R2 (`MAILSTORE`), Durable Object (`REALTIME_HUB`)

2. **Email Worker** (`workers/email/`) - Email ingestion
   - Entry: `workers/email/index.js`
   - Receives emails from Cloudflare Email Routing
   - Parses MIME, stores in D1/R2
   - Triggers background AI classification via `ctx.waitUntil`
   - Sends iOS push notifications via ntfy.sh

3. **Todoist Worker** (`workers/todoist/`) - Optional integration
   - Entry: `workers/todoist/index.js`
   - Creates Todoist tasks from emails
   - Uses OpenRouter for intelligent project selection

### Shared Code

Common functionality is in `workers/shared/`:
- `auth.js` - Bearer token authentication
- `cors.js` - CORS handling
- `db.js` - D1 database helpers and queries
- `mime.js` - Email parsing utilities
- `openai.js` - OpenRouter API client for tag classification
- `r2.js` - R2 storage helpers
- `realtimeHub.js` - Durable Object class for real-time updates
- `notifications.js` - ntfy.sh push notification client
- `todoist.js` - Todoist API client

### Real-Time Updates

The system uses a **Durable Object** (`RealtimeHub`) to broadcast events:
- `message.received` - New email ingested
- `message.tagged` - AI classification completed

Clients connect via SSE (preferred) or WebSocket at `/api/stream` or `/api/ws`.

### Data Storage

**D1 (SQLite)**:
- `messages` - Email metadata (from, to, subject, bodies, tags)
- `attachments` - Attachment metadata
- `tags` - User-defined tags
- `message_tags` - Many-to-many tag relationships
- `tagging_rules` - Auto-tagging rules
- `dedupe` - Idempotency tracking

**R2 (Object Storage)**:
- `raw/<message_id>.eml` - Raw email files
- `att/<message_id>/<attachment_id>/<filename>` - Attachments

### Frontend Architecture

**Single-page Vue.js application** (plain JavaScript, no build-time compilation):
- `App.vue` - Main layout with three-column design (tag sidebar, message list, detail/settings)
- Key components in `web/src/components/`:
  - `MessageList.vue` - Email list view
  - `MessageDetail.vue` - Email content viewer with reply/forward
  - `ComposeModal.vue` - Gmail-style compose popup
  - `TagSidebar.vue` - Tag navigation and management
  - `RightSidebar.vue` - Calendar and other views
  - `SettingsView.vue` - Configuration panel
  - `TodoistSlideout.vue` - Todoist integration sidebar
  - `KanbanView.vue` - Kanban board view

**View Modes**: The app has a `rightRailView` that can be `'detail'`, `'calendar'`, or `'settings'`. Grid layout adjusts based on the active view.

## Development Commands

### Setup & Database

```bash
# Install dependencies
npm install
cd web && npm install

# Create D1 database
npx wrangler d1 create maildb

# Create R2 bucket
npx wrangler r2 bucket create mailstore

# Apply migrations (local)
npm run db:migrate:dev

# Apply migrations (remote)
npm run db:migrate:remote
```

### Development

```bash
# Start API worker (with Vue.js frontend)
npm run dev                    # or npm run dev:api

# Start email worker (separate terminal)
npm run dev:email              # runs on port 8788

# Start Vue.js dev server with HMR (separate terminal)
npm run dev:web                # runs on port 5173
```

**Note**: The API worker serves the built Vue.js app from `web/dist`. During development, run `npm run dev:web` for HMR, which proxies API calls to the worker.

### Testing

```bash
# Lint worker code
npm run lint

# Run worker tests (uses Vitest + Cloudflare Workers test environment)
npm run test:workers

# Watch mode
npm run test:workers:watch

# Frontend E2E tests (Playwright)
cd web && npm test
cd web && npm run test:ui       # interactive UI mode
```

**Worker tests** are in `tests/workers/` and use `@cloudflare/vitest-pool-workers` to simulate the Cloudflare Workers environment with D1/R2 bindings.

### Deployment

```bash
# Build frontend
cd web && npm run build

# Deploy all workers
npm run deploy                  # deploys API + Email workers

# Deploy individual workers
npm run deploy:api
npm run deploy:email
npx wrangler deploy -c wrangler-todoist.toml

# Deploy to production environment
npm run deploy:production

# Deploy frontend to Cloudflare Pages (alternative)
npm run deploy:pages
```

### Debugging

```bash
# Tail logs for API worker
npm run tail

# Tail logs for email worker
npm run tail:email

# View logs in dashboard
wrangler tail --format pretty
```

## Configuration

### Secrets (use `npx wrangler secret put`)

Required for API worker:
- `API_TOKEN` - Authentication token for API access
- `RESEND_API_KEY` - For sending emails via Resend

Required for email worker:
- `OPENROUTER_API_KEY` - For AI tag classification

Optional:
- `TODOIST_API_TOKEN` - Enable Todoist integration
- `NTFY_TOPIC` - iOS push notifications topic
- `NTFY_TOKEN` - For authenticated ntfy topics
- `SENTRY_DSN` - Error tracking

### Environment Variables

Edit `wrangler.toml` [vars] section:
- `SEND_FROM_EMAIL` - Your verified sender email
- `TAG_LABELS` - Comma-separated list of available tags
- `OPENROUTER_MODEL` - AI model (default: `google/gemini-2.0-flash-lite-001`)

## Key Implementation Details

### Email Ingestion Flow

1. Cloudflare Email Routing → Email Worker's `email()` handler
2. Generate UUID, write raw `.eml` to R2
3. Parse MIME (using `postal-mime`), extract text/HTML/attachments
4. Check `dedupe` table (idempotency)
5. Insert into D1 (`messages`, `attachments`)
6. Send iOS notification via ntfy.sh (if configured)
7. Broadcast `message.received` via Durable Object
8. Background task (via `ctx.waitUntil`):
   - Call OpenRouter API with truncated email content
   - Get tag classification (including spam detection)
   - Update D1 with tag
   - Broadcast `message.tagged` event

### Authentication

All API endpoints (except `/api/health`) require:
```
Authorization: Bearer <API_TOKEN>
```

The frontend stores the token in `localStorage` and prompts if missing.

### Real-Time Communication

The Durable Object (`RealtimeHub`) is a singleton (uses `idFromName("global")`):
- Maintains in-memory Sets of SSE and WebSocket connections
- Exposes `/connect/sse`, `/connect/ws`, and `/broadcast` endpoints
- The API worker proxies client connections to the DO
- Background jobs POST to `/broadcast` to notify all clients

### Tag System

- **Manual tags**: Users can create/assign tags via UI
- **AI tags**: OpenRouter classifies emails (including mandatory "spam" tag)
- **Auto-tagging rules**: Stored in `tagging_rules` table, applied on ingestion
- Tags support hierarchical names (e.g., "Work/Projects")

### Message Views

- **Inbox**: Excludes spam and archived (done) messages by default
- **Tag filtering**: Click tag in sidebar to filter
- **Search**: Scoped to current tag selection
- **Archive**: "Done" button sets `is_archived = 1`
- **Read tracking**: Messages marked read when opened

## Deployment Pipeline

GitHub Actions (`.github/workflows/*.yml`):
- **CI workflow**: Runs on PRs and non-main branches
  - Lints worker code
  - Runs worker tests
- **Note**: Deployment is manual via `npm run deploy`

## Common Patterns

### Adding a New API Endpoint

1. Add handler function in `workers/api/routes.js`
2. Validate input (use helpers like `isValidUUID`)
3. Use `DB` helper from `workers/shared/db.js`
4. Return `jsonResponse(payload)` or `jsonResponse(error, { status: 400 })`
5. Handle missing table errors with `isMissingTableError()` → `databaseNotInitializedResponse()`

### Adding a New Database Table

1. Create migration file: `migrations/NNNN_description.sql`
2. Test locally: `npm run db:migrate:dev`
3. Deploy: `npm run db:migrate:remote`
4. Add query helpers to `workers/shared/db.js`

### Adding a New Vue Component

1. Create `.vue` file in `web/src/components/`
2. Use plain JavaScript (not TypeScript)
3. Import and register in parent component
4. Follow existing patterns (event emitters for parent communication)
5. Use inline styles or global `style.css`

### Broadcasting Real-Time Events

```javascript
// In a worker
const hubId = env.REALTIME_HUB.idFromName('global');
const hub = env.REALTIME_HUB.get(hubId);
await hub.fetch('https://fake/broadcast', {
  method: 'POST',
  body: JSON.stringify({
    type: 'message.received',
    messageId: '...',
    // ... other data
  })
});
```

## Gotchas

- **Wrangler config**: Three separate `wrangler*.toml` files for three workers
- **Static assets**: API worker serves from `web/dist` via `[assets]` directive
- **Service bindings**: API worker calls Todoist worker via service binding
- **Durable Objects**: Must be defined in both `[durable_objects.bindings]` and `[[migrations]]`
- **CORS**: Email and Todoist workers need CORS headers for cross-origin requests
- **Message bodies**: Stored in D1 for simplicity (consider R2 for scale)
- **Grid layout**: `App.vue` uses CSS Grid with dynamic `gridTemplateColumns` based on view state
- **View visibility**: Components use `v-show` to toggle visibility; kanban view was replaced by calendar view
