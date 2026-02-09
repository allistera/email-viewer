/**
 * Push Notification Module
 * 
 * Supports multiple notification providers for sending iOS push notifications
 * when new emails arrive. Providers are configured via environment variables.
 * 
 * Supported providers:
 * - ntfy:      Free, open-source (https://ntfy.sh) — iOS app available
 * - pushover:  $5 one-time iOS app (https://pushover.net)
 * - bark:      Free, open-source iOS-only (https://github.com/nicegram/Bark)
 * - webhook:   Generic HTTP POST to any URL (e.g. for Home Assistant, IFTTT, Make, etc.)
 */

/**
 * Send a push notification for a new email via the configured provider.
 * Silently returns if no provider is configured (notifications are optional).
 * 
 * @param {Object} message - Email message object from D1
 * @param {Object} env - Worker environment bindings
 * @returns {Promise<{ok: boolean, provider?: string, error?: string}>}
 */
export async function sendNewEmailNotification(message, env) {
  const provider = (env.NOTIFY_PROVIDER || '').toLowerCase().trim();

  if (!provider) {
    return { ok: true, skipped: true, reason: 'No NOTIFY_PROVIDER configured' };
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
    switch (provider) {
      case 'ntfy':
        return await sendNtfy(title, body, url, env);
      case 'pushover':
        return await sendPushover(title, body, url, env);
      case 'bark':
        return await sendBark(title, body, url, env);
      case 'webhook':
        return await sendWebhook(title, body, url, message, env);
      default:
        return { ok: false, error: `Unknown NOTIFY_PROVIDER: ${provider}` };
    }
  } catch (err) {
    console.error(`Notification failed (${provider}):`, err.message || err);
    return { ok: false, provider, error: err.message || 'Unknown error' };
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
// Env vars:
//   NOTIFY_PROVIDER = "ntfy"
//   NTFY_TOPIC      = "my-email-inbox"        (required)
//   NTFY_SERVER     = "https://ntfy.sh"       (optional, defaults to ntfy.sh)
//   NTFY_TOKEN      = "tk_..."                (optional, for auth)

async function sendNtfy(title, body, url, env) {
  const topic = env.NTFY_TOPIC;
  if (!topic) {
    return { ok: false, provider: 'ntfy', error: 'NTFY_TOPIC not configured' };
  }

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

// ─── Pushover (https://pushover.net) ────────────────────────────────────────
// Env vars:
//   NOTIFY_PROVIDER    = "pushover"
//   PUSHOVER_TOKEN     = "app token"         (required — create app at pushover.net)
//   PUSHOVER_USER      = "user key"          (required)
//   PUSHOVER_DEVICE    = "iphone"            (optional — target specific device)
//   PUSHOVER_SOUND     = "incoming"          (optional — notification sound)

async function sendPushover(title, body, url, env) {
  const token = env.PUSHOVER_TOKEN;
  const user = env.PUSHOVER_USER;

  if (!token || !user) {
    return { ok: false, provider: 'pushover', error: 'PUSHOVER_TOKEN and PUSHOVER_USER are required' };
  }

  const payload = {
    token,
    user,
    title,
    message: body,
    priority: 0,               // normal priority (use 1 for high)
    sound: env.PUSHOVER_SOUND || 'incoming',
  };

  if (url) {
    payload.url = url;
    payload.url_title = 'Open Email';
  }

  if (env.PUSHOVER_DEVICE) {
    payload.device = env.PUSHOVER_DEVICE;
  }

  const response = await fetch('https://api.pushover.net/1/messages.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    return { ok: false, provider: 'pushover', error: errData.errors?.join(', ') || `HTTP ${response.status}` };
  }

  return { ok: true, provider: 'pushover' };
}

// ─── Bark (https://github.com/nicegram/Bark) ───────────────────────────────
// Env vars:
//   NOTIFY_PROVIDER = "bark"
//   BARK_SERVER     = "https://api.day.app"  (or self-hosted URL)
//   BARK_KEY        = "your-device-key"      (required — from Bark iOS app)
//   BARK_SOUND      = "mailsent"             (optional)

async function sendBark(title, body, url, env) {
  const key = env.BARK_KEY;
  if (!key) {
    return { ok: false, provider: 'bark', error: 'BARK_KEY not configured' };
  }

  const server = (env.BARK_SERVER || 'https://api.day.app').replace(/\/$/, '');

  const payload = {
    title,
    body,
    group: 'email',
    sound: env.BARK_SOUND || 'mailsent',
    level: 'timeSensitive',
  };

  if (url) {
    payload.url = url;
  }

  const response = await fetch(`${server}/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    return { ok: false, provider: 'bark', error: `HTTP ${response.status}: ${errText}` };
  }

  return { ok: true, provider: 'bark' };
}

// ─── Generic Webhook ────────────────────────────────────────────────────────
// Env vars:
//   NOTIFY_PROVIDER   = "webhook"
//   WEBHOOK_URL       = "https://example.com/webhook"  (required)
//   WEBHOOK_SECRET    = "optional-bearer-token"        (optional)

async function sendWebhook(title, body, url, message, env) {
  const webhookUrl = env.WEBHOOK_URL;
  if (!webhookUrl) {
    return { ok: false, provider: 'webhook', error: 'WEBHOOK_URL not configured' };
  }

  const payload = {
    event: 'email.received',
    title,
    body,
    url,
    message: {
      id: message.id,
      from: message.from_addr,
      to: message.to_addr,
      subject: message.subject,
      snippet: message.snippet,
      receivedAt: message.received_at,
      hasAttachments: Boolean(message.has_attachments),
    },
  };

  const headers = {
    'Content-Type': 'application/json',
  };

  if (env.WEBHOOK_SECRET) {
    headers['Authorization'] = `Bearer ${env.WEBHOOK_SECRET}`;
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    return { ok: false, provider: 'webhook', error: `HTTP ${response.status}: ${errText}` };
  }

  return { ok: true, provider: 'webhook' };
}
