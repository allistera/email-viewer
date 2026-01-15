# Mock Development Environment

This guide explains how to develop the frontend UI without needing the full Cloudflare infrastructure running.

## Quick Start

```bash
cd web
npm install
npm run dev:mock
```

This will start both the mock API server and Vite dev server simultaneously.

## What's Included

The mock server (`mock-server.js`) provides:

- **Mock authentication**: Use token `dev-token-12345`
- **Fake email data**: 4 pre-loaded messages with different spam statuses
- **All API endpoints**:
  - `GET /api/health`
  - `GET /api/messages` (with pagination and spam filtering)
  - `GET /api/messages/:id`
  - `GET /api/messages/:messageId/attachments/:attachmentId`
  - `GET /api/stream` (Server-Sent Events)
- **Real-time simulation**: New emails arrive every 30 seconds
- **Spam classification simulation**: New emails get classified 3 seconds after arrival

## Usage

### Option 1: Run Together (Recommended)

```bash
npm run dev:mock
```

This runs both the mock API (port 8787) and Vite dev server (port 5173).

### Option 2: Run Separately

Terminal 1:
```bash
npm run mock
```

Terminal 2:
```bash
npm run dev
```

## Authentication

When prompted for a token in the UI, use:
```
dev-token-12345
```

This token is hardcoded in the mock server for convenience.

## Mock Data

The server includes 4 sample messages:

1. **Ham**: Work email with attachment
2. **Spam**: Marketing email with high confidence
3. **Ham**: Meeting reply
4. **Unknown**: Password reset (not yet classified)

Every 30 seconds, a new random email is generated and broadcast via SSE.

## Real-time Updates

The mock server simulates real-time events:

- **message.received**: Fired immediately when a new email arrives
- **message.classified**: Fired 3 seconds later with spam classification

Connect to `GET /api/stream` to receive these events.

## Customizing Mock Data

Edit `mock-server.js` to add more messages or change behavior:

```javascript
const messages = [
  {
    id: '...',
    from_addr: 'sender@example.com',
    to_addr: 'me@mydomain.com',
    subject: 'Custom subject',
    // ... more fields
  }
];
```

## Switching to Real Backend

When ready to test against the real Cloudflare Workers backend:

1. Stop the mock server
2. Start Cloudflare dev environment: `npm run dev` (from project root)
3. Vite's proxy will automatically forward requests to `localhost:8787`

No code changes needed - the Vite proxy configuration handles both.

## Benefits

- **No infrastructure**: Work without D1, R2, Queues, or Durable Objects
- **Fast iteration**: Instant feedback on UI changes
- **Predictable data**: Consistent test data every time
- **Real-time testing**: See SSE updates without setting up workers
- **Offline development**: Work without internet connection
