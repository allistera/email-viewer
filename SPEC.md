# Email Inbox App on Cloudflare — Architecture + Build Spec (Single User, Low Volume)

## 1. Overview

A personal email web application that:
- Ingests inbound emails using **Cloudflare Email Routing → Worker**
- Stores:
  - Email metadata + bodies in **Cloudflare D1**
  - Raw `.eml` + attachments in **Cloudflare R2**
- Uses **Worker `waitUntil`** for post-processing (removing the need for paid Queues)
- Provides a **REST API** for UI data access
- Provides **real-time updates** via **SSE and WebSocket**, implemented using a **Durable Object hub**
- Adds an **OpenAI spam check** step (async, low cost) after ingestion

Target scale: ~30 emails/day, single user, minimal cost and operational overhead.

---

## 2. Non-goals

- No multi-user accounts / tenants
- No IMAP/SMTP sending
- No caching layer (KV/Cache API) for now
- No Hyperdrive (scale doesn’t require it)
- No full-text search (optional later)

---

## 3. Cloudflare Resources

### 3.1 Worker(s)
You can deploy as either:
- **One Worker** with multiple routes/handlers (simplest)
- **Two Workers**: `ingest` and `api` (clear separation)

This spec assumes **one Worker** for minimal cost/ops:
- `mail-app-worker`:
  - Email handler (ingest)
  - HTTP API (REST + SSE + WS)
  - Static UI hosting

### 3.2 Durable Objects
- `RealtimeHub` (single global hub)
  - Maintains active SSE streams + WebSocket connections
  - Broadcasts events to all connected clients

### 3.3 D1
- Database: `maildb`

### 3.4 R2
- Bucket: `mailstore`
  - Raw emails: `raw/<message_id>.eml`
  - Attachments: `att/<message_id>/<attachment_id>/<filename>`

### 3.5 Email Routing
- Cloudflare Email Routing sends inbound mail to the Worker email handler.

---

## 4. Security Model (Single User)

### 4.1 API Auth
All HTTP API endpoints require:
- `Authorization: Bearer <API_TOKEN>`

Environment variable:
- `API_TOKEN` (secret/value)

UI:
- If token is missing, prompt once and store in localStorage.

### 4.2 Ingest Auth
Inbound email handler is called by Cloudflare Email Routing; do not require API token.

---

## 5. Data Model (D1)

Create migrations:

### 5.1 `0001_init.sql`

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,                 -- UUID
  received_at INTEGER NOT NULL,         -- unix ms
  from_addr TEXT NOT NULL,
  to_addr TEXT NOT NULL,
  subject TEXT,
  date_header TEXT,
  snippet TEXT,
  has_attachments INTEGER NOT NULL DEFAULT 0,
  raw_r2_key TEXT NOT NULL,             -- raw/<id>.eml
  text_body TEXT,
  html_body TEXT,
  headers_json TEXT                     -- JSON string with selected headers
);

CREATE INDEX IF NOT EXISTS idx_messages_received_at
ON messages(received_at DESC);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,                  -- UUID
  message_id TEXT NOT NULL,
  filename TEXT,
  content_type TEXT,
  size_bytes INTEGER,
  sha256 TEXT,
  r2_key TEXT NOT NULL,                 -- att/<message_id>/<id>/<filename>
  FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attachments_message_id
ON attachments(message_id);

