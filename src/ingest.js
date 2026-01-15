/**
 * Email ingestion handler
 * Processes incoming emails from Cloudflare Email Routing
 */

import { parseMimeMessage, generateDedupeKey, generateSnippet, stripHtml, decodeBase64ToBytes, sha256Bytes } from './mime.js';
import { uploadRawEmail, uploadAttachment } from './r2.js';
import { insertMessage, insertAttachments, checkDedupe, insertDedupe } from './db.js';

/**
 * Handle incoming email from Cloudflare Email Routing
 */
export async function handleIncomingEmail(message, env, _ctx) {
  const messageId = crypto.randomUUID();

  console.log(`[${messageId}] Processing incoming email`);

  try {
    const rawEmail = await message.raw();
    const rawEmailStream = new ReadableStream({
      start(controller) {
        controller.enqueue(rawEmail);
        controller.close();
      }
    });

    const rawKey = await uploadRawEmail(env.MAILSTORE, messageId, rawEmailStream);
    console.log(`[${messageId}] Uploaded raw email to R2: ${rawKey}`);

    const parsed = await parseMimeMessage(message);
    console.log(`[${messageId}] Parsed email from: ${parsed.from}, subject: ${parsed.subject}`);

    const dedupeKey = await generateDedupeKey(parsed.headers, parsed.textBody);

    const isDuplicate = await checkDedupe(env.DB, dedupeKey);
    if (isDuplicate) {
      console.log(`[${messageId}] Duplicate email detected, skipping`);
      return;
    }

    await insertDedupe(env.DB, dedupeKey, messageId);

    const textBody = parsed.textBody || stripHtml(parsed.htmlBody);
    const snippet = generateSnippet(textBody);

    const attachmentRecords = [];
    for (const att of parsed.attachments) {
      const attId = crypto.randomUUID();
      const attData = decodeBase64ToBytes(att.body);
      const attSha256 = await sha256Bytes(attData);

      const r2Key = await uploadAttachment(
        env.MAILSTORE,
        messageId,
        attId,
        att.filename,
        attData
      );

      attachmentRecords.push({
        id: attId,
        message_id: messageId,
        filename: att.filename,
        content_type: att.contentType,
        size_bytes: attData.length,
        sha256: attSha256,
        r2_key: r2Key
      });

      console.log(`[${messageId}] Uploaded attachment: ${att.filename}`);
    }

    const selectedHeaders = {
      'message-id': parsed.messageId,
      'from': parsed.headers['from'],
      'to': parsed.headers['to'],
      'date': parsed.date,
      'subject': parsed.subject
    };

    const messageRecord = {
      id: messageId,
      received_at: Date.now(),
      from_addr: parsed.from,
      to_addr: parsed.to,
      subject: parsed.subject,
      date_header: parsed.date,
      snippet,
      has_attachments: attachmentRecords.length > 0 ? 1 : 0,
      raw_r2_key: rawKey,
      text_body: parsed.textBody,
      html_body: parsed.htmlBody,
      headers_json: JSON.stringify(selectedHeaders)
    };

    await insertMessage(env.DB, messageRecord);
    console.log(`[${messageId}] Inserted message into D1`);

    if (attachmentRecords.length > 0) {
      await insertAttachments(env.DB, attachmentRecords);
      console.log(`[${messageId}] Inserted ${attachmentRecords.length} attachments into D1`);
    }

    await env.MAIL_EVENTS.send({
      type: 'message.received',
      messageId,
      receivedAt: messageRecord.received_at
    });

    console.log(`[${messageId}] Enqueued message.received event`);

  } catch (error) {
    console.error(`[${messageId}] Error processing email:`, error.message);

    try {
      const rawEmail = await message.raw();
      const rawEmailStream = new ReadableStream({
        start(controller) {
          controller.enqueue(rawEmail);
          controller.close();
        }
      });
      await uploadRawEmail(env.MAILSTORE, messageId, rawEmailStream);

      const minimalRecord = {
        id: messageId,
        received_at: Date.now(),
        from_addr: 'unknown',
        to_addr: 'unknown',
        subject: 'Error parsing email',
        date_header: null,
        snippet: `Error: ${error.message}`,
        has_attachments: 0,
        raw_r2_key: `raw/${messageId}.eml`,
        text_body: null,
        html_body: null,
        headers_json: '{}'
      };

      await insertMessage(env.DB, minimalRecord);
      console.log(`[${messageId}] Saved minimal record after error`);
    } catch (fallbackError) {
      console.error(`[${messageId}] Failed to save minimal record:`, fallbackError.message);
    }
  }
}
