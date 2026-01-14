# Email Inbox App - Claude Code Instructions

## Project Overview

A personal email web application built entirely on Cloudflare infrastructure for single-user, low-volume email management (~30 emails/day).

**Stack:**
- Cloudflare Workers (email ingestion, API, queue consumer)
- Cloudflare D1 (SQLite database for metadata)
- Cloudflare R2 (object storage for raw emails and attachments)
- Cloudflare Queues (async post-processing)
- Cloudflare Durable Objects (realtime hub for SSE/WebSocket)
- OpenAI API (spam classification)
- Vue.js 3 with plain JavaScript (frontend)

## Architecture Principles

### Core Design Rules
- **Single Worker**: One worker handles all routes (email ingestion, API, queue consumer, static hosting)
- **Single User**: No multi-tenancy, simple bearer token auth
- **Keep It Simple**: No over-engineering, no premature optimization, minimal dependencies
- **Async Processing**: Email ingestion is fast; spam checking happens via queue
- **R2 as Source of Truth**: Always store raw `.eml` files; D1 stores parsed metadata

### Cost Optimization
- Keep OpenAI input small (max 2000 chars body, no attachments)
- Prefer SSE over WebSocket when possible
- Avoid large libraries; implement lightweight MIME parsing
- Log only message IDs and errors (never full email bodies)

## File Structure

```
/
  src/
    worker.js           # Entry point: routes, email handler, queue consumer
    auth.js             # Bearer token validation
    db.js               # D1 database helpers
    r2.js               # R2 storage helpers
    mime.js             # Email parsing, snippet generation
    openai.js           # Spam classification client
    realtimeHub.js      # Durable Object for SSE/WS
    routes/
      api.js            # REST API endpoints
      stream.js         # SSE/WS proxy to Durable Object
  web/                  # Vue.js application
  migrations/
    0001_init.sql       # Initial schema
    0002_spam.sql       # Spam classification fields
  wrangler.toml         # Cloudflare configuration
```

## Database Schema (D1)

### messages
- Primary data: `id`, `from_addr`, `to_addr`, `subject`, `received_at`
- Bodies: `text_body`, `html_body` (stored directly for simplicity)
- Metadata: `snippet`, `has_attachments`, `headers_json`
- Spam: `spam_status`, `spam_confidence`, `spam_reason`, `spam_checked_at`
- R2 reference: `raw_r2_key`

### attachments
- Foreign key to `message_id`
- Metadata: `filename`, `content_type`, `size_bytes`, `sha256`
- R2 reference: `r2_key`

### dedupe
- Idempotency: `dedupe_key` (sha256 of Message-ID + To, or fallback)
- Reference: `message_id`

## Storage Strategy

### R2 Keys
- Raw emails: `raw/<message_id>.eml`
- Attachments: `att/<message_id>/<attachment_id>/<filename>`

### D1 vs R2
- **D1**: Queryable metadata, parsed bodies (text/html)
- **R2**: Raw `.eml` (source of truth), individual attachments

## Critical Flows

### Email Ingestion (worker.email)
1. Generate `messageId = crypto.randomUUID()`
2. Stream raw email to R2: `raw/<messageId>.eml`
3. Parse headers: From, To, Subject, Date, Message-ID
4. Compute `dedupe_key` (sha256 of Message-ID + To)
5. Check dedupe table (stop if exists)
6. Parse MIME: extract text/html bodies, attachments
7. Save attachments to R2
8. Insert `messages` row + `attachments` rows
9. Enqueue `message.received` event
10. **Never call OpenAI here** (keep ingestion fast)

### Spam Classification (queue consumer)
1. Receive `message.received` event
2. Load message from D1
3. Build truncated input (max 2000 chars body)
4. Call OpenAI with structured output schema
5. Update D1 spam fields
6. Broadcast `message.classified` event via Durable Object

### Realtime Updates (Durable Object)
- Single global hub: `idFromName("global")`
- Maintains SSE streams and WebSocket connections
- Endpoints: `/connect/sse`, `/connect/ws`, `/broadcast`
- Events: `message.received`, `message.classified`

## API Standards

