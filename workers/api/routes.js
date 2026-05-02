import { DB } from '../shared/db.js';
import { sendNewEmailNotification } from '../shared/notifications.js';
import { EmailComposer } from '../shared/openai.js';

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

// Rule name: same as tag name
const MAX_RULE_NAME_LENGTH = 100;
const MAX_MATCH_LENGTH = 1000;
const isValidRuleName = (name) =>
  typeof name === 'string' &&
  name.length > 0 &&
  name.length <= MAX_RULE_NAME_LENGTH &&
  TAG_NAME_REGEX.test(name);

const isValidMatchValue = (val) =>
  val === null || val === undefined || val === '' ||
  (typeof val === 'string' && val.length <= MAX_MATCH_LENGTH);

const isValidPriority = (p) => {
  const n = Number(p);
  return Number.isInteger(n) && n >= 0 && n <= 100;
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

/** Convert ArrayBuffer to base64 in chunks to avoid stack overflow. */
const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
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

// Cloudflare Workers only accepts status codes 200-599
const clampStatus = (status) => {
  const n = Number(status);
  if (!Number.isFinite(n) || n < 200 || n > 599) return 502;
  return Math.floor(n);
};

const parseListUnsubscribeUrls = (headerValue) => {
  if (!headerValue || typeof headerValue !== 'string') return [];
  const urls = [];
  const bracketMatches = headerValue.match(/<[^>]+>/g) || [];
  if (bracketMatches.length > 0) {
    for (const entry of bracketMatches) {
      const raw = entry.slice(1, -1).trim();
      if (raw) urls.push(raw);
    }
  } else {
    for (const part of headerValue.split(',')) {
      const raw = part.trim();
      if (raw) urls.push(raw);
    }
  }
  return urls;
};


export const ApiRouter = {
  async handle(urlString, request, env) {
    const url = new URL(urlString);
    const path = url.pathname.replace('/api/', '').replace(/\/$/, '');

    try {
      // GET /api/messages
      if (path === 'messages' && request.method === 'GET') {
        // Clamp limit to max 50 to prevent DoS/resource exhaustion
        const requestedLimit = parseInt(url.searchParams.get('limit')) || 50;
        const limit = Math.min(Math.max(1, requestedLimit), 50);

        const before = parseInt(url.searchParams.get('before')) || null;
        const tag = url.searchParams.get('tag') || null;
        const excludeTagParams = url.searchParams.getAll('excludeTag');
        const excludeTag = excludeTagParams.length > 0
          ? excludeTagParams
          : (url.searchParams.get('excludeTag') || null);
        // Parse 'archived'; 'true' -> true, else false
        const archived = url.searchParams.get('archived') === 'true';
        const hideSnoozed = url.searchParams.get('hideSnoozed') === 'true';
        const snoozed = url.searchParams.get('snoozed') === 'true';
        const search = url.searchParams.get('q') || url.searchParams.get('search') || null;

        const items = await DB.listMessages(env.DB, { limit, before, tag, excludeTag, archived, search, hideSnoozed, snoozed });
        const nextBefore = items.length > 0 ? items[items.length - 1].received_at : null;

        return jsonResponse({ items, nextBefore });
      }

      // GET /api/messages/counts - returns counts for inbox, archive, spam, sent, and each tag
      if (path === 'messages/counts' && request.method === 'GET') {
        const tags = await DB.getTags(env.DB);
        const userTagNames = tags
          .filter(t => t.name !== 'Spam' && t.name !== 'Sent')
          .map(t => t.name);

        const counts = await DB.getCounts(env.DB);

        const tagCountMap = {};
        userTagNames.forEach((name) => {
          tagCountMap[name] = counts.tagCounts[name] ?? 0;
        });

        return jsonResponse({
          inbox: counts.inbox,
          archive: counts.archive,
          spam: counts.spam,
          unreadSpam: counts.unreadSpam,
          unreadArchive: counts.unreadArchive,
          unreadInbox: counts.unreadInbox,
          sent: counts.sent,
          tags: tagCountMap
        });
      }

      // POST /api/messages/archive-all - archive all messages in a mailbox
      if (path === 'messages/archive-all' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        // tag: string → specific tag; null/undefined → inbox (excludes Spam)
        const tag = body.tag !== undefined ? body.tag : null;
        if (tag !== null && !isValidTagName(tag)) {
          return jsonResponse({ error: 'Invalid tag name' }, { status: 400 });
        }
        await DB.archiveAllMessages(env.DB, { tag });
        return jsonResponse({ ok: true });
      }

      // POST /api/messages/mark-all-read - mark all messages in a mailbox as read
      if (path === 'messages/mark-all-read' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const tag = body.tag !== undefined ? body.tag : null;
        if (tag !== null && !isValidTagName(tag)) {
          return jsonResponse({ error: 'Invalid tag name' }, { status: 400 });
        }
        await DB.markAllRead(env.DB, { tag });
        return jsonResponse({ ok: true });
      }

      // GET /api/todoist/projects - proxy to Todoist worker
      if (path === 'todoist/projects' && request.method === 'GET') {
        const todoistToken = resolveTodoistToken(request, {}, env);
        if (!todoistToken) {
          return jsonResponse(
            { error: 'Todoist token missing. Add it in Settings.' },
            { status: 400 }
          );
        }
        if (!env.TODOIST_WORKER || typeof env.TODOIST_WORKER.fetch !== 'function') {
          return jsonResponse(
            { error: 'Todoist worker not configured.' },
            { status: 500 }
          );
        }
        const origin = new URL(request.url).origin;
        const todoistRequest = new Request(`https://todoist-worker/projects`, {
          method: 'GET',
          headers: {
            'X-Todoist-Token': todoistToken,
            'X-App-Origin': origin
          }
        });
        const todoistResponse = await env.TODOIST_WORKER.fetch(todoistRequest);
        const responseBody = await todoistResponse.text();
        const contentType = todoistResponse.headers.get('Content-Type') || 'application/json';
        return new Response(responseBody, {
          status: clampStatus(todoistResponse.status),
          headers: { 'Content-Type': contentType }
        });
      }

      // GET /api/todoist/tasks - proxy to Todoist worker
      if (path === 'todoist/tasks' && request.method === 'GET') {
        const todoistToken = resolveTodoistToken(request, {}, env);
        if (!todoistToken) {
          return jsonResponse(
            { error: 'Todoist token missing. Add it in Settings.' },
            { status: 400 }
          );
        }
        if (!env.TODOIST_WORKER || typeof env.TODOIST_WORKER.fetch !== 'function') {
          return jsonResponse(
            { error: 'Todoist worker not configured.' },
            { status: 500 }
          );
        }
        const todoistRequest = new Request('https://todoist-worker/tasks', {
          method: 'GET',
          headers: { 'X-Todoist-Token': todoistToken }
        });
        const todoistResponse = await env.TODOIST_WORKER.fetch(todoistRequest);
        const responseBody = await todoistResponse.text();
        const contentType = todoistResponse.headers.get('Content-Type') || 'application/json';
        return new Response(responseBody, {
          status: clampStatus(todoistResponse.status),
          headers: { 'Content-Type': contentType }
        });
      }

      // POST /api/todoist/tasks/:id/close - proxy to Todoist worker
      if (path.startsWith('todoist/tasks/') && path.endsWith('/close') && request.method === 'POST') {
        const todoistToken = resolveTodoistToken(request, {}, env);
        if (!todoistToken) {
          return jsonResponse(
            { error: 'Todoist token missing. Add it in Settings.' },
            { status: 400 }
          );
        }
        if (!env.TODOIST_WORKER || typeof env.TODOIST_WORKER.fetch !== 'function') {
          return jsonResponse(
            { error: 'Todoist worker not configured.' },
            { status: 500 }
          );
        }
        const taskId = path.split('/')[2];
        const todoistRequest = new Request(`https://todoist-worker/tasks/${taskId}/close`, {
          method: 'POST',
          headers: { 'X-Todoist-Token': todoistToken }
        });
        const todoistResponse = await env.TODOIST_WORKER.fetch(todoistRequest);
        const responseBody = await todoistResponse.text();
        const contentType = todoistResponse.headers.get('Content-Type') || 'application/json';
        return new Response(responseBody, {
          status: clampStatus(todoistResponse.status),
          headers: { 'Content-Type': contentType }
        });
      }

      // GET /api/messages/:id
      // GET /api/messages/:id/attachments/:attId
      // POST /api/messages/:id/archive
      if (path.startsWith('messages/')) {
        const parts = path.split('/');
        const id = parts[1];

        // Detail
        if (parts.length === 2 && request.method === 'GET') {
          const msg = await DB.getMessage(env.DB, id);
          if (!msg) return new Response('Not Found', { status: 404 });
          await DB.markRead(env.DB, id);
          return jsonResponse({ ...msg, is_read: 1 });
        }

        // Archive
        if (parts.length === 3 && parts[2] === 'archive' && request.method === 'POST') {
          await DB.archiveMessage(env.DB, id);
          return jsonResponse({ ok: true });
        }

        // Snooze
        if (parts.length === 3 && parts[2] === 'snooze' && request.method === 'POST') {
          let body = {};
          try {
            body = await readJsonBody(request);
          } catch (error) {
            return jsonResponse({ error: error.message || 'Invalid JSON body' }, { status: 400 });
          }
          const until = Number(body.until);
          if (!Number.isFinite(until) || until <= Date.now()) {
            return jsonResponse({ error: 'Snooze time must be a future timestamp (ms).' }, { status: 400 });
          }
          await DB.snoozeMessage(env.DB, id, Math.floor(until));
          return jsonResponse({ ok: true, snoozedUntil: Math.floor(until) });
        }

        // Unsnooze
        if (parts.length === 3 && parts[2] === 'unsnooze' && request.method === 'POST') {
          await DB.unsnoozeMessage(env.DB, id);
          return jsonResponse({ ok: true });
        }

        // Add to Todoist
        if (parts.length === 3 && parts[2] === 'todoist' && request.method === 'POST') {
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

          if (!env.TODOIST_WORKER || typeof env.TODOIST_WORKER.fetch !== 'function') {
            return jsonResponse(
              { error: 'Todoist worker not configured.' },
              { status: 500 }
            );
          }

          const origin = new URL(request.url).origin;
          const forwardHeaders = new Headers({
            'Content-Type': 'application/json',
            'X-Todoist-Token': todoistToken,
            'X-App-Origin': origin
          });

          const todoistRequest = new Request(`https://todoist-worker/messages/${id}/todoist`, {
            method: 'POST',
            headers: forwardHeaders,
            body: JSON.stringify(body || {})
          });

          const todoistResponse = await env.TODOIST_WORKER.fetch(todoistRequest);
          const responseBody = await todoistResponse.text();
          const contentType = todoistResponse.headers.get('Content-Type') || 'application/json';

          return new Response(responseBody, {
            status: clampStatus(todoistResponse.status),
            headers: { 'Content-Type': contentType }
          });
        }

        // Unsubscribe from newsletter
        if (parts.length === 3 && parts[2] === 'unsubscribe' && request.method === 'POST') {
          const msg = await DB.getMessage(env.DB, id);
          if (!msg) return new Response('Message Not Found', { status: 404 });
          if (!msg.headers_json) {
            return jsonResponse({ error: 'No headers available for unsubscribe.' }, { status: 400 });
          }

          let headers = {};
          try {
            headers = JSON.parse(msg.headers_json) || {};
          } catch {
            return jsonResponse({ error: 'Failed to parse message headers.' }, { status: 400 });
          }

          const listUnsubscribe = headers['list-unsubscribe'] || headers['List-Unsubscribe'];
          const listUnsubscribePost = headers['list-unsubscribe-post'] || headers['List-Unsubscribe-Post'] || '';
          const candidates = parseListUnsubscribeUrls(listUnsubscribe);

          const httpTarget = candidates.find((u) => /^https?:\/\//i.test(u));
          if (!httpTarget) {
            return jsonResponse({ error: 'No HTTP unsubscribe URL available for this message.' }, { status: 400 });
          }

          const oneClick = /list-unsubscribe\s*=\s*one-click/i.test(listUnsubscribePost);
          const method = oneClick ? 'POST' : 'GET';
          const headersOut = new Headers({
            'User-Agent': 'email-viewer-unsubscribe/1.0'
          });
          let body;
          if (oneClick) {
            headersOut.set('Content-Type', 'application/x-www-form-urlencoded');
            body = 'List-Unsubscribe=One-Click';
          }

          const response = await fetch(httpTarget, {
            method,
            headers: headersOut,
            body,
            redirect: 'follow'
          });

          if (!response.ok) {
            return jsonResponse({
              error: `Unsubscribe endpoint returned ${response.status}.`,
              method,
              target: httpTarget,
              status: response.status
            }, { status: 502 });
          }

          return jsonResponse({
            ok: true,
            unsubscribed: true,
            method,
            target: httpTarget,
            status: response.status
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

          // Sanitize filename for Content-Disposition header to prevent header injection
          const safeFilename = (att.filename || 'attachment')
            .replace(/["\\\r\n]/g, '_')  // Remove dangerous characters
            .replace(/[^\x20-\x7E]/g, '_');  // ASCII printable only for compatibility
          
          return new Response(object.body, {
            headers: {
              'Content-Type': att.content_type || 'application/octet-stream',
              'Content-Disposition': `attachment; filename="${safeFilename}"`,
              'Cache-Control': 'public, max-age=31536000, immutable'
            }
          });
        }

        // GET /api/messages/:id/raw - Download raw .eml file
        if (parts.length === 3 && parts[2] === 'raw' && request.method === 'GET') {
          const msg = await DB.getMessage(env.DB, id);
          if (!msg) return new Response('Message Not Found', { status: 404 });

          if (!msg.raw_r2_key) return new Response('Raw email not available', { status: 404 });

          const object = await env.MAILSTORE.get(msg.raw_r2_key);
          if (!object) return new Response('File Not Found', { status: 404 });

          const safeSubject = (msg.subject || 'email')
            .replace(/["\\\r\n]/g, '_')
            .replace(/[^\x20-\x7E]/g, '_')
            .slice(0, 60);

          return new Response(object.body, {
            headers: {
              'Content-Type': 'message/rfc822',
              'Content-Disposition': `attachment; filename="${safeSubject}.eml"`,
              'Cache-Control': 'private, max-age=3600'
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

      // ==================
      // Tagging Rules API
      // ==================

      // GET /api/tagging-rules
      if (path === 'tagging-rules' && request.method === 'GET') {
        const rules = await DB.getTaggingRules(env.DB);
        return jsonResponse(rules);
      }

      // POST /api/tagging-rules
      if (path === 'tagging-rules' && request.method === 'POST') {
        let body;
        try {
          body = await readJsonBody(request);
        } catch (error) {
          return jsonResponse({ error: error.message || 'Invalid JSON body' }, { status: 400 });
        }

        const { name, matchFrom, matchTo, matchSubject, matchBody, tagName, priority, isEnabled } = body;

        if (!name) {
          return jsonResponse({ error: 'Rule name is required' }, { status: 400 });
        }
        if (!isValidRuleName(name)) {
          return jsonResponse({ error: 'Invalid rule name. Use alphanumeric characters, spaces, hyphens, underscores, or slashes. Max 100 characters.' }, { status: 400 });
        }
        if (!tagName) {
          return jsonResponse({ error: 'Tag name is required' }, { status: 400 });
        }
        if (!isValidTagName(tagName)) {
          return jsonResponse({ error: 'Invalid tag name format' }, { status: 400 });
        }
        if (!isValidMatchValue(matchFrom) || !isValidMatchValue(matchTo) || !isValidMatchValue(matchSubject) || !isValidMatchValue(matchBody)) {
          return jsonResponse({ error: 'Match conditions must be 1000 characters or less' }, { status: 400 });
        }
        if (!matchFrom && !matchTo && !matchSubject && !matchBody) {
          return jsonResponse({ error: 'At least one match condition is required' }, { status: 400 });
        }
        if (!isValidPriority(priority ?? 0)) {
          return jsonResponse({ error: 'Priority must be an integer between 0 and 100' }, { status: 400 });
        }

        const tags = await DB.getTags(env.DB);
        const tagExists = tags.some(t => (t.name || '').toLowerCase() === String(tagName).toLowerCase());
        if (!tagExists) {
          return jsonResponse({ error: 'Tag does not exist. Create the tag first.' }, { status: 400 });
        }

        const rule = await DB.createTaggingRule(env.DB, {
          name,
          matchFrom,
          matchTo,
          matchSubject,
          matchBody,
          tagName,
          priority: priority ?? 0,
          isEnabled: isEnabled !== false
        });

        return jsonResponse(rule, { status: 201 });
      }

      // PUT /api/tagging-rules/:id
      if (path.startsWith('tagging-rules/') && request.method === 'PUT') {
        const id = path.split('/')[1];

        if (!isValidUUID(id)) {
          return jsonResponse({ error: 'Invalid rule ID format' }, { status: 400 });
        }

        let body;
        try {
          body = await readJsonBody(request);
        } catch (error) {
          return jsonResponse({ error: error.message || 'Invalid JSON body' }, { status: 400 });
        }

        const existing = await DB.getTaggingRule(env.DB, id);
        if (!existing) {
          return jsonResponse({ error: 'Tagging rule not found' }, { status: 404 });
        }

        const { name, matchFrom, matchTo, matchSubject, matchBody, tagName, priority, isEnabled } = body;

        const newName = name !== undefined ? name : existing.name;
        const newTagName = tagName !== undefined ? tagName : existing.tag_name;
        const newMatchFrom = matchFrom !== undefined ? matchFrom : existing.match_from;
        const newMatchTo = matchTo !== undefined ? matchTo : existing.match_to;
        const newMatchSubject = matchSubject !== undefined ? matchSubject : existing.match_subject;
        const newMatchBody = matchBody !== undefined ? matchBody : existing.match_body;

        if (newName && !isValidRuleName(newName)) {
          return jsonResponse({ error: 'Invalid rule name. Use alphanumeric characters, spaces, hyphens, underscores, or slashes. Max 100 characters.' }, { status: 400 });
        }
        if (newTagName && !isValidTagName(newTagName)) {
          return jsonResponse({ error: 'Invalid tag name format' }, { status: 400 });
        }
        if (!isValidMatchValue(newMatchFrom) || !isValidMatchValue(newMatchTo) || !isValidMatchValue(newMatchSubject) || !isValidMatchValue(newMatchBody)) {
          return jsonResponse({ error: 'Match conditions must be 1000 characters or less' }, { status: 400 });
        }
        if (!newMatchFrom && !newMatchTo && !newMatchSubject && !newMatchBody) {
          return jsonResponse({ error: 'At least one match condition is required' }, { status: 400 });
        }
        if (priority !== undefined && !isValidPriority(priority)) {
          return jsonResponse({ error: 'Priority must be an integer between 0 and 100' }, { status: 400 });
        }

        if (newTagName) {
          const tags = await DB.getTags(env.DB);
          const tagExists = tags.some(t => (t.name || '').toLowerCase() === String(newTagName).toLowerCase());
          if (!tagExists) {
            return jsonResponse({ error: 'Tag does not exist. Create the tag first.' }, { status: 400 });
          }
        }

        await DB.updateTaggingRule(env.DB, id, {
          name,
          matchFrom,
          matchTo,
          matchSubject,
          matchBody,
          tagName,
          priority,
          isEnabled
        });

        return jsonResponse({ ok: true });
      }

      // DELETE /api/tagging-rules/:id
      if (path.startsWith('tagging-rules/') && request.method === 'DELETE') {
        const id = path.split('/')[1];

        if (!isValidUUID(id)) {
          return jsonResponse({ error: 'Invalid rule ID format' }, { status: 400 });
        }

        const existing = await DB.getTaggingRule(env.DB, id);
        if (!existing) {
          return jsonResponse({ error: 'Tagging rule not found' }, { status: 404 });
        }

        await DB.deleteTaggingRule(env.DB, id);
        return jsonResponse({ ok: true });
      }

      // ==================
      // Auto Response Rules API
      // ==================

      // GET /api/auto-response-rules
      if (path === 'auto-response-rules' && request.method === 'GET') {
        const rules = await DB.getAutoResponseRules(env.DB);
        return jsonResponse(rules);
      }

      // POST /api/auto-response-rules
      if (path === 'auto-response-rules' && request.method === 'POST') {
        let body;
        try {
          body = await readJsonBody(request);
        } catch (error) {
          return jsonResponse({ error: error.message || 'Invalid JSON body' }, { status: 400 });
        }

        const { name, matchTag, matchText, replySubject, replyBody, isEnabled } = body;

        if (!name) return jsonResponse({ error: 'Rule name is required' }, { status: 400 });
        if (!isValidRuleName(name)) {
          return jsonResponse({ error: 'Invalid rule name. Use alphanumeric characters, spaces, hyphens, underscores, or slashes. Max 100 characters.' }, { status: 400 });
        }
        if (!replyBody || typeof replyBody !== 'string' || replyBody.trim().length === 0) {
          return jsonResponse({ error: 'Reply body is required' }, { status: 400 });
        }
        if (replyBody.length > 10000) {
          return jsonResponse({ error: 'Reply body must be 10000 characters or less' }, { status: 400 });
        }
        if (matchTag && !isValidTagName(matchTag)) {
          return jsonResponse({ error: 'Invalid match tag format' }, { status: 400 });
        }
        if (!isValidMatchValue(matchText)) {
          return jsonResponse({ error: 'Match text must be 1000 characters or less' }, { status: 400 });
        }
        if (replySubject !== undefined && replySubject !== null && replySubject !== '' &&
            (typeof replySubject !== 'string' || replySubject.length > 500)) {
          return jsonResponse({ error: 'Reply subject must be 500 characters or less' }, { status: 400 });
        }
        if (!matchTag && !matchText) {
          return jsonResponse({ error: 'At least one match condition (match tag or match text) is required' }, { status: 400 });
        }

        const rule = await DB.createAutoResponseRule(env.DB, {
          name,
          matchTag,
          matchText,
          replySubject,
          replyBody,
          isEnabled: isEnabled !== false
        });

        return jsonResponse(rule, { status: 201 });
      }

      // PUT /api/auto-response-rules/:id
      if (path.startsWith('auto-response-rules/') && request.method === 'PUT') {
        const id = path.split('/')[1];
        if (!isValidUUID(id)) {
          return jsonResponse({ error: 'Invalid rule ID format' }, { status: 400 });
        }

        let body;
        try {
          body = await readJsonBody(request);
        } catch (error) {
          return jsonResponse({ error: error.message || 'Invalid JSON body' }, { status: 400 });
        }

        const existing = await DB.getAutoResponseRule(env.DB, id);
        if (!existing) {
          return jsonResponse({ error: 'Auto-response rule not found' }, { status: 404 });
        }

        const { name, matchTag, matchText, replySubject, replyBody, isEnabled } = body;

        const newName = name !== undefined ? name : existing.name;
        const newMatchTag = matchTag !== undefined ? matchTag : existing.match_tag;
        const newMatchText = matchText !== undefined ? matchText : existing.match_text;
        const newReplyBody = replyBody !== undefined ? replyBody : existing.reply_body;

        if (newName && !isValidRuleName(newName)) {
          return jsonResponse({ error: 'Invalid rule name. Use alphanumeric characters, spaces, hyphens, underscores, or slashes. Max 100 characters.' }, { status: 400 });
        }
        if (!newReplyBody || typeof newReplyBody !== 'string' || newReplyBody.trim().length === 0) {
          return jsonResponse({ error: 'Reply body is required' }, { status: 400 });
        }
        if (newReplyBody.length > 10000) {
          return jsonResponse({ error: 'Reply body must be 10000 characters or less' }, { status: 400 });
        }
        if (newMatchTag && !isValidTagName(newMatchTag)) {
          return jsonResponse({ error: 'Invalid match tag format' }, { status: 400 });
        }
        if (!isValidMatchValue(newMatchText)) {
          return jsonResponse({ error: 'Match text must be 1000 characters or less' }, { status: 400 });
        }
        if (replySubject !== undefined && replySubject !== null && replySubject !== '' &&
            (typeof replySubject !== 'string' || replySubject.length > 500)) {
          return jsonResponse({ error: 'Reply subject must be 500 characters or less' }, { status: 400 });
        }
        if (!newMatchTag && !newMatchText) {
          return jsonResponse({ error: 'At least one match condition (match tag or match text) is required' }, { status: 400 });
        }

        await DB.updateAutoResponseRule(env.DB, id, {
          name,
          matchTag,
          matchText,
          replySubject,
          replyBody,
          isEnabled
        });

        return jsonResponse({ ok: true });
      }

      // DELETE /api/auto-response-rules/:id
      if (path.startsWith('auto-response-rules/') && request.method === 'DELETE') {
        const id = path.split('/')[1];
        if (!isValidUUID(id)) {
          return jsonResponse({ error: 'Invalid rule ID format' }, { status: 400 });
        }
        const existing = await DB.getAutoResponseRule(env.DB, id);
        if (!existing) {
          return jsonResponse({ error: 'Auto-response rule not found' }, { status: 404 });
        }
        await DB.deleteAutoResponseRule(env.DB, id);
        return jsonResponse({ ok: true });
      }

      // GET /api/notifications/status - check ntfy notification configuration
      if (path === 'notifications/status' && request.method === 'GET') {
        const topic = (env.NTFY_TOPIC || '').trim();
        const configured = Boolean(topic);

        const status = {
          configured,
          provider: configured ? 'ntfy' : null,
          notifySpam: (env.NOTIFY_SPAM || 'false').toLowerCase() === 'true',
          appUrl: env.NOTIFY_APP_URL || env.APP_URL || null,
          details: {
            topic: topic ? '***configured***' : null,
            server: env.NTFY_SERVER || 'https://ntfy.sh',
            hasToken: Boolean(env.NTFY_TOKEN),
          },
        };

        return jsonResponse(status);
      }

      // POST /api/notifications/test - send a test notification via ntfy
      if (path === 'notifications/test' && request.method === 'POST') {
        const topic = (env.NTFY_TOPIC || '').trim();
        if (!topic) {
          return jsonResponse(
            { error: 'No NTFY_TOPIC configured. Set it in your environment variables.' },
            { status: 400 }
          );
        }

        const testMessage = {
          id: 'test-notification',
          from_addr: 'test@example.com',
          to_addr: env.SEND_FROM_EMAIL || 'you@example.com',
          subject: 'Test Notification',
          snippet: 'This is a test notification from your email inbox app. If you see this on your phone, notifications are working!',
          received_at: Date.now(),
          has_attachments: false,
          tag: null,
        };

        const result = await sendNewEmailNotification(testMessage, env);
        if (result.ok) {
          return jsonResponse({ ok: true, provider: 'ntfy' });
        } else {
          return jsonResponse(
            { error: result.error, provider: 'ntfy' },
            { status: 502 }
          );
        }
      }

      // GET /api/health
      if (path === 'health') {
        return jsonResponse({ ok: true });
      }

      // GET /api/settings
      if (path === 'settings' && request.method === 'GET') {
        // Return public settings or specific settings
        // For now, just return retention policy
        const retentionDays = await DB.getSetting(env.DB, 'retention_days');
        return jsonResponse({
          retention_days: retentionDays ? parseInt(retentionDays, 10) : 0
        });
      }

      // PUT /api/settings
      if (path === 'settings' && request.method === 'PUT') {
        let body;
        try {
          body = await readJsonBody(request);
        } catch (error) {
          return jsonResponse({ error: error.message || 'Invalid JSON body' }, { status: 400 });
        }

        if (body.retention_days !== undefined) {
          const days = parseInt(body.retention_days, 10);
          if (isNaN(days) || days < 0) {
             return jsonResponse({ error: 'retention_days must be a non-negative integer' }, { status: 400 });
          }
          await DB.setSetting(env.DB, 'retention_days', days.toString());
        }

        return jsonResponse({ ok: true });
      }

      // GET /api/contacts
      // Returns unique email addresses from contacts table for compose autocomplete
      if (path === 'contacts' && request.method === 'GET') {
        const query = url.searchParams.get('q') || '';
        let limit = parseInt(url.searchParams.get('limit'), 10);
        if (isNaN(limit) || limit < 1) {
          limit = 10;
        } else if (limit > 50) {
          limit = 50;
        }

        const contacts = await DB.getContactSuggestions(env.DB, { query, limit });
        return jsonResponse({ contacts });
      }

      // POST /api/ai/compose
      if (path === 'ai/compose' && request.method === 'POST') {
        if (!env.OPENROUTER_API_KEY) {
          return jsonResponse({ error: 'AI compose is not configured' }, { status: 503 });
        }
        let body;
        try {
          body = await readJsonBody(request);
        } catch (error) {
          return jsonResponse({ error: error.message || 'Invalid JSON body' }, { status: 400 });
        }
        const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
        if (!prompt) {
          return jsonResponse({ error: 'Prompt is required' }, { status: 400 });
        }
        if (prompt.length > 1000) {
          return jsonResponse({ error: 'Prompt is too long (max 1000 characters)' }, { status: 400 });
        }
        const mode = body.mode === 'reply' ? 'reply' : 'compose';
        const context = body.context && typeof body.context === 'object' ? body.context : null;
        const senderName = typeof body.senderName === 'string' ? body.senderName.trim().slice(0, 120) : '';

        const result = await EmailComposer.compose({
          prompt,
          context,
          mode,
          senderName,
          apiKey: env.OPENROUTER_API_KEY,
          model: env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-lite-001'
        });

        if (!result) {
          return jsonResponse({ error: 'Failed to generate message' }, { status: 502 });
        }
        return jsonResponse(result);
      }

      // POST /api/send
      if (path === 'send' && request.method === 'POST') {
        const contentType = (request.headers.get('Content-Type') || '').toLowerCase();
        let rawTo;
        let emailSubject;
        let emailBody;
        let replyToId;
        const resendAttachments = [];

        if (contentType.includes('multipart/form-data')) {
          let formData;
          try {
            formData = await request.formData();
          } catch (error) {
            return jsonResponse({ error: error.message || 'Invalid multipart body' }, { status: 400 });
          }
          const toStr = formData.get('to');
          try {
            rawTo = toStr != null ? JSON.parse(toStr) : [];
          } catch (e) {
            rawTo = typeof toStr === 'string' ? toStr.split(',') : [];
          }
          emailSubject = formData.get('subject') ?? '';
          emailBody = formData.get('body') ?? '';
          const replyToIdVal = formData.get('replyToId');
          replyToId = replyToIdVal !== null && replyToIdVal !== undefined && String(replyToIdVal).trim() !== '' ? String(replyToIdVal).trim() : null;
          const files = formData.getAll('attachments').filter(Boolean);
          for (const file of files) {
            if (file && typeof file.arrayBuffer === 'function') {
              const buffer = await file.arrayBuffer();
              const content = arrayBufferToBase64(buffer);
              const filename = file.name || 'attachment';
              const contentTypeAtt = file.type || 'application/octet-stream';
              resendAttachments.push({ filename, content, content_type: contentTypeAtt });
            }
          }
        } else {
          let body;
          try {
            body = await readJsonBody(request);
          } catch (error) {
            return jsonResponse({ error: error.message || 'Invalid JSON body' }, { status: 400 });
          }
          rawTo = body.to;
          emailSubject = body.subject;
          emailBody = body.body;
          replyToId = body.replyToId ?? null;
        }

        const rawRecipients = Array.isArray(rawTo)
          ? rawTo
          : typeof rawTo === 'string'
            ? rawTo.split(',')
            : [];

        if (!rawRecipients || rawRecipients.length === 0) {
          return jsonResponse({ error: 'Recipient (to) is required' }, { status: 400 });
        }

        const recipients = [];
        const seenRecipients = new Set();
        for (const email of rawRecipients) {
          const normalized = String(email || '').trim();
          if (!normalized) continue;
          const key = normalized.toLowerCase();
          if (seenRecipients.has(key)) continue;
          seenRecipients.add(key);
          recipients.push(normalized);
        }

        if (recipients.length === 0) {
          return jsonResponse({ error: 'Recipient (to) is required' }, { status: 400 });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const invalidRecipients = recipients.filter(email => !emailRegex.test(email));
        if (invalidRecipients.length > 0) {
          const label = invalidRecipients.length === 1 ? 'Invalid email address' : 'Invalid email addresses';
          return jsonResponse({ error: `${label}: ${invalidRecipients.join(', ')}` }, { status: 400 });
        }

        // Check if email sending is configured
        const isConfigured = env.RESEND_API_KEY ||
                           env.MAILCHANNELS === 'true' ||
                           env.AWS_SES_ACCESS_KEY_ID ||
                           env.SENDGRID_API_KEY ||
                           env.MAILGUN_API_KEY;

        if (!isConfigured) {
          return jsonResponse({
            error: 'Email sending is not configured. Please set up an email provider (RESEND_API_KEY, MAILCHANNELS, or AWS_SES_ACCESS_KEY_ID) in your environment.'
          }, { status: 501 });
        }

        try {
          const fromEmail = env.SEND_FROM_EMAIL || 'hello@infinitywave.design';
          const subjectLine = emailSubject || '(No Subject)';
          const emailText = emailBody || '';
          const toHeader = recipients.join(', ');

          // Handle Threading/Replying
          let inReplyTo = null;
          let references = null;
          if (replyToId) {
            const originalMsg = await DB.getMessage(env.DB, replyToId);
            if (originalMsg && originalMsg.headers_json) {
              try {
                const headers = JSON.parse(originalMsg.headers_json);
                inReplyTo = headers['message-id'] || null;
                const originalRefs = headers['references'] || '';
                references = originalRefs ? `${originalRefs} ${inReplyTo}` : inReplyTo;
              } catch (e) {
                console.error('Failed to parse original headers', e);
              }
            }
          }

          let resultId = null;

          // 1. MailChannels (Native to Cloudflare Workers)
          if (env.MAILCHANNELS === 'true') {
            const mcPayload = {
              personalizations: [{ to: recipients.map(email => ({ email })) }],
              from: { email: fromEmail },
              subject: subjectLine,
              content: [{ type: 'text/plain', value: emailText }]
            };

            if (inReplyTo) {
              mcPayload.headers = {
                'In-Reply-To': inReplyTo,
                'References': references
              };
            }

            const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(mcPayload)
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`MailChannels error: ${errorText}`);
            }
            resultId = `mc-${crypto.randomUUID()}`;
          }
          // 2. Resend
          else if (env.RESEND_API_KEY) {
            const resendPayload = {
              from: fromEmail,
              to: recipients,
              subject: subjectLine,
              text: emailText
            };

            if (inReplyTo) {
              resendPayload.headers = {
                'In-Reply-To': inReplyTo,
                'References': references
              };
            }
            if (resendAttachments.length > 0) {
              resendPayload.attachments = resendAttachments.map(({ filename, content, content_type }) =>
                content_type ? { filename, content, content_type } : { filename, content }
              );
            }

            const response = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(resendPayload)
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.message || 'Failed to send email via Resend');
            }

            const data = await response.json();
            resultId = data.id;
          }
          // 3. AWS SES (Placeholder for API call)
          else if (env.AWS_SES_ACCESS_KEY_ID) {
             // Note: Full AWS SigV4 implementation omitted for brevity,
             // but this is where the SES Fetch call would go.
             // See: https://docs.aws.amazon.com/ses/latest/APIReference/API_SendEmail.html
             throw new Error('AWS SES integration is configured but SigV4 signing is not yet implemented.');
          }
          else {
            throw new Error('No email provider configured correctly');
          }

          // Save sent email to database with 'Sent' tag
          const messageId = crypto.randomUUID();
          const now = Date.now();
          const snippet = emailText.substring(0, 150).replace(/\n/g, ' ');
          const rawR2Key = `raw/${messageId}.eml`;
          const rawEmail = [
            `Message-ID: <${resultId}>`,
            `From: ${fromEmail}`,
            `To: ${toHeader}`,
            `Subject: ${subjectLine}`,
            `Date: ${new Date(now).toUTCString()}`,
            ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
            ...(references ? [`References: ${references}`] : []),
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            '',
            emailText
          ].join('\r\n');

          if (env.MAILSTORE?.put) {
            await env.MAILSTORE.put(rawR2Key, rawEmail, {
              httpMetadata: { contentType: 'message/rfc822' }
            });
          }

          await DB.insertMessage(env.DB, {
            id: messageId,
            received_at: now,
            from_addr: fromEmail,
            to_addr: toHeader,
            subject: subjectLine,
            date_header: new Date(now).toISOString(),
            snippet: snippet,
            has_attachments: resendAttachments.length > 0,
            raw_r2_key: rawR2Key,
            text_body: emailText,
            html_body: null,
            headers_json: JSON.stringify({
              'Message-ID': resultId,
              'From': fromEmail,
              'To': toHeader,
              'Subject': subjectLine,
              'Date': new Date(now).toISOString(),
              'In-Reply-To': inReplyTo,
              'References': references
            })
          });

          // Tag with 'Sent'
          await DB.addMessageTag(env.DB, messageId, 'Sent');

          // Track recipients for compose autocomplete
          await DB.upsertContacts(env.DB, recipients, { usedAt: now, direction: 'outbound' });

          return jsonResponse({ ok: true, messageId: resultId });
        } catch (error) {
          console.error('Email send error:', error);
          return jsonResponse({ error: error.message || 'Failed to send email' }, { status: 500 });
        }
      }

      // ==================
      // Calendar Events
      // ==================

      if (path === 'calendar/events' && request.method === 'GET') {
        const start = url.searchParams.get('start');
        const end = url.searchParams.get('end');
        if (!start || !end) {
          return jsonResponse({ error: 'start and end query params required' }, { status: 400 });
        }
        const events = await DB.listCalendarEvents(env.DB, Number(start), Number(end));
        return jsonResponse({ events });
      }

      if (path === 'calendar/events' && request.method === 'POST') {
        const body = await readJsonBody(request);
        if (!body.title || typeof body.title !== 'string' || body.title.length === 0) {
          return jsonResponse({ error: 'title is required' }, { status: 400 });
        }
        if (!body.startTime || !body.endTime) {
          return jsonResponse({ error: 'startTime and endTime are required' }, { status: 400 });
        }
        if (Number(body.endTime) <= Number(body.startTime)) {
          return jsonResponse({ error: 'endTime must be after startTime' }, { status: 400 });
        }
        const event = await DB.createCalendarEvent(env.DB, {
          title: body.title.substring(0, 500),
          description: body.description ? String(body.description).substring(0, 5000) : null,
          startTime: Number(body.startTime),
          endTime: Number(body.endTime),
          allDay: Boolean(body.allDay),
          color: body.color ? String(body.color).substring(0, 20) : null
        });
        return jsonResponse(event, { status: 201 });
      }

      // calendar/events/:id
      const calendarMatch = path.match(/^calendar\/events\/([^/]+)$/);
      if (calendarMatch) {
        const eventId = calendarMatch[1];
        if (!isValidUUID(eventId)) {
          return jsonResponse({ error: 'Invalid event ID' }, { status: 400 });
        }

        if (request.method === 'GET') {
          const event = await DB.getCalendarEvent(env.DB, eventId);
          if (!event) return jsonResponse({ error: 'Event not found' }, { status: 404 });
          return jsonResponse(event);
        }

        if (request.method === 'PUT') {
          const body = await readJsonBody(request);
          if (body.title !== undefined && (typeof body.title !== 'string' || body.title.length === 0)) {
            return jsonResponse({ error: 'title must be a non-empty string' }, { status: 400 });
          }
          if (body.startTime && body.endTime && Number(body.endTime) <= Number(body.startTime)) {
            return jsonResponse({ error: 'endTime must be after startTime' }, { status: 400 });
          }
          try {
            const updates = {};
            if (body.title !== undefined) updates.title = String(body.title).substring(0, 500);
            if (body.description !== undefined) updates.description = body.description ? String(body.description).substring(0, 5000) : null;
            if (body.startTime !== undefined) updates.startTime = Number(body.startTime);
            if (body.endTime !== undefined) updates.endTime = Number(body.endTime);
            if (body.allDay !== undefined) updates.allDay = Boolean(body.allDay);
            if (body.color !== undefined) updates.color = body.color ? String(body.color).substring(0, 20) : null;
            const result = await DB.updateCalendarEvent(env.DB, eventId, updates);
            return jsonResponse(result);
          } catch (e) {
            if (e.message === 'Calendar event not found') {
              return jsonResponse({ error: 'Event not found' }, { status: 404 });
            }
            throw e;
          }
        }

        if (request.method === 'DELETE') {
          await DB.deleteCalendarEvent(env.DB, eventId);
          return jsonResponse({ ok: true });
        }
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
