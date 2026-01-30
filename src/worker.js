import { authenticate } from './auth.js';
import { ApiRouter } from './api.js';
import { StreamRouter } from './stream.js';
import { handleOptions, withCors } from './cors.js';
export { RealtimeHub } from './realtimeHub.js';

import * as Sentry from "@sentry/cloudflare";

const sentryOptions = (env) => ({
  dsn: env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  enableLogs: true,
  sendDefaultPii: true,
});

export default Sentry.withSentry(sentryOptions, {
  /**
   * HTTP Handler (API + Realtime Proxy)
   */
  async fetch(request, env, _ctx) {
    const url = new URL(request.url);

    // 1. API & Stream Handling
    if (url.pathname.startsWith('/api') || request.headers.get('Upgrade') === 'websocket') {

      // Handle CORS Preflight
      const optionsResponse = handleOptions(request);
      if (optionsResponse) return optionsResponse;

      const urlString = request.url;
      const path = url.pathname.replace('/api/', '');

      // Health Check (Public)
      if (path === 'health') {
        const res = new Response(JSON.stringify({ ok: true, worker: 'api' }), {
          headers: { 'Content-Type': 'application/json' }
        });
        return withCors(res);
      }

      // Auth Check
      const authError = await authenticate(request, env);
      if (authError) {
        return withCors(authError);
      }

      // Try Stream Router (SSE/WS)
      let response = await StreamRouter.handle(urlString, request, env);
      if (!response) {
        // Try API Router
        response = await ApiRouter.handle(urlString, request, env);
      }

      // Append CORS Headers to final response
      if (response) {
        return withCors(response);
      }

      return withCors(new Response('Not Found', { status: 404 }));
    }

    // 2. Static Assets (SPA Fallback)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    } else {
      console.warn('env.ASSETS is not defined. Available bindings:', Object.keys(env));
      // Fallback for when assets are not available (e.g. dev without assets, or misconfig)
      return new Response('Assets binding missing / Not Found', { status: 404 });
    }
  }
});
