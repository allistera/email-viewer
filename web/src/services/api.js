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

  return request(path);
}

export async function getMessage(id) {
  return request(`/messages/${id}`);
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
