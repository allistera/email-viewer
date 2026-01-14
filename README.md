# Email Inbox App

A personal email web application built on Cloudflare Workers infrastructure.

## Features

- 📧 Inbound email ingestion via Cloudflare Email Routing
- 🗄️ Message storage in D1 (metadata) and R2 (raw emails + attachments)
- 🤖 AI-powered spam classification using OpenAI
- ⚡ Real-time updates via Server-Sent Events (SSE) and WebSockets
- 🎨 Todoist-inspired UI built with Vue.js
- 🔒 Simple bearer token authentication

## Architecture

- **Cloudflare Workers**: Email ingestion, REST API, queue consumer
- **Cloudflare D1**: SQLite database for message metadata
- **Cloudflare R2**: Object storage for raw emails and attachments
- **Cloudflare Queues**: Async post-processing (spam classification)
- **Cloudflare Durable Objects**: Real-time event broadcasting
- **OpenAI API**: Spam classification
- **Vue.js 3**: Frontend UI

## Setup

### Prerequisites

- Node.js 18+
- Cloudflare account with Workers paid plan (for D1, R2, Queues, Durable Objects)
- OpenAI API key

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create Cloudflare resources:
   ```bash
   # Create D1 databases
   npm run db:create
   npm run db:create:dev

   # Create R2 buckets
   npm run r2:create
   npm run r2:create:dev

   # Create queue
   npm run queue:create
   ```

4. Update `wrangler.toml` with actual database and bucket IDs

5. Set secrets:
   ```bash
   wrangler secret put API_TOKEN
   wrangler secret put OPENAI_API_KEY
   ```

6. Run migrations:
   ```bash
   npm run db:migrate:dev
   ```

### Development

```bash
npm run dev
```

### Deployment

```bash
# Deploy to production
npm run deploy:production

# Run migrations on production
npm run db:migrate:remote
```

## Project Structure

```
/
  src/
    worker.js           # Main entry point
    auth.js             # Bearer token validation
    db.js               # D1 helpers
    r2.js               # R2 helpers
    mime.js             # Email parsing
    openai.js           # Spam classifier
    realtimeHub.js      # Durable Object
    routes/
      api.js            # REST endpoints
      stream.js         # SSE/WebSocket
  web/                  # Vue.js frontend
  migrations/           # D1 SQL migrations
  wrangler.toml         # Cloudflare configuration
```

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/messages` - List messages (paginated)
- `GET /api/messages/:id` - Get message details
- `GET /api/messages/:id/attachments/:attId` - Download attachment
- `GET /api/stream` - SSE connection
- `GET /api/ws` - WebSocket connection

All endpoints except `/api/health` require `Authorization: Bearer <token>` header.

## License

MIT
