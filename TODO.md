# Email Inbox App - Implementation Tasks

## 1. Infrastructure Setup

- [x] **Set up project structure and wrangler.toml configuration**
  - Initialize directory layout (src/, web/, migrations/)
  - Configure wrangler.toml with all bindings:
    - D1: `DB`
    - R2: `MAILSTORE`
    - Queue producer: `MAIL_EVENTS`
    - Queue consumer: `mail-events`
    - Durable Object: `REALTIME_HUB`
    - Secrets: `API_TOKEN`, `OPENAI_API_KEY`
    - Vars: `OPENAI_MODEL`

- [x] **Add Cloudflare Pages deployment configuration**
  - Set up web/ directory with Vue.js + Vite
  - Configure vite.config.js for build and dev proxy
  - Add Todoist-inspired CSS variables
  - Create basic Vue.js app structure

- [ ] **Create D1 database migrations**
  - `0001_init.sql`: messages, attachments, dedupe tables with indexes
  - `0002_spam.sql`: spam classification fields (spam_status, spam_confidence, spam_reason, spam_checked_at)

- [ ] **Implement core utilities**
  - `auth.js`: Bearer token validation middleware
  - `db.js`: D1 database helpers and prepared statements
  - `r2.js`: R2 storage helpers (upload, download, delete)

## 2. Email Processing Backend

- [ ] **Build MIME parser for email parsing and snippet generation**
  - Parse email headers (From, To, Subject, Date, Message-ID)
  - Extract text/plain and text/html bodies
  - Handle multipart MIME structures
  - Extract attachments with metadata (filename, content-type, size)
  - Generate snippet (first 300 chars of text body)
  - Compute dedupe_key (sha256 of Message-ID + To)

- [ ] **Implement email ingestion handler (worker.email)**
  - Generate message UUID
  - Stream raw email to R2: `raw/<messageId>.eml`
  - Parse MIME structure
  - Check dedupe table (stop if exists)
  - Save attachments to R2: `att/<messageId>/<attachmentId>/<filename>`
  - Insert messages row with parsed data
  - Insert attachments rows
  - Enqueue `message.received` event
  - Error handling: always save raw .eml even if parsing fails

- [ ] **Create OpenAI spam classification client with input truncation**
  - Implement strict truncation rules:
    - from: max 200 chars
    - to: max 200 chars
    - subject: max 200 chars
    - snippet: max 300 chars
    - body: max 2000 chars (prefer text, fallback to stripped HTML)
  - Use structured output schema: `{is_spam, confidence, reason}`
  - Error handling: retry once, fallback to 'unknown'

- [ ] **Implement Queue consumer for async spam processing**
  - Handle `message.received` events
  - Load message from D1
  - Call OpenAI spam classifier
  - Update D1 spam fields
  - Broadcast `message.classified` event via Durable Object

## 3. Realtime & API

- [ ] **Build Durable Object RealtimeHub for SSE/WebSocket**
  - Single global hub: `idFromName("global")`
  - Maintain in-memory list of SSE streams and WebSocket connections
  - Implement `/connect/sse` endpoint
  - Implement `/connect/ws` endpoint (upgrade)
  - Implement `POST /broadcast` for event distribution
  - Event types: `message.received`, `message.classified`

- [ ] **Create REST API routes (list, detail, attachments)**
  - `GET /api/health`: health check (no auth)
  - `GET /api/messages`: inbox list with pagination and spam filtering
    - Query params: limit, before, spamStatus
    - Keyset pagination (newest first)
  - `GET /api/messages/:id`: message detail with attachments
  - `GET /api/messages/:id/attachments/:attId`: stream from R2
    - Set Content-Type and Content-Disposition headers

- [ ] **Implement SSE and WebSocket proxy endpoints**
  - `GET /api/stream`: proxy to Durable Object `/connect/sse`
  - `GET /api/ws`: proxy to Durable Object `/connect/ws`
  - Forward auth headers
  - Handle connection errors

- [ ] **Build main worker entry point with routing**
  - Email handler: `async email(message, env, ctx)`
  - HTTP handler: route to API endpoints
  - Queue consumer: `async queue(batch, env, ctx)`
  - Static file serving for web UI
  - Error logging (message IDs only, never full bodies)

## 4. Frontend (Vue.js)

- [ ] **Create Vue.js frontend application with Todoist-inspired design**
  - Initialize Vue 3 app with plain JavaScript
  - Set up component structure
  - Implement Todoist color palette and UI patterns
  - Responsive layout (inbox list + detail panel)

- [ ] **Implement frontend auth flow and token storage**
  - Token prompt modal (on missing token)
  - Store token in localStorage
  - Add Authorization header to all API requests
  - Handle 401 errors (re-prompt for token)

- [ ] **Build inbox list view with pagination**
  - Display: subject, from, received time, snippet
  - Spam badge (ham/spam/unknown)
  - Keyset pagination (load more)
  - Spam filter toggle
  - Loading states

- [ ] **Create message detail panel with text/HTML views**
  - Toggle between text and HTML views
  - Sanitize HTML before rendering
  - Display headers (From, To, Date, Subject)
  - Attachments list with download links
  - Spam classification info (confidence, reason)

- [ ] **Implement realtime updates (SSE with WebSocket fallback)**
  - Connect to SSE stream on load
  - Fallback to WebSocket if SSE fails
  - Handle `message.received`: insert/update in inbox
  - Handle `message.classified`: update spam badge
  - Reconnection logic with exponential backoff

## 5. Deployment & Validation

- [x] **Set up GitHub Actions workflow for lint, build, deploy**
  - Lint worker code (ESLint)
  - Build Vue.js frontend
  - Deploy to Cloudflare Workers
  - Deploy to Cloudflare Pages
  - Run D1 migrations
  - Verify deployment with health check

- [ ] **Configure Cloudflare Email Routing to worker**
  - Set up custom email address
  - Route to worker email handler
  - Test with sample email

- [ ] **Test email ingestion with various MIME types**
  - Plain text emails
  - HTML emails
  - Multipart/alternative
  - Emails with attachments
  - Duplicate emails (dedupe logic)
  - Malformed emails (error handling)

- [ ] **Validate spam classification and realtime updates end-to-end**
  - Send test email → verify raw .eml in R2
  - Check D1 messages row inserted
  - Verify spam classification completes
  - Confirm realtime UI update without refresh
  - Test attachment download
  - Verify spam filtering in inbox

## Acceptance Criteria

- ✅ Email Routing successfully ingests and stores messages (D1 + R2)
- ✅ Attachments saved to R2 and downloadable via API
- ✅ REST API (list, detail, attachment download) working
- ✅ Spam classification via OpenAI with proper truncation
- ✅ Queue consumer updates spam fields in D1
- ✅ Realtime UI updates via SSE or WebSocket
- ✅ Single-user bearer token authentication working
- ✅ Todoist-inspired UI design implemented
- ✅ Vue.js with plain JavaScript (no TypeScript)
- ✅ GitHub Actions deployment pipeline functional
