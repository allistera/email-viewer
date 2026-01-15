/**
 * Mail App Worker - Main Entry Point
 * Handles email ingestion, HTTP API, queue consumption
 */

import { RealtimeHub } from './realtimeHub.js';
import { handleIncomingEmail } from './ingest.js';
import { processQueueBatch } from './queue.js';
import { requireAuth } from './auth.js';
import { handleListMessages, handleGetMessage, handleDownloadAttachment } from './routes/api.js';
import { handleSSEStream, handleWebSocketStream } from './routes/stream.js';

export { RealtimeHub };

export default {
  /**
   * Email handler - called by Cloudflare Email Routing
   */
  async email(message, env, _ctx) {
    await handleIncomingEmail(message, env, _ctx);
  },

  /**
   * HTTP request handler - API and static files
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === '/api/health') {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (pathname === '/api/messages') {
      return requireAuth(handleListMessages)(request, env, ctx);
    }

    if (pathname === '/api/stream') {
      return requireAuth(handleSSEStream)(request, env, ctx);
    }

    if (pathname === '/api/ws') {
      return requireAuth(handleWebSocketStream)(request, env, ctx);
    }

    const messageMatch = pathname.match(/^\/api\/messages\/([^/]+)$/);
    if (messageMatch) {
      return requireAuth((req, env) => handleGetMessage(req, env, messageMatch[1]))(request, env, ctx);
    }

    const attachmentMatch = pathname.match(/^\/api\/messages\/([^/]+)\/attachments\/([^/]+)$/);
    if (attachmentMatch) {
      return requireAuth((req, env) =>
        handleDownloadAttachment(req, env, attachmentMatch[1], attachmentMatch[2])
      )(request, env, ctx);
    }

    return new Response('Not Found', { status: 404 });
  },

  /**
   * Queue consumer - async post-processing
   */
  async queue(batch, env, _ctx) {
    await processQueueBatch(batch, env);
  }
};
