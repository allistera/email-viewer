import { authenticate } from './auth.js';
import { ApiRouter } from './api.js';
import { StreamRouter } from './stream.js';
export { RealtimeHub } from './realtimeHub.js';

import * as Sentry from "@sentry/cloudflare";

// ... existing imports

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
    // ... existing logic

    const url = new URL(request.url);

    // CORS Helper
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*', // Or specific domain
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*', // Allow all headers
      'Access-Control-Max-Age': '86400',
    };

    function handleOptions(request) {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: corsHeaders
        });
      }
      return null;
    }

    // 1. API & Stream Handling
    if (url.pathname.startsWith('/api') || request.headers.get('Upgrade') === 'websocket') {

      console.log(`Processing API Request: ${request.method} ${request.url}`);

      // Handle CORS Preflight
      const optionsResponse = handleOptions(request);
      if (optionsResponse) return optionsResponse;

      const urlString = request.url;
      const path = url.pathname.replace('/api/', '');

      // Health Check (Public)
      if (path === 'health') {
        return new Response(JSON.stringify({ ok: true, worker: 'api' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Auth Check
      const authError = await authenticate(request, env);
      if (authError) {
        // Append CORS to auth error too
        const newHeaders = new Headers(authError.headers);
        Object.keys(corsHeaders).forEach(k => newHeaders.set(k, corsHeaders[k]));
        return new Response(authError.body, { status: authError.status, headers: newHeaders });
      }

      // Try Stream Router (SSE/WS)
      let response = await StreamRouter.handle(urlString, request, env);
      if (!response) {
        // Try API Router
        response = await ApiRouter.handle(urlString, request, env);
      }

      // Append CORS Headers to final response
      if (response) {
        if (response.status < 200 || response.status > 599) {
          return response;
        }

        const newHeaders = new Headers(response.headers);
        Object.keys(corsHeaders).forEach(k => newHeaders.set(k, corsHeaders[k]));
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
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
