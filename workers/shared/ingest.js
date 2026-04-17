/**
 * Shared Email Ingestion Pipeline
 * Used by both the email worker (Cloudflare Email Routing) and the API import endpoint.
 */
import { MimeParser } from './mime.js';
import { DB } from './db.js';
import { R2 } from './r2.js';

/**
 * Compute a SHA-256 dedupe key from parsed email fields.
 * @param {Object} parsed - Parsed email object from MimeParser
 * @returns {Promise<string>} hex-encoded SHA-256 hash
 */
export async function computeDedupeKey(parsed) {
    const messageIdHeader = parsed.messageId || parsed.allHeaders['message-id'] || '';
    const dedupeSource = messageIdHeader || [
        parsed.from || '',
        parsed.to || '',
        parsed.subject || '',
        parsed.date || '',
        parsed.snippet || ''
    ].join('|');

    const hashBuffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(dedupeSource)
    );
    return new Uint8Array(hashBuffer).reduce((a, b) => a + b.toString(16).padStart(2, '0'), '');
}

/**
 * Ingest a raw email buffer: parse, store, dedupe, and insert into DB.
 *
 * @param {ArrayBuffer} rawBuffer - Raw RFC 2822 email bytes
 * @param {Object} env - Worker environment bindings (DB, MAILSTORE)
 * @param {Object} [options]
 * @param {string} [options.messageId] - Pre-generated UUID (auto-generated if omitted)
 * @returns {Promise<{messageId: string, deduplicated: boolean, dbMessage: Object|null}>}
 */
export async function ingestRawEmail(rawBuffer, env, options = {}) {
    const messageId = options.messageId || crypto.randomUUID();

    // 1. Store raw email to R2 and parse MIME in parallel
    const [rawKey, parsed] = await Promise.all([
        R2.saveRawEmail(env.MAILSTORE, messageId, rawBuffer, rawBuffer.byteLength),
        MimeParser.parse(rawBuffer)
    ]);

    // 2. Dedupe check
    const dedupeKey = await computeDedupeKey(parsed);
    const isUnique = await DB.checkDedupe(env.DB, dedupeKey, messageId);
    if (!isUnique) {
        return { messageId, deduplicated: true, dbMessage: null };
    }

    // 3. Insert message metadata
    const msgIdHeader = parsed.allHeaders['message-id'] || parsed.messageId || null;
    const inReplyTo = parsed.allHeaders['in-reply-to'] || null;
    const parentThreadId = inReplyTo ? await DB.findThreadId(env.DB, inReplyTo) : null;

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
        headers_json: JSON.stringify(parsed.allHeaders),
        message_id_header: msgIdHeader,
        in_reply_to: inReplyTo,
        thread_id: parentThreadId || messageId
    };

    await DB.insertMessage(env.DB, dbMessage);

    // Track contacts for compose autocomplete
    await DB.upsertContacts(env.DB, parsed.from, { usedAt: dbMessage.received_at, direction: 'inbound' });
    await DB.upsertContacts(env.DB, parsed.to, { usedAt: dbMessage.received_at, direction: 'outbound' });

    // 4. Save attachments
    const attachmentInserts = await Promise.all(
        parsed.attachments.map(async (att) => {
            const attId = crypto.randomUUID();
            const filename = att.filename || `attachment-${attId}`;
            const attKey = await R2.saveAttachment(env.MAILSTORE, messageId, attId, filename, att.content);

            return {
                id: attId,
                message_id: messageId,
                filename,
                content_type: att.mimeType || att.contentType || null,
                size_bytes: att.content?.byteLength ?? 0,
                sha256: null,
                r2_key: attKey
            };
        })
    );
    await DB.insertAttachments(env.DB, attachmentInserts);

    // Enrich message object for downstream processing
    dbMessage.attachments = attachmentInserts;
    dbMessage.tags = [];
    dbMessage.tag = null;

    return { messageId, deduplicated: false, dbMessage };
}
