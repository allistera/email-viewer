import { DB } from './db.js';

const EMAIL_PATTERN = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;

const extractEmail = (value) => {
  if (!value) return null;
  const match = String(value).match(EMAIL_PATTERN);
  return match ? match[1].toLowerCase() : null;
};

const isNoReply = (address) => {
  if (!address) return false;
  return /no[-_]?reply/i.test(address);
};

/**
 * Send an auto-reply via Resend.
 * @param {Object} args
 * @returns {Promise<{ok: boolean, id?: string, error?: string}>}
 */
async function sendReplyViaResend({ apiKey, fromEmail, toEmail, subject, body, inReplyTo, references }) {
  const payload = {
    from: fromEmail,
    to: [toEmail],
    subject,
    text: body
  };
  if (inReplyTo) {
    payload.headers = {
      'In-Reply-To': inReplyTo,
      'References': references || inReplyTo
    };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return { ok: false, error: errorData.message || `Resend error ${response.status}` };
  }
  const data = await response.json();
  return { ok: true, id: data.id };
}

/**
 * Evaluate auto-response rules and send replies for matches.
 * Skips spam, no-reply senders, and self-loops.
 *
 * @param {Object} message - DB message row, optionally with `tags` array
 * @param {Object} env
 */
export async function processAutoResponses(message, env) {
  if (!message) return;
  if (!env.RESEND_API_KEY) return;
  const fromEmail = env.SEND_FROM_EMAIL;
  if (!fromEmail) return;

  const senderAddr = extractEmail(message.from_addr);
  if (!senderAddr) return;
  if (isNoReply(message.from_addr)) return;

  // Loop guard: don't reply if the inbound was sent by ourselves (already extracted email)
  const fromSelf = extractEmail(fromEmail);
  if (fromSelf && senderAddr === fromSelf) return;

  // Skip spam
  const tags = Array.isArray(message.tags)
    ? message.tags.map((t) => String(t).toLowerCase())
    : (message.tag ? [String(message.tag).toLowerCase()] : []);
  if (tags.includes('spam')) return;

  const messageWithTags = { ...message, tags };
  let rules;
  try {
    rules = await DB.matchAutoResponseRules(env.DB, messageWithTags);
  } catch (e) {
    console.error('Auto-response: failed to load rules:', e.message || e);
    return;
  }
  if (!rules || rules.length === 0) return;

  // Threading headers from the original message
  let inReplyTo = null;
  let references = null;
  try {
    if (message.headers_json) {
      const headers = JSON.parse(message.headers_json);
      inReplyTo = headers['message-id'] || headers['Message-ID'] || null;
      const origRefs = headers['references'] || headers['References'] || '';
      references = origRefs ? `${origRefs} ${inReplyTo || ''}`.trim() : inReplyTo;
    }
  } catch {
    // ignore
  }

  for (const rule of rules) {
    const subject = rule.reply_subject && rule.reply_subject.trim().length > 0
      ? rule.reply_subject
      : `Re: ${message.subject || ''}`.trim();

    try {
      const result = await sendReplyViaResend({
        apiKey: env.RESEND_API_KEY,
        fromEmail,
        toEmail: senderAddr,
        subject,
        body: rule.reply_body,
        inReplyTo,
        references
      });
      if (!result.ok) {
        console.error(`Auto-response: send failed for rule ${rule.id}: ${result.error}`);
        continue;
      }
      console.log(`Auto-response sent for rule ${rule.name} to ${senderAddr} (id=${result.id})`);
    } catch (e) {
      console.error(`Auto-response: error sending for rule ${rule.id}:`, e.message || e);
    }
  }
}
