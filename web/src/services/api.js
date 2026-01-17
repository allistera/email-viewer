/**
 * API client
 */

import { getToken } from './auth.js';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  const token = getToken();

  const headers = {
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new ApiError('Unauthorized', 401);
    }
    const error = await response.text();
    throw new ApiError(error || 'Request failed', response.status);
  }

  if (response.headers.get('Content-Type')?.includes('application/json')) {
    return response.json();
  }

  return response;
}

export async function getMessages(params = {}) {
  const queryParams = new URLSearchParams();

  if (params.limit) queryParams.set('limit', params.limit);
  if (params.before) queryParams.set('before', params.before);
  if (params.spamStatus) queryParams.set('spamStatus', params.spamStatus);

  const query = queryParams.toString();
  const path = query ? `/messages?${query}` : '/messages';

  const response = await request(path);
  const items = (response.items || []).map(normalizeMessage);

  return {
    ...response,
    items
  };
}

export async function getMessage(id) {
  const response = await request(`/messages/${id}`);
  return normalizeMessage(response);
}

export async function getAttachmentUrl(messageId, attachmentId) {
  const token = getToken();
  return `${API_BASE}/messages/${messageId}/attachments/${attachmentId}?token=${token}`;
}

export async function checkHealth() {
  const response = await fetch(`${API_BASE}/health`);
  return response.json();
}

export async function archiveMessage(id) {
  return request(`/messages/${id}/archive`, {
    method: 'POST'
  });
}

function normalizeMessage(message) {
  if (!message) return message;

  return {
    ...message,
    receivedAt: message.received_at ?? message.receivedAt,
    from: message.from_addr ?? message.from,
    to: message.to_addr ?? message.to,
    hasAttachments: message.has_attachments ?? message.hasAttachments,
    spamStatus: message.spam_status ?? message.spamStatus,
    spamConfidence: message.spam_confidence ?? message.spamConfidence,
    spamReason: message.spam_reason ?? message.spamReason,
    textBody: message.text_body ?? message.textBody,
    htmlBody: message.html_body ?? message.htmlBody,
    attachments: (message.attachments || []).map(normalizeAttachment)
  };
}

function normalizeAttachment(attachment) {
  if (!attachment) return attachment;

  return {
    ...attachment,
    sizeBytes: attachment.size_bytes ?? attachment.sizeBytes,
    contentType: attachment.content_type ?? attachment.contentType
  };
}
