import { authenticate } from './auth.js';
import { MimeParser } from './mime.js';
import { DB } from './db.js';
import { R2 } from './r2.js';
import { SpamClassifier } from './openai.js';
import { ApiRouter } from './api.js';
import { StreamRouter } from './stream.js';
export { RealtimeHub } from './realtimeHub.js';

/**
 * Async Background Processor
 */
async function processMessage(messageId, env) {
  try {
    const id = env.REALTIME_HUB.idFromName('global');
    const hub = env.REALTIME_HUB.get(id);

    // 1. Get current message state
    const message = await DB.getMessage(env.DB, messageId);
    if (!message) return;

    // 2. Broadcast received event
    await hub.fetch('http://do/broadcast', {
      method: 'POST',
      body: JSON.stringify({
        type: 'message.received',
        messageId: message.id,
        receivedAt: message.received_at
      })
    });

    // 3. Spam Check
    if (!message.spam_checked_at) {
      const classification = await SpamClassifier.classify(message, env.OPENAI_API_KEY, env.OPENAI_MODEL);

      if (classification) {
        await DB.updateSpamInfo(env.DB, messageId, classification);

        // 4. Broadcast classified event
        await hub.fetch('http://do/broadcast', {
          method: 'POST',
          body: JSON.stringify({
            type: 'message.classified',
            messageId: message.id,
            spamStatus: classification.is_spam ? 'spam' : 'ham',
            spamConfidence: classification.confidence
          })
        });
      }
    }
  } catch (e) {
    console.error(`Post-processing failed for ${messageId}:`, e);
  }
}

export default {
  /**
   * HTTP Handler (API + Realtime Proxy)
   */
  async fetch(request, env, _ctx) {
    const url = new URL(request.url);

    // 1. Static Assets (Public)
    // Serve / or specific files via ASSETS binding
    if (url.pathname === '/' || url.pathname.startsWith('/index.html') || url.pathname.startsWith('/style.css') || url.pathname.startsWith('/app.js') || url.pathname.startsWith('/favicon.ico')) {
      return env.ASSETS.fetch(request);
    }

    // 2. Auth Check (API & Stream)
    const authError = await authenticate(request, env);
    if (authError) return authError;

    // 3. Route Handling
    const urlString = request.url;

    // Try Stream Router (SSE/WS)
    const streamResponse = await StreamRouter.handle(urlString, request, env);
    if (streamResponse) return streamResponse;

    // Try API Router
    return ApiRouter.handle(urlString, request, env);
  },

  /**
   * Email Handler (Ingest)
   */
  async email(message, env, ctx) {
    try {
      const messageId = crypto.randomUUID();

      // 1. Read Raw Stream
      const rawStream = message.raw; // ReadableStream
      // We need to read it once for R2 and once for parsing (or parse in parallel)
      // TEE is safely supported in workers
      const [r2Stream, parseStream] = rawStream.tee();

      // 2. Write to R2 (Async) and Parse (Async)
      const r2Promise = R2.saveRawEmail(env.MAILSTORE, messageId, r2Stream);
      const parsePromise = MimeParser.parse(parseStream);

      const [rawKey, parsed] = await Promise.all([r2Promise, parsePromise]);

      // 3. Dedupe Check based on Message-ID + To (or derived ID)
      const dedupeKey = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode((parsed.allHeaders['message-id'] || '') + '|' + (parsed.to || ''))
      ).then(buf => new Uint8Array(buf).reduce((a, b) => a + b.toString(16).padStart(2, '0'), ''));

      const isUnique = await DB.checkDedupe(env.DB, dedupeKey, messageId);
      if (!isUnique) {
        console.log(`Duplicate message skipped: ${parsed.allHeaders['message-id']}`);
        return;
      }

      // 4. Insert Message Metadata
      const dbMessage = {
        id: messageId,
        received_at: Date.now(),
        from_addr: parsed.from,
        to_addr: parsed.to,
        subject: parsed.subject,
        date_header: parsed.date,
        snippet: parsed.snippet,
        has_attachments: parsed.attachments.length > 0,
        raw_r2_key: rawKey,
        text_body: parsed.textBody,
        html_body: parsed.htmlBody,
        headers_json: JSON.stringify(parsed.allHeaders)
      };

      await DB.insertMessage(env.DB, dbMessage);

      // 5. Save Attachments
      const attachmentInserts = [];
      for (const att of parsed.attachments) {
        const attId = crypto.randomUUID();
        const attKey = await R2.saveAttachment(env.MAILSTORE, messageId, attId, att.filename, att.content);

        attachmentInserts.push({
          id: attId,
          message_id: messageId,
          filename: att.filename,
          content_type: att.mimeType,
          size_bytes: att.content.byteLength,
          sha256: null, // skipped for now
          r2_key: attKey
        });
      }
      await DB.insertAttachments(env.DB, attachmentInserts);

      // 6. Trigger Post-Processing (Background)
      ctx.waitUntil(processMessage(messageId, env));

    } catch (e) {
      console.error('Email Ingest Failed', e);
      // In production, we should try to save the raw email to a 'failed' bucket path if possible
      message.setReject('Internal Error');
    }
  }
};
