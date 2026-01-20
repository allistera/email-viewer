import { DB } from './db.js';

const MISSING_TABLE_PATTERN = /no such table/i;

const jsonResponse = (payload, init = {}) =>
  new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init
  });

const databaseNotInitializedResponse = () =>
  jsonResponse(
    {
      error: 'Database not initialized.',
      details: 'Run: npx wrangler d1 migrations apply maildb --remote'
    },
    { status: 500 }
  );

const isMissingTableError = (error) =>
  Boolean(error?.message && MISSING_TABLE_PATTERN.test(error.message));


export const ApiRouter = {
  async handle(urlString, request, env) {
    const url = new URL(urlString);
    const path = url.pathname.replace('/api/', '');

    try {
      // GET /api/messages
      if (path === 'messages' && request.method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit')) || 50;
        const before = parseInt(url.searchParams.get('before')) || null;
        const spamStatus = url.searchParams.get('spamStatus') || null;

        const items = await DB.listMessages(env.DB, { limit, before, spamStatus });
        const nextBefore = items.length > 0 ? items[items.length - 1].received_at : null;

        return jsonResponse({ items, nextBefore });
      }

      // GET /api/messages/:id
      // GET /api/messages/:id/attachments/:attId
      if (path.startsWith('messages/')) {
        const parts = path.split('/');
        const id = parts[1];

        // Detail
        if (parts.length === 2 && request.method === 'GET') {
          const msg = await DB.getMessage(env.DB, id);
          if (!msg) return new Response('Not Found', { status: 404 });
          return jsonResponse(msg);
        }

        // Download Attachment
        if (parts.length === 4 && parts[2] === 'attachments' && request.method === 'GET') {
          const attId = parts[3];
          const msg = await DB.getMessage(env.DB, id);
          if (!msg) return new Response('Message Not Found', { status: 404 });

          const att = msg.attachments.find(a => a.id === attId);
          if (!att) return new Response('Attachment Not Found', { status: 404 });

          const object = await env.MAILSTORE.get(att.r2_key);
          if (!object) return new Response('File Not Found', { status: 404 });

          return new Response(object.body, {
            headers: {
              'Content-Type': att.content_type || 'application/octet-stream',
              'Content-Disposition': `attachment; filename="${att.filename}"`
            }
          });
        }
      }

      // GET /api/health
      if (path === 'health') {
        return jsonResponse({ ok: true });
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      if (isMissingTableError(error)) {
        return databaseNotInitializedResponse();
      }
      throw error;
    }
  }
};
