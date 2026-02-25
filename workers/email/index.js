import * as Sentry from "@sentry/cloudflare";
import { MimeParser } from '../shared/mime.js';
import { DB } from '../shared/db.js';
import { R2 } from '../shared/r2.js';
import { MessageClassifier } from '../shared/openai.js';
import { sendNewEmailNotification } from '../shared/notifications.js';

/**
 * Async Background Processor
 */
async function processMessage(messageId, env, message = null) {
    try {
        const id = env.REALTIME_HUB.idFromName('global');
        const hub = env.REALTIME_HUB.get(id);

        // 1. Get current message state
        if (!message) {
            message = await DB.getMessage(env.DB, messageId);
        }
        if (!message) return;

        // 2. Broadcast received event (Non-blocking)
        const broadcastPromise = hub.fetch('http://do/broadcast', {
            method: 'POST',
            body: JSON.stringify({
                type: 'message.received',
                messageId: message.id,
                receivedAt: message.received_at
            })
        });

        const shouldClassifyTag = !message.tag_checked_at;

        // 3. Tag Classification (rules take priority over AI)
        if (shouldClassifyTag) {
            // First, check user-defined tagging rules
            const ruleMatch = await DB.matchTaggingRules(env.DB, message);

            if (ruleMatch) {
                // Rule matched - apply the tag
                await DB.updateTagInfo(env.DB, messageId, {
                    tag: ruleMatch.tag,
                    confidence: ruleMatch.confidence,
                    reason: ruleMatch.reason
                });

                // Update local message object for notification
                message.tag = ruleMatch.tag;

                await hub.fetch('http://do/broadcast', {
                    method: 'POST',
                    body: JSON.stringify({
                        type: 'message.tagged',
                        messageId: message.id,
                        tag: ruleMatch.tag,
                        tagConfidence: ruleMatch.confidence,
                        taggedByRule: true,
                        ruleName: ruleMatch.ruleName
                    })
                });
            } else {
                // No rule matched - fall back to AI classification
                const dbTags = await DB.getTags(env.DB);
                const tagLabels = new Set(dbTags.map(t => t.name));
                // Fallback or auxiliary from env if needed, but primary is DB now
                if (env.TAG_LABELS) {
                    env.TAG_LABELS.split(',').forEach(t => tagLabels.add(t.trim()));
                }
                tagLabels.add('spam');

                const result = await MessageClassifier.classify(
                    message,
                    Array.from(tagLabels),
                    env.OPENROUTER_API_KEY || env.OPENAI_API_KEY,
                    env.OPENROUTER_MODEL || env.OPENAI_MODEL
                );

                if (result?.tag) {
                    await DB.updateTagInfo(env.DB, messageId, result.tag);

                    if (result.tag.tag) {
                        // Update local message object for notification
                        message.tag = result.tag.tag;

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
        }

        // Await initial broadcast before continuing to notification
        await broadcastPromise;

        // 4. Send push notification (after tagging so we can skip spam)
        try {
            // Optimization: Use local message object instead of re-fetching from DB
            const notifyResult = await sendNewEmailNotification(message, env);
            if (notifyResult && !notifyResult.ok && !notifyResult.skipped) {
                console.error(`Push notification failed: ${notifyResult.error}`);
            }
        } catch (notifyErr) {
            // Notification failures should never block email processing
            console.error(`Push notification error: ${notifyErr.message || notifyErr}`);
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
        // Read raw content early and store for potential error recovery
        // This must be done once since streams can only be consumed once
        let rawBuffer;
        let messageId;
        
        try {
            messageId = crypto.randomUUID();

            // 1. Read Raw Content into Memory
            // We read into an ArrayBuffer to avoid stream length issues with R2 after tee()
            rawBuffer = await new Response(message.raw).arrayBuffer();

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
                console.log(`Duplicate message skipped: ${parsed.allHeaders['message-id'] || 'unknown-id'}`);
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
            const attachmentPromises = parsed.attachments.map(async (att) => {
                const attId = crypto.randomUUID();
                const filename = att.filename || `attachment-${attId}`;
                const attKey = await R2.saveAttachment(env.MAILSTORE, messageId, attId, filename, att.content);

                return {
                    id: attId,
                    message_id: messageId,
                    filename,
                    content_type: att.mimeType || att.contentType || null,
                    size_bytes: att.content?.byteLength ?? 0,
                    sha256: null, // skipped for now
                    r2_key: attKey
                };
            });

            const attachmentInserts = await Promise.all(attachmentPromises);
            await DB.insertAttachments(env.DB, attachmentInserts);

            // Enrich local message object with attachments and tags for post-processing
            // This ensures it matches the structure returned by DB.getMessage()
            dbMessage.attachments = attachmentInserts;
            dbMessage.tags = [];
            dbMessage.tag = null;

            // 6. Trigger Post-Processing (Background)
            ctx.waitUntil(processMessage(messageId, env, dbMessage));

        } catch (e) {
            Sentry.captureException(e);
            console.error('Email Ingest Failed:', e.message || e);
            
            // Try to save minimal record on failure instead of rejecting
            // Use the already-read rawBuffer if available, otherwise we can't recover
            try {
                const failedMessageId = messageId || crypto.randomUUID();
                
                // Only attempt to save to R2 if we have the raw buffer
                if (rawBuffer) {
                    await R2.saveRawEmail(env.MAILSTORE, failedMessageId, rawBuffer, rawBuffer.byteLength);
                }
                
                const minimalMessage = {
                    id: failedMessageId,
                    received_at: Date.now(),
                    from_addr: message.from || 'unknown',
                    to_addr: message.to || 'unknown',
                    subject: '[Parse Error] Email could not be processed',
                    date_header: null,
                    snippet: `Error: ${e.message || 'Unknown error'}`,
                    has_attachments: false,
                    raw_r2_key: rawBuffer ? `raw/${failedMessageId}.eml` : '',
                    text_body: null,
                    html_body: null,
                    headers_json: '{}'
                };
                await DB.insertMessage(env.DB, minimalMessage);
                console.log('Saved minimal record for failed email:', failedMessageId);
            } catch (fallbackError) {
                console.error('Failed to save minimal record:', fallbackError.message || fallbackError);
                message.setReject('Internal Error');
            }
        }
    }
});
