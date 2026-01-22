# Cloudflare Email Inbox

A self-hosted, single-user email inbox built on Cloudflare Workers. It uses **Email Routing** to ingest emails, **OpenAI** for tag classification (including a mandatory `spam` tag), and **Durable Objects** for real-time updates.

## Features

- **Ingest**: Receives emails via Cloudflare Email Routing → Worker.
- **Storage**:
    - **D1**: Stores email metadata (Sender, Subject, Date, etc.) searchable via SQL.
    - **R2**: Stores the raw `.eml` file and extracted attachments.
- **Tagging**: Uses OpenAI (`gpt-4o-mini`) to classify emails asynchronously, including a `spam` tag (background task via `ctx.waitUntil`).
- **Realtime**: Pushes new emails and tag updates to the UI via SSE/WebSockets.
- **UI**: A clean, "Todoist-inspired" single-page application built with Vue.js (no build step for the JS logic, just plain ES modules).

## Project Structure

```bash
/
  src/
    worker.js         # Main entry point (Routes + Email Handler)
    api.js            # REST API endpoints
    stream.js         # SSE/WebSocket proxy
    auth.js           # Auth middleware
    db.js             # D1 database helpers
    mime.js           # MIME parsing logic
    openai.js         # Tag classifier client
    r2.js             # R2 storage helpers
    realtimeHub.js    # Durable Object class
  web/                # Frontend assets (index.html, app.js, style.css)
  migrations/         # D1 SQL schemas
  wrangler.toml       # Worker configuration
```

## Setup & Deployment

### 1. Prerequisites
- **Cloudflare Account** with Workers Paid (Required for Durable Objects/R2/D1 usage beyond free tier limits).
- **Node.js** installed.
- **OpenAI API Key**.

### 2. Create Resources
Run the following to provision your Cloudflare resources:

```bash
# Install dependencies
npm install

# Create Database and Bucket
npx wrangler d1 create maildb
npx wrangler r2 bucket create mailstore

# Note: Update `wrangler.toml` with the `database_id` you get from the d1 create command!
```

### 3. Set Secrets
```bash
# Set your API token (choose any secure password/token)
npx wrangler secret put API_TOKEN

# Set your OpenAI Key
npx wrangler secret put OPENAI_API_KEY
```

### 4. Deploy
```bash
# Create Database Schema (Remote)
npx wrangler d1 migrations apply maildb --remote

# Deploy Worker
npx wrangler deploy
```

### 5. Configure Email Routing
1. Go to **Cloudflare Dashboard** > **Email** > **Email Routing**.
2. Enable Email Routing + Add your custom address.
3. specific **Destination**: Send to Worker -> `mail-app-worker`.

## Usage

### Web Interface
Navigate to your worker's URL (e.g., `https://mail-app-worker.user.workers.dev`).
Enter your `API_TOKEN` to log in.

### API
- **List Messages**: `GET /api/messages`
- **Get Detail**: `GET /api/messages/:id`
- **Download Attachment**: `GET /api/messages/:id/attachments/:attId`

## Development

Run locally using Wrangler:

```bash
# Start local dev server
npm run dev
```

Note: Real-time features (Durable Objects) work locally with `wrangler dev`.

## License
MIT