-- Dedupe table for idempotency on join/retry
CREATE TABLE IF NOT EXISTS dedupe (
  dedupe_key TEXT PRIMARY KEY,
  message_id TEXT NOT NULL
);
```

### 5.6 Storage Strategy

#### 5.6.1 R2
- Always store raw email as the source of truth:
  - `raw/<message_id>.eml`
- Store each attachment separately:
  - `att/<message_id>/<attachment_id>/<filename>`

#### 5.6.2 D1
- Store queryable metadata:
  - `from`, `to`, `subject`, `date`, `received_at`, `snippet`, `headers`
- Store bodies (`text_body`, `html_body`) directly for simplicity at this volume.

### 5.7 Email Ingestion Flow

#### 5.7.1 Ingest Handler (Email Routing → Worker)

Triggered by:
```javascript
export default { 
  async email(message, env, ctx) { 
    // ... 
  } 
}
```

Steps:
1. Generate `messageId = crypto.randomUUID()`
2. Read raw email bytes and write to R2:
   - `rawKey = "raw/" + messageId + ".eml"`
3. Parse key headers: `Message-ID`, `From`, `To`, `Subject`, `Date`
4. Compute `dedupe_key`:
   - Prefer: `sha256(lower(Message-ID) + "|" + lower(To))`
   - Fallback: `sha256(from + "|" + subject + "|" + date + "|" + first200(text))`
5. Insert into `dedupe` first:
   - If conflict: stop (already stored)
6. Parse MIME:
   - Extract `text/plain`, `text/html`
   - Extract attachments and store each attachment to R2
7. Insert `messages` row (including snippet + has_attachments + body fields)
8. Insert `attachments` rows
9. **Post-Processing (via `ctx.waitUntil`)**:
   - Instead of using a Queue, we invoke an async function and pass it to `ctx.waitUntil()`. 
   - This keeps the worker alive to finish processing without blocking the initial ingest handshake.
   - Task: `processMessage(messageId, env)`

Notes:
- Keep main ingest path lightweight.
- If parsing fails, still store raw `.eml` and insert a minimal `messages` row if possible.

### 5.8 Async Post-Processing (Background Task)

Function: `processMessage(messageId, env)`

Steps:
1. Load message from D1
2. **Broadcast** `message.received` event via Durable Object (UI updates to show new email)
2. Run **spam classification** (OpenAI) if `spam_checked_at` is NULL
3. Update D1 spam fields
4. **Broadcast** `message.classified` event via Durable Object (UI updates spam status)

## 6. Spam Classification (OpenAI)

### 6.1 Goals
- Minimal cost
- Robust structured output
- Only send a small excerpt; never attachments

### 6.2 Env Vars
- `OPENAI_API_KEY` (secret)
- `OPENAI_MODEL` (default: most cost-effective model you choose, e.g. `gpt-4o-mini`)

### 6.3 Input Truncation Rules (Must Implement)

Build a compact input object:
- `from` max 200 chars
- `to` max 200 chars
- `subject` max 200 chars
- `snippet` max 300 chars
- `body` max 2000 chars:
  - prefer `text_body`
  - fallback: strip HTML tags from `html_body`

Never include:
- attachments
- raw `.eml`
- full header dumps

### 6.4 Output Schema

The model must return JSON:

```json
{ "is_spam": true, "confidence": 0.93, "reason": "Short explanation" }
```

## 10. Realtime (Durable Objects)

### 10.1 Durable Object: RealtimeHub

A single global hub:
- DO id: `idFromName("global")`
- Maintains in-memory list of connected clients:
  - WebSocket connections
  - SSE stream writers

Endpoints inside DO:
- `GET /connect/sse`
- `GET /connect/ws` (upgrade)
- `POST /broadcast` with event payload

### 10.2 Events
- `message.received`
  - emitted after ingest enqueues and/or after background processing begins
- `message.classified`
  - emitted after spam check completes

Payload examples:

```json
{ "type": "message.received", "messageId": "uuid", "receivedAt": 123 }
```

```json
{
  "type": "message.classified",
  "messageId": "uuid",
  "spamStatus": "spam",
  "spamConfidence": 0.93
}
```

### 10.3 UI Behavior
- On `message.received`: insert/update the message row (or refetch first page)
- On `message.classified`: update spam badge/status in-place

---

## 11. HTTP API

Base: `/api`
Auth required on all endpoints except optional `/api/health`

### 11.1 Health
- `GET /api/health`
- `{ "ok": true }`

### 11.2 List Messages (Inbox)
- `GET /api/messages?limit=50&before=<ms>&spamStatus=ham|spam|unknown`

Keyset pagination:
- default: newest first
- `before` means `received_at < before`

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "receivedAt": 123,
      "from": "a@b.com",
      "to": "me@domain",
      "subject": "hi",
      "snippet": "first line...",
      "hasAttachments": true,
      "spamStatus": "unknown",
      "spamConfidence": null
    }
  ],
  "nextBefore": 122
}
```

