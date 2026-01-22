import * as Sentry from "@sentry/cloudflare";
import { MimeParser } from './mime.js';
import { DB } from './db.js';
import { R2 } from './r2.js';
import { MessageClassifier } from './openai.js';

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

        const tagLabels = new Set(
            (env.TAG_LABELS || '')
                .split(',')
                .map(tag => tag.trim())
                .filter(Boolean)
        );
        tagLabels.add('spam');

        const shouldClassifyTag = !message.tag_checked_at;

        // 3. Unified Classification (tag, including spam)
        if (shouldClassifyTag) {
            const result = await MessageClassifier.classify(
                message,
                Array.from(tagLabels),
                env.OPENAI_API_KEY,
                env.OPENAI_MODEL
            );

            if (result?.tag && shouldClassifyTag) {
                await DB.updateTagInfo(env.DB, messageId, result.tag);

                if (result.tag.tag) {
                    await hub.fetch('http://do/broadcast', {
                        method: 'POST',
                        body: JSON.stringify({
                            type: 'message.tagged',
                            messageId: message.id,
                            tag: result.tag.tag,
                            tagConfidence: result.tag.confidence
                        })
                    });
                }
            }
        }
    } catch (e) {
        console.error(`Post-processing failed for ${messageId}:`, e);
    }
}

const sentryOptions = (env) => ({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: 1.0,
    enableLogs: true,
    sendDefaultPii: true,
});

export default Sentry.withSentry(sentryOptions, {
    /**
     * Email Handler (Ingest)
     */
    async email(message, env, ctx) {
        try {
            const messageId = crypto.randomUUID();

            // 1. Read Raw Content into Memory
            // We read into an ArrayBuffer to avoid stream length issues with R2 after tee()
            const rawBuffer = await new Response(message.raw).arrayBuffer();

            // 2. Write to R2 (Async) and Parse (Async)
            // parse expects content, saveRawEmail expects buffer/stream
            const r2Promise = R2.saveRawEmail(env.MAILSTORE, messageId, rawBuffer, rawBuffer.byteLength);
            const parsePromise = MimeParser.parse(rawBuffer);

            const [rawKey, parsed] = await Promise.all([r2Promise, parsePromise]);

            // 3. Dedupe Check based on Message-ID + To (or derived ID)
            const messageIdHeader = parsed.messageId || parsed.allHeaders['message-id'] || '';
            const dedupeSource = messageIdHeader || [
                parsed.from || '',
                parsed.to || '',
                parsed.subject || '',
                parsed.date || '',
                parsed.snippet || ''
            ].join('|');

            const dedupeKey = await crypto.subtle.digest(
                'SHA-256',
                new TextEncoder().encode(dedupeSource)
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
                const filename = att.filename || `attachment-${attId}`;
                const attKey = await R2.saveAttachment(env.MAILSTORE, messageId, attId, filename, att.content);

                attachmentInserts.push({
                    id: attId,
                    message_id: messageId,
                    filename,
                    content_type: att.mimeType || att.contentType || null,
                    size_bytes: att.content?.byteLength ?? 0,
                    sha256: null, // skipped for now
                    r2_key: attKey
                });
            }
            await DB.insertAttachments(env.DB, attachmentInserts);

            // 6. Trigger Post-Processing (Background)
            ctx.waitUntil(processMessage(messageId, env));

        } catch (e) {
            Sentry.captureException(e);
            console.error('Email Ingest Failed', e);
            // In production, we should try to save the raw email to a 'failed' bucket path if possible
            message.setReject('Internal Error');
        }
    }
});
