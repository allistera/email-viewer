import { DB } from './db.js';


export const ApiRouter = {
  async handle(urlString, request, env) {
    const url = new URL(urlString);
    const path = url.pathname.replace('/api/', '');

    // GET /api/messages
    if (path === 'messages' && request.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit')) || 50;
      const before = parseInt(url.searchParams.get('before')) || null;
      const spamStatus = url.searchParams.get('spamStatus') || null;

      const items = await DB.listMessages(env.DB, { limit, before, spamStatus });
      const nextBefore = items.length > 0 ? items[items.length - 1].received_at : null;

      return new Response(JSON.stringify({ items, nextBefore }), {
        headers: { 'Content-Type': 'application/json' }
      });
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
        return new Response(JSON.stringify(msg), {
          headers: { 'Content-Type': 'application/json' }
        });
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
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};
