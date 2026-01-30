/**
 * API client
 */

import { getToken } from './auth.js';

const API_BASE = import.meta.env.PROD
  ? 'https://api.infinitywave.design/api'
  : '/api';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  const token = getToken();
  if (!token) console.warn('Making request without token');

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
    const message = await getErrorMessage(response);
    throw new ApiError(message, response.status);
  }

  if (response.headers.get('Content-Type')?.includes('application/json')) {
    return response.json();
  }

  return response;
}

async function getErrorMessage(response) {
  const fallback = 'Request failed';
  const contentType = response.headers.get('Content-Type') || '';

  try {
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return data?.message || data?.error || JSON.stringify(data) || fallback;
    }

    const text = await response.text();
    if (!text) {
      return fallback;
    }

    if (contentType.includes('text/html') || /<!doctype|<html/i.test(text)) {
      return 'Server returned an unexpected HTML error response.';
    }

    return text;
  } catch (error) {
    console.error('Failed to parse error response', error);
    return fallback;
  }
}

export async function getMessages(params = {}) {
  const queryParams = new URLSearchParams();

  if (params.limit) queryParams.set('limit', params.limit);
  if (params.before) queryParams.set('before', params.before);
  if (params.tag) queryParams.set('tag', params.tag);
  if (params.excludeTag) queryParams.set('excludeTag', params.excludeTag);
  if (params.archived !== undefined) queryParams.set('archived', params.archived);
  if (params.search) queryParams.set('search', params.search);

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

export async function updateMessageTag(id, tag) {
  return request(`/messages/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag })
  });
}

export async function addMessageTag(id, tag) {
  return request(`/messages/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addTag: tag })
  });
}

export async function removeMessageTag(id, tag) {
  return request(`/messages/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ removeTag: tag })
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
    tag: message.tag,
    tagConfidence: message.tag_confidence ?? message.tagConfidence,
    tagReason: message.tag_reason ?? message.tagReason,
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

export async function getTags() {
  return request('/tags');
}

export async function createTag(name) {
  return request('/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
}

export async function updateTag(id, name) {
  return request(`/tags/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
}

export async function deleteTag(id) {
  return request(`/tags/${id}`, {
    method: 'DELETE'
  });
}