### 11.3 Message Detail
- `GET /api/messages/:id`

Response:

```json
{
  "id": "uuid",
  "receivedAt": 123,
  "from": "...",
  "to": "...",
  "subject": "...",
  "textBody": "...",
  "htmlBody": "...",
  "headers": { "message-id": "...", "date": "...", "...": "..." },
  "spamStatus": "ham",
  "spamConfidence": 0.12,
  "spamReason": "Looks like a legit notification",
  "attachments": [
    { "id": "...", "filename": "...", "contentType": "...", "sizeBytes": 123 }
  ]
}
```

### 11.4 Download Attachment
- `GET /api/messages/:id/attachments/:attId`
Streams from R2. Must set:
- `Content-Type`
- `Content-Disposition: attachment; filename="..."`

### 11.5 SSE Stream
- `GET /api/stream`
Proxies to DO `/connect/sse`

### 11.6 WebSocket
- `GET /api/ws`
Proxies to DO `/connect/ws`

---

## 12. UI Spec (Minimal)

Single-page UI:
- **Inbox list**
  - subject, from, received time, snippet
  - badge: spam/ham/unknown
- **Message detail panel**
  - text view
  - html view (sanitized)
  - attachments list + download links
  - Controls:
    - toggle: show/hide spam
    - refresh button (optional)

Auth:
- token prompt modal if missing; store in `localStorage`

Realtime:
- Connect SSE first; fallback to WebSocket if SSE fails (or support both toggles).

---

## 13. Project Structure (Suggested)

```bash
/
  src/
    worker.js                 # entry: routes + email handler + background tasks
    auth.js                   # bearer token validation
    db.js                     # D1 helpers
    r2.js                     # R2 helpers
    mime.js                   # email parsing + snippet generation
    openai.js                 # spam classifier client
    realtimeHub.js            # Durable Object class
    routes/
      api.js                  # REST routes
      stream.js               # SSE + WS proxy routes to DO
  web/                        # web application
  migrations/
    0001_init.sql
    0002_spam.sql
  wrangler.toml
```

## 14. wrangler.toml (Bindings Checklist)

Must bind:
- D1: `DB`
- R2: `MAILSTORE`
- Durable Object: `REALTIME_HUB`
- Vars/secrets:
  - `API_TOKEN`
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`

---

## 15. Operational Notes (Low Cost / Low Effort)
- Keep OpenAI input small and run it only once per message.
- Prefer SSE for real-time; WebSocket support is present but SSE is typically cheaper/simpler.
- Avoid big libraries; implement lightweight MIME parsing where possible.
- Log only message IDs and high-level errors (don’t log full email bodies).
- Consider a simple retention job later (e.g., delete emails older than N days).

---

## 16. Acceptance Criteria

Must have:
- Email Routing successfully ingests and stores messages:
  - D1 row exists
  - raw `.eml` exists in R2
  - attachments saved to R2 and downloadable
- REST API:
  - list + detail endpoints work
  - attachment download works
  - spamStatus filter works
- Background Task (via `waitUntil`):
  - classifies spam via OpenAI
  - updates D1 spam fields
- Realtime:
  - UI updates without refresh on new email
  - spam badge updates when classification completes
- Single-user auth:
  - API token required for `/api/*` endpoints (except health if you choose)
- Simple user interface that copies the colours and design from Todoist
- Web application written in **Vue.js** using **plain javascript**.
- Uses Github Actions to lint, build and deploy to Cloudflare.
