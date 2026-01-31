import { DB } from './db.js';

const MISSING_TABLE_PATTERN = /no such table/i;

// UUID v4 validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Tag name validation: alphanumeric, spaces, hyphens, underscores, slashes (for hierarchy)
// Max 100 characters
const TAG_NAME_REGEX = /^[\w\s\-/]+$/;
const MAX_TAG_NAME_LENGTH = 100;

const TODOIST_API_URL = 'https://api.todoist.com/rest/v2/tasks';
const TODOIST_CONTENT_MAX = 500;
const TODOIST_DESCRIPTION_MAX = 2000;

const isValidUUID = (id) => typeof id === 'string' && UUID_REGEX.test(id);

const isValidTagName = (name) => 
  typeof name === 'string' && 
  name.length > 0 && 
  name.length <= MAX_TAG_NAME_LENGTH && 
  TAG_NAME_REGEX.test(name);

const truncateText = (value, maxLength) => {
  if (!value) return '';
  const text = String(value);
  if (text.length <= maxLength) return text;
  const sliceLength = Math.max(0, maxLength - 3);
  return `${text.slice(0, sliceLength)}...`;
};

const normalizeTodoistLine = (value, maxLength) => {
  if (!value) return '';
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  return truncateText(cleaned, maxLength);
};

const normalizeTodoistDescription = (value, maxLength) => {
  if (!value) return '';
  const cleaned = String(value).replace(/\r\n/g, '\n').trim();
  return truncateText(cleaned, maxLength);
};

const formatIsoDate = (timestamp) => {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString();
  } catch {
    return '';
  }
};

const buildTodoistDescription = (message) => {
  const lines = [];
  const from = normalizeTodoistLine(message.from_addr, 200);
  const to = normalizeTodoistLine(message.to_addr, 200);
  const received = formatIsoDate(message.received_at);
  const snippet = normalizeTodoistLine(message.snippet, 500);

  if (from) lines.push(`From: ${from}`);
  if (to) lines.push(`To: ${to}`);
  if (received) lines.push(`Received: ${received}`);
  if (snippet) lines.push(`Snippet: ${snippet}`);
  lines.push(`Message ID: ${message.id}`);

  return normalizeTodoistDescription(lines.join('\n'), TODOIST_DESCRIPTION_MAX);
};

const buildTodoistPayload = (message, body = {}, env = {}) => {
  const fallbackFrom = normalizeTodoistLine(message.from_addr, 200);
  const defaultContent = message.subject || message.snippet || (fallbackFrom ? `Email from ${fallbackFrom}` : 'Email task');
  const content = normalizeTodoistLine(body.content || defaultContent, TODOIST_CONTENT_MAX) || 'Email task';
  const description = body.description
    ? normalizeTodoistDescription(body.description, TODOIST_DESCRIPTION_MAX)
    : buildTodoistDescription(message);

  const payload = { content };
  if (description) payload.description = description;

  const projectId = body.projectId || env.TODOIST_PROJECT_ID;
  if (projectId) payload.project_id = projectId;

  return payload;
};

const resolveTodoistToken = (request, body = {}, env = {}) => {
  const headerToken = request.headers.get('X-Todoist-Token') || request.headers.get('Todoist-Token');
  const bodyToken = body?.todoistToken;
  const envToken = env.TODOIST_API_TOKEN;
  const token = (headerToken || bodyToken || envToken || '').trim();
  return token || null;
};

const readJsonBody = async (request) => {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('application/json')) return {};
  const text = await request.text();
  if (!text) return {};
  try {
    const data = JSON.parse(text);
    if (data && typeof data === 'object') return data;
    return {};
  } catch (error) {
    throw new Error('Invalid JSON body');
  }
};

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
    const path = url.pathname.replace('/api/', '').replace(/\/$/, '');

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

        // Add to Todoist
        if (parts.length === 3 && parts[2] === 'todoist' && request.method === 'POST') {
          const msg = await DB.getMessage(env.DB, id);
          if (!msg) return new Response('Message Not Found', { status: 404 });

          let body = {};
          try {
            body = await readJsonBody(request);
          } catch (error) {
            return jsonResponse({ error: error.message || 'Invalid JSON body' }, { status: 400 });
          }

          const todoistToken = resolveTodoistToken(request, body, env);
          if (!todoistToken) {
            return jsonResponse(
              { error: 'Todoist token missing. Add it in Settings or configure TODOIST_API_TOKEN.' },
              { status: 400 }
            );
          }

          const payload = buildTodoistPayload(msg, body, env);

          const todoistResponse = await fetch(TODOIST_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${todoistToken}`
            },
            body: JSON.stringify(payload)
          });

          if (!todoistResponse.ok) {
            const contentType = todoistResponse.headers.get('Content-Type') || '';
            let errorDetails = '';
            if (contentType.includes('application/json')) {
              try {
                const errorBody = await todoistResponse.json();
                errorDetails = errorBody?.error || errorBody?.message || JSON.stringify(errorBody);
              } catch (e) {
                errorDetails = '';
              }
            } else {
              errorDetails = await todoistResponse.text();
            }

            const errorMessage = errorDetails
              ? `Todoist request failed: ${errorDetails}`
              : 'Todoist request failed.';

            return jsonResponse({ error: errorMessage }, { status: 502 });
          }

          const task = await todoistResponse.json();
          return jsonResponse({ ok: true, task });
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
