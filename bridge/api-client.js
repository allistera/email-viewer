/**
 * REST API client for the Inboxer Workers API.
 */
export class ApiClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async request(path, opts = {}) {
    const url = `${this.baseUrl}/api${path}`;
    const headers = {
      Authorization: `Bearer ${this.token}`,
      ...opts.headers,
    };
    const res = await fetch(url, { ...opts, headers });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${text}`);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return res;
  }

  /** Health check — also validates the token. */
  async health() {
    return this.request('/health');
  }

  /** List messages with optional filters. */
  async listMessages({ limit = 200, before, tag, excludeTag, archived, search } = {}) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (before) params.set('before', String(before));
    if (tag) params.set('tag', tag);
    if (excludeTag) params.set('excludeTag', excludeTag);
    if (archived !== undefined) params.set('archived', String(archived));
    if (search) params.set('q', search);
    const data = await this.request(`/messages?${params}`);
    return data.items || [];
  }

  /** Fetch all messages for a mailbox by paging through the API. */
  async listAllMessages(filters = {}) {
    const all = [];
    let before = null;
    for (;;) {
      const page = await this.listMessages({ ...filters, limit: 200, before });
      if (page.length === 0) break;
      all.push(...page);
      before = page[page.length - 1].received_at;
      if (page.length < 200) break;
    }
    return all;
  }

  /** Get full message detail. */
  async getMessage(id) {
    return this.request(`/messages/${id}`);
  }

  /** Get raw .eml bytes (returns a Response). */
  async getMessageRaw(id) {
    const url = `${this.baseUrl}/api/messages/${id}/raw`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }

  /** Get tags list. */
  async getTags() {
    return this.request('/tags');
  }

  /** Get message counts. */
  async getCounts() {
    return this.request('/messages/counts');
  }

  /** Mark a message as read (GET /messages/:id triggers markRead). */
  async markRead(id) {
    return this.request(`/messages/${id}`);
  }

  /** Archive a message. */
  async archiveMessage(id) {
    return this.request(`/messages/${id}/archive`, { method: 'POST' });
  }

  /** Add a tag to a message. */
  async addTag(id, tagName) {
    return this.request(`/messages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addTag: tagName }),
    });
  }

  /** Remove a tag from a message. */
  async removeTag(id, tagName) {
    return this.request(`/messages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeTag: tagName }),
    });
  }

  /** Send an email. */
  async sendEmail({ to, subject, body }) {
    return this.request('/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, body }),
    });
  }
}
