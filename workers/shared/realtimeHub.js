import { instrumentDurableObjectWithSentry } from '@sentry/cloudflare';
import { sentryOptions } from './sentry.js';

/**
 * Durable Object: RealtimeHub
 * Manages WebSocket and SSE connections for real-time updates.
 */
class RealtimeHubBase {
  constructor(state, env) {
    this.state = state;
    this.env = env;

    // In-memory storage for active connections
    // DOs are single-threaded so we don't need locks, but state resets on restart.
    this.sseSessions = new Set();
    this.wsSessions = new Set();
    this.heartbeatInterval = null;
  }

  startHeartbeat() {
    if (this.heartbeatInterval) return;
    // Broadcast a heartbeat every 25s to keep the DO alive and let clients
    // detect stale connections.
    this.heartbeatInterval = setInterval(() => {
      this.broadcast({ type: 'heartbeat' });
    }, 25000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  checkHeartbeat() {
    const hasClients = this.sseSessions.size > 0 || this.wsSessions.size > 0;
    if (hasClients) {
      this.startHeartbeat();
    } else {
      this.stopHeartbeat();
    }
  }

  async fetch(request) {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      // SSE Endpoint
      if (pathname === '/connect/sse') {
        return this.handleSSE(request);
      }

      // WebSocket Endpoint
      if (pathname === '/connect/ws') {
        return this.handleWS(request);
      }

      // Broadcast API (Internal)
      if (pathname === '/broadcast' && request.method === 'POST') {
        const payload = await request.json();
        this.broadcast(payload);
        return new Response('ok');
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('RealtimeHub fetch error:', error.message, error.stack);
      return new Response(
        JSON.stringify({ error: 'Realtime hub error', details: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  handleSSE(request) {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Init stream
    writer.write(encoder.encode('data: {"type":"connected"}\n\n'));

    // Store session
    this.sseSessions.add(writer);
    this.checkHeartbeat();

    // Cleanup when writer closes (client disconnect)
    // Note: We use both writer.closed and request.signal for redundant cleanup.
    // This "belt and suspenders" approach ensures cleanup happens regardless of
    // how the connection ends. Duplicate delete calls are safe (Set.delete is idempotent).
    writer.closed
      .then(() => {
        this.sseSessions.delete(writer);
        this.checkHeartbeat();
      })
      .catch(() => {
        this.sseSessions.delete(writer);
        this.checkHeartbeat();
      });

    // Also handle abort signal if available
    if (request.signal) {
      request.signal.addEventListener('abort', () => {
        this.sseSessions.delete(writer);
        this.checkHeartbeat();
        writer.close().catch(() => { });
      });
    }

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  handleWS(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    server.accept();
    this.wsSessions.add(server);
    this.checkHeartbeat();

    server.addEventListener('close', () => {
      this.wsSessions.delete(server);
      this.checkHeartbeat();
    });

    server.addEventListener('error', () => {
      this.wsSessions.delete(server);
      this.checkHeartbeat();
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  broadcast(message) {
    const data = JSON.stringify(message);

    // 1. Broadcast to SSE
    const encoder = new TextEncoder();
    const ssePayload = encoder.encode(`data: ${data}\n\n`);
    for (const writer of this.sseSessions) {
      writer.write(ssePayload).catch(() => this.sseSessions.delete(writer));
    }

    // 2. Broadcast to WebSockets
    for (const ws of this.wsSessions) {
      try {
        ws.send(data);
      } catch (e) {
        this.wsSessions.delete(ws);
      }
    }
  }
}

export const RealtimeHub = instrumentDurableObjectWithSentry(
  sentryOptions,
  RealtimeHubBase,
);
