/**
 * Push Notification Module (ntfy)
 * 
 * Sends iOS push notifications via ntfy (https://ntfy.sh) when new emails arrive.
 * ntfy is free, open-source, and has an iOS app on the App Store.
 * 
 * Env vars:
 *   NTFY_TOPIC   = "my-email-inbox"        (required)
 *   NTFY_SERVER  = "https://ntfy.sh"       (optional, defaults to ntfy.sh)
 *   NTFY_TOKEN   = "tk_..."                (optional, for authenticated topics)
 *   NOTIFY_SPAM  = "false"                 (optional, skip spam by default)
 *   NOTIFY_APP_URL = "https://..."         (optional, deep-link URL in notification)
 */

/**
 * Send a push notification for a new email via ntfy.
 * Silently returns if NTFY_TOPIC is not configured (notifications are optional).
 * 
 * @param {Object} message - Email message object from D1
 * @param {Object} env - Worker environment bindings
 * @returns {Promise<{ok: boolean, provider?: string, error?: string}>}
 */
export async function sendNewEmailNotification(message, env) {
  const topic = (env.NTFY_TOPIC || '').trim();

  if (!topic) {
    return { ok: true, skipped: true, reason: 'No NTFY_TOPIC configured' };
  }

  // Skip spam notifications unless explicitly opted in
  const notifySpam = (env.NOTIFY_SPAM || 'false').toLowerCase() === 'true';
  if (!notifySpam && message.tag && message.tag.toLowerCase() === 'spam') {
    return { ok: true, skipped: true, reason: 'Spam notification skipped' };
  }

  const title = formatTitle(message);
  const body = formatBody(message);
  const url = formatUrl(message, env);

  try {
    return await sendNtfy(title, body, url, env, topic);
  } catch (err) {
    console.error('Notification failed (ntfy):', err.message || err);
    return { ok: false, provider: 'ntfy', error: err.message || 'Unknown error' };
  }
}

// ─── Formatters ─────────────────────────────────────────────────────────────

function formatTitle(message) {
  const from = (message.from_addr || 'Unknown sender').replace(/<[^>]+>/g, '').trim();
  return `New email from ${from}`;
}

function formatBody(message) {
  const subject = message.subject || '(No Subject)';
  const snippet = message.snippet ? `\n${message.snippet.substring(0, 200)}` : '';
  return `${subject}${snippet}`;
}

function formatUrl(message, env) {
  const baseUrl = env.NOTIFY_APP_URL || env.APP_URL || '';
  if (!baseUrl) return undefined;
  return `${baseUrl.replace(/\/$/, '')}/#/messages/${message.id}`;
}

// ─── ntfy (https://ntfy.sh) ────────────────────────────────────────────────

async function sendNtfy(title, body, url, env, topic) {
  const server = (env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/$/, '');
  const endpoint = `${server}/${encodeURIComponent(topic)}`;

  const headers = {
    'Title': title,
    'Priority': '4',           // high priority for email
    'Tags': 'envelope',        // shows envelope emoji on iOS
  };

  if (url) {
    headers['Click'] = url;
    headers['Actions'] = `view, Open Email, ${url}`;
  }

  if (env.NTFY_TOKEN) {
    headers['Authorization'] = `Bearer ${env.NTFY_TOKEN}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    return { ok: false, provider: 'ntfy', error: `HTTP ${response.status}: ${errText}` };
  }

  return { ok: true, provider: 'ntfy' };
}
