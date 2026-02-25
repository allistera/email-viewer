import { authenticate } from '../shared/auth.js';
import { ApiRouter } from './routes.js';
import { StreamRouter } from './stream.js';
import { handleOptions, withCors } from '../shared/cors.js';
export { RealtimeHub } from '../shared/realtimeHub.js';

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

      // Check if this is a WebSocket upgrade request (before processing)
      const isWebSocketUpgrade = request.headers.get('Upgrade') === 'websocket';

      // Try Stream Router (SSE/WS)
      let response = await StreamRouter.handle(urlString, request, env);
      if (!response) {
        // Try API Router
        response = await ApiRouter.handle(urlString, request, env);
      }

      // Append CORS Headers to final response
      if (response) {
        // WebSocket upgrades return status 101 which cannot be wrapped in a new Response
        // (Cloudflare Workers only allows 200-599 for Response constructor).
        // Pass through WebSocket responses directly without CORS wrapping.
        if (isWebSocketUpgrade) {
          return response;
        }
        return withCors(response);
      }

      return withCors(new Response('Not Found', { status: 404 }));
    }

    // 2. Static Assets (SPA Fallback)
    if (env.ASSETS) {
      const response = await env.ASSETS.fetch(request);
      const newHeaders = new Headers(response.headers);

      // Add Security Headers
      newHeaders.set('X-Content-Type-Options', 'nosniff');
      newHeaders.set('X-Frame-Options', 'DENY');
      newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      newHeaders.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    } else {
      console.warn('env.ASSETS is not defined. Available bindings:', Object.keys(env));
      // Fallback for when assets are not available (e.g. dev without assets, or misconfig)
      return new Response('Assets binding missing / Not Found', { status: 404 });
    }
  }
});
