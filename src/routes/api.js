/**
 * REST API routes
 */

import { getMessages, getMessage, getAttachments, getAttachment } from '../db.js';
import { getAttachmentData } from '../r2.js';

/**
 * GET /api/messages - List messages with pagination and filtering
 */
export async function handleListMessages(request, env) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const before = url.searchParams.get('before') ? parseInt(url.searchParams.get('before'), 10) : null;
  const spamStatus = url.searchParams.get('spamStatus') || null;

  const messages = await getMessages(env.DB, { limit, before, spamStatus });

  const items = messages.map(msg => ({
    id: msg.id,
    receivedAt: msg.received_at,
    from: msg.from_addr,
    to: msg.to_addr,
    subject: msg.subject,
    snippet: msg.snippet,
    hasAttachments: msg.has_attachments === 1,
    spamStatus: msg.spam_status || 'unknown',
    spamConfidence: msg.spam_confidence
  }));

  const nextBefore = items.length > 0 ? items[items.length - 1].receivedAt : null;

  return new Response(JSON.stringify({ items, nextBefore }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * GET /api/messages/:id - Get message detail
 */
export async function handleGetMessage(request, env, messageId) {
  const message = await getMessage(env.DB, messageId);

  if (!message) {
    return new Response(JSON.stringify({ error: 'Message not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const attachments = await getAttachments(env.DB, messageId);

  const headers = message.headers_json ? JSON.parse(message.headers_json) : {};

  const response = {
    id: message.id,
    receivedAt: message.received_at,
    from: message.from_addr,
    to: message.to_addr,
    subject: message.subject,
    textBody: message.text_body,
    htmlBody: message.html_body,
    headers,
    spamStatus: message.spam_status || 'unknown',
    spamConfidence: message.spam_confidence,
    spamReason: message.spam_reason,
    attachments: attachments.map(att => ({
      id: att.id,
      filename: att.filename,
      contentType: att.content_type,
      sizeBytes: att.size_bytes
    }))
  };

  return new Response(JSON.stringify(response), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * GET /api/messages/:id/attachments/:attId - Download attachment
 */
export async function handleDownloadAttachment(request, env, messageId, attId) {
  const attachment = await getAttachment(env.DB, attId);

  if (!attachment || attachment.message_id !== messageId) {
    return new Response('Attachment not found', { status: 404 });
  }

  const r2Object = await getAttachmentData(env.MAILSTORE, attachment.r2_key);

  if (!r2Object) {
    return new Response('Attachment not found in storage', { status: 404 });
  }

  return new Response(r2Object.body, {
    headers: {
      'Content-Type': attachment.content_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${attachment.filename}"`,
      'Content-Length': r2Object.size.toString()
    }
  });
}