### Authentication
- All `/api/*` endpoints require `Authorization: Bearer <API_TOKEN>`
- Email ingestion endpoint has no auth (called by Cloudflare)
- Frontend stores token in localStorage

### REST Endpoints
- `GET /api/health` - health check (no auth)
- `GET /api/messages?limit=50&before=<ms>&spamStatus=ham|spam|unknown` - list inbox
- `GET /api/messages/:id` - message detail
- `GET /api/messages/:id/attachments/:attId` - download attachment
- `GET /api/stream` - SSE connection (proxy to DO)
- `GET /api/ws` - WebSocket connection (proxy to DO)

### Response Format
- Use consistent JSON structure
- Include pagination cursors (`nextBefore`)
- Return null for optional fields (not undefined)
- Use unix milliseconds for timestamps

## Frontend Standards (Vue.js)

### Tech Stack
- Vue.js 3 with plain JavaScript (no TypeScript, no build step if possible)
- Composition API preferred
- Design: Todoist-inspired colors and UI patterns

### Features
- Inbox list: subject, from, received time, snippet, spam badge
- Message detail panel: text view, HTML view (sanitized), attachments
- Real-time: SSE first, WebSocket fallback
- Auth: token prompt modal, localStorage persistence
- Controls: spam filter toggle, refresh

## OpenAI Integration

### Input Truncation (MUST IMPLEMENT)
```javascript
{
  from: truncate(message.from_addr, 200),
  to: truncate(message.to_addr, 200),
  subject: truncate(message.subject, 200),
  snippet: truncate(message.snippet, 300),
  body: truncate(message.text_body || stripHtml(message.html_body), 2000)
}
```

### Output Schema
```json
{
  "is_spam": true,
  "confidence": 0.93,
  "reason": "Short explanation"
}
```

### Environment
- `OPENAI_API_KEY` (secret)
- `OPENAI_MODEL` (default: `gpt-4o-mini`)

## Wrangler Bindings

Required bindings in `wrangler.toml`:
- D1: `DB`
- R2: `MAILSTORE`
- Queue producer: `MAIL_EVENTS`
- Queue consumer: `mail-events`
- Durable Object: `REALTIME_HUB`
- Secrets: `API_TOKEN`, `OPENAI_API_KEY`
- Vars: `OPENAI_MODEL`

## Development Guidelines

### Code Style
- Self-documenting code over comments
- Keep functions small and focused
- Use async/await consistently
- Handle errors gracefully (log message ID + error, never full body)

### Error Handling
- Email ingestion: always save raw `.eml` even if parsing fails
- OpenAI: retry once, fallback to `spam_status = 'unknown'`
- R2: check for existence before overwriting
- D1: use transactions for multi-table inserts

### Testing Strategy
- Test email ingestion with various MIME types
- Test dedupe logic (duplicate Message-ID)
- Test OpenAI input truncation
- Test realtime events (SSE/WS)
- Test attachment download
- Test spam filtering

### Security
- Never log email bodies or token values
- Sanitize HTML before rendering in UI
- Validate all API inputs
- Set proper Content-Disposition headers for attachments
- Use parameterized queries (D1 prepared statements)

## Deployment (GitHub Actions)

Pipeline steps:
1. Lint (ESLint for worker code)
2. Build (if needed for frontend)
3. Deploy to Cloudflare Workers
4. Run D1 migrations
5. Verify deployment with health check

## Non-Goals (Do Not Implement)

- Multi-user accounts or tenants
- IMAP/SMTP sending
- KV/Cache API caching layer
- Hyperdrive
- Full-text search (defer)
- Email composition/sending
- Folders or labels
- Email threading
- Advanced filtering rules

## Acceptance Criteria

- ✅ Email Routing ingests and stores messages (D1 + R2)
- ✅ Attachments saved and downloadable
- ✅ REST API (list, detail, attachment download)
- ✅ Spam classification via OpenAI
- ✅ Queue consumer updates spam fields
- ✅ Realtime UI updates (SSE or WebSocket)
- ✅ Single-user bearer token auth
- ✅ Todoist-inspired UI design
- ✅ Vue.js with plain JavaScript
- ✅ GitHub Actions deployment
