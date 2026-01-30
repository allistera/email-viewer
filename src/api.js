import { DB } from './db.js';

const MISSING_TABLE_PATTERN = /no such table/i;

// UUID v4 validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Tag name validation: alphanumeric, spaces, hyphens, underscores, slashes (for hierarchy)
// Max 100 characters
const TAG_NAME_REGEX = /^[\w\s\-/]+$/;
const MAX_TAG_NAME_LENGTH = 100;

const isValidUUID = (id) => typeof id === 'string' && UUID_REGEX.test(id);

const isValidTagName = (name) => 
  typeof name === 'string' && 
  name.length > 0 && 
  name.length <= MAX_TAG_NAME_LENGTH && 
  TAG_NAME_REGEX.test(name);

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
        const tag = url.searchParams.get('tag') || null;
        const excludeTag = url.searchParams.get('excludeTag') || null;
        // Parse 'archived'; 'true' -> true, else false
        const archived = url.searchParams.get('archived') === 'true';
        const search = url.searchParams.get('q') || url.searchParams.get('search') || null;

        const items = await DB.listMessages(env.DB, { limit, before, tag, excludeTag, archived, search });
        const nextBefore = items.length > 0 ? items[items.length - 1].received_at : null;

        return jsonResponse({ items, nextBefore });
      }

      // GET /api/messages/:id
      // GET /api/messages/:id/attachments/:attId
      // POST /api/messages/:id/archive
      if (path.startsWith('messages/')) {
        const parts = path.split('/');
        const id = parts[1];

        // Validate message ID format
        if (!isValidUUID(id)) {
          return jsonResponse({ error: 'Invalid message ID format' }, { status: 400 });
        }

        // Detail
        if (parts.length === 2 && request.method === 'GET') {
          const msg = await DB.getMessage(env.DB, id);
          if (!msg) return new Response('Not Found', { status: 404 });
          return jsonResponse(msg);
        }

        // Archive
        if (parts.length === 3 && parts[2] === 'archive' && request.method === 'POST') {
          await DB.archiveMessage(env.DB, id);
          return jsonResponse({ ok: true });
        }

        // Download Attachment
        if (parts.length === 4 && parts[2] === 'attachments' && request.method === 'GET') {
          const attId = parts[3];
          
          // Validate attachment ID format
          if (!isValidUUID(attId)) {
            return jsonResponse({ error: 'Invalid attachment ID format' }, { status: 400 });
          }
          
          const msg = await DB.getMessage(env.DB, id);
          if (!msg) return new Response('Message Not Found', { status: 404 });

          const att = msg.attachments.find(a => a.id === attId);
          if (!att) return new Response('Attachment Not Found', { status: 404 });

          const object = await env.MAILSTORE.get(att.r2_key);
          if (!object) return new Response('File Not Found', { status: 404 });

          // Sanitize filename for Content-Disposition header to prevent header injection
          const safeFilename = (att.filename || 'attachment')
            .replace(/["\\\r\n]/g, '_')  // Remove dangerous characters
            .replace(/[^\x20-\x7E]/g, '_');  // ASCII printable only for compatibility
          
          return new Response(object.body, {
            headers: {
              'Content-Type': att.content_type || 'application/octet-stream',
              'Content-Disposition': `attachment; filename="${safeFilename}"`
            }
          });
        }

        // PATCH /api/messages/:id (Update Tag)
        // Supports: 
        // - tag: string (Replace all tags with this one, legacy)
        // - addTag: string (Add this tag)
        // - removeTag: string (Remove this tag)
        if (parts.length === 2 && request.method === 'PATCH') {
          const body = await request.json();
          // Verify message exists
          const msg = await DB.getMessage(env.DB, id);
          if (!msg) return new Response('Message Not Found', { status: 404 });

          if (body.addTag) {
            await DB.addMessageTag(env.DB, id, body.addTag);
          } else if (body.removeTag) {
            await DB.removeMessageTag(env.DB, id, body.removeTag);
          } else if (body.tag !== undefined) {
            // Legacy/Single mode: Replace
            await DB.updateTagInfo(env.DB, id, { tag: body.tag, confidence: 1.0, reason: 'Manual update' });
          }

          return jsonResponse({ ok: true });
        }
      }

      // GET /api/tags
      if (path === 'tags' && request.method === 'GET') {
        const tags = await DB.getTags(env.DB);
        return jsonResponse(tags);
      }

      // POST /api/tags
      if (path === 'tags' && request.method === 'POST') {
        const { name } = await request.json();
        if (!name) return jsonResponse({ error: 'Name is required' }, { status: 400 });
        
        if (!isValidTagName(name)) {
          return jsonResponse({ 
            error: 'Invalid tag name. Use alphanumeric characters, spaces, hyphens, underscores, or slashes. Max 100 characters.' 
          }, { status: 400 });
        }

        try {
          const tag = await DB.createTag(env.DB, name);
          return jsonResponse(tag, { status: 201 });
        } catch (e) {
          // Unique constraint
          return jsonResponse({ error: 'Tag already exists' }, { status: 409 });
        }
      }

      // PUT /api/tags/:id
      if (path.startsWith('tags/') && request.method === 'PUT') {
        const id = path.split('/')[1];
        
        // Validate tag ID format
        if (!isValidUUID(id)) {
          return jsonResponse({ error: 'Invalid tag ID format' }, { status: 400 });
        }
        
        const { name } = await request.json();
        if (!name) return jsonResponse({ error: 'Name is required' }, { status: 400 });
        
        if (!isValidTagName(name)) {
          return jsonResponse({ 
            error: 'Invalid tag name. Use alphanumeric characters, spaces, hyphens, underscores, or slashes. Max 100 characters.' 
          }, { status: 400 });
        }

        try {
          await DB.updateTag(env.DB, id, name);
          return jsonResponse({ ok: true });
        } catch (e) {
          if (e.message && e.message.includes('already exists')) {
            return jsonResponse({ error: 'Tag name already exists' }, { status: 409 });
          }
          throw e;
        }
      }

      // DELETE /api/tags/:id
      if (path.startsWith('tags/') && request.method === 'DELETE') {
        const id = path.split('/')[1];
        
        // Validate tag ID format
        if (!isValidUUID(id)) {
          return jsonResponse({ error: 'Invalid tag ID format' }, { status: 400 });
        }
        
        try {
          await DB.deleteTag(env.DB, id);
          return jsonResponse({ ok: true });
        } catch (e) {
          if (e.message && e.message.includes('system tag')) {
            return jsonResponse({ error: e.message }, { status: 403 });
          }
          throw e;
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
