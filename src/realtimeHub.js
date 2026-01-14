/**
 * RealtimeHub Durable Object
 * Manages SSE and WebSocket connections for real-time updates
 */

export class RealtimeHub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.nextId = 0;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/connect/sse') {
      return this.handleSSE(request);
    }

    if (url.pathname === '/connect/ws') {
      return this.handleWebSocket(request);
    }

    if (url.pathname === '/broadcast' && request.method === 'POST') {
      return this.handleBroadcast(request);
    }

    return new Response('Not Found', { status: 404 });
  }

  /**
   * Handle Server-Sent Events connection
   */
  async handleSSE(request) {
    const sessionId = this.nextId++;

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    this.sessions.set(sessionId, {
      type: 'sse',
      writer,
      encoder
    });

    const keepAliveInterval = setInterval(() => {
      try {
        writer.write(encoder.encode(': keepalive\n\n'));
      } catch {
        clearInterval(keepAliveInterval);
      }
    }, 30000);

    const cleanup = () => {
      clearInterval(keepAliveInterval);
      this.sessions.delete(sessionId);
      try {
        writer.close();
      } catch {
        // Already closed
      }
    };

    request.signal?.addEventListener('abort', cleanup);

    writer.write(encoder.encode(': connected\n\n'));

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  }

  /**
   * Handle WebSocket connection
   */
  async handleWebSocket(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const sessionId = this.nextId++;
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.sessions.set(sessionId, {
      type: 'ws',
      socket: server
    });

    server.accept();

    server.addEventListener('close', () => {
      this.sessions.delete(sessionId);
    });

    server.addEventListener('error', () => {
      this.sessions.delete(sessionId);
    });

    server.send(JSON.stringify({ type: 'connected' }));

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  /**
   * Handle broadcast request
   */
  async handleBroadcast(request) {
    const event = await request.json();

    const message = JSON.stringify(event);
    let successCount = 0;
    let errorCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      try {
        if (session.type === 'sse') {
          session.writer.write(session.encoder.encode(`data: ${message}\n\n`));
          successCount++;
        } else if (session.type === 'ws') {
          session.socket.send(message);
          successCount++;
        }
      } catch (error) {
        errorCount++;
        this.sessions.delete(sessionId);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      broadcasted: successCount,
      errors: errorCount
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
