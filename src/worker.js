import { authenticate } from './auth.js';
import { ApiRouter } from './api.js';
import { StreamRouter } from './stream.js';
export { RealtimeHub } from './realtimeHub.js';

export default {
  /**
   * HTTP Handler (API + Realtime Proxy)
   */
  async fetch(request, env, _ctx) {
    const url = new URL(request.url);

    // 1. API & Stream Handling (Authenticated)
    if (url.pathname.startsWith('/api') || request.headers.get('Upgrade') === 'websocket') {

      const urlString = request.url;
      const path = url.pathname.replace('/api/', '');

      // Health Check (Public)
      if (path === 'health') {
        return new Response(JSON.stringify({ ok: true, worker: 'api' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Auth Check
      const authError = await authenticate(request, env);
      if (authError) return authError;

      // Try Stream Router (SSE/WS)
      const streamResponse = await StreamRouter.handle(urlString, request, env);
      if (streamResponse) return streamResponse;

      // Try API Router
      return ApiRouter.handle(urlString, request, env);
    }

    // 2. Static Assets (SPA Fallback)
    return env.ASSETS.fetch(request);
  }
};
