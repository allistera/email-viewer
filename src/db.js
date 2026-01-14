/**
 * D1 database helpers
 */

/**
 * Insert a new message into the database
 */
export async function insertMessage(db, message) {
  const stmt = db.prepare(`
    INSERT INTO messages (
      id, received_at, from_addr, to_addr, subject, date_header,
      snippet, has_attachments, raw_r2_key, text_body, html_body, headers_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  return stmt.bind(
    message.id,
    message.received_at,
    message.from_addr,
    message.to_addr,
    message.subject,
    message.date_header,
    message.snippet,
    message.has_attachments,
    message.raw_r2_key,
    message.text_body,
    message.html_body,
    message.headers_json
  ).run();
}

/**
 * Insert multiple attachments for a message
 */
export async function insertAttachments(db, attachments) {
  if (!attachments || attachments.length === 0) {
    return { success: true };
  }

  const stmt = db.prepare(`
    INSERT INTO attachments (id, message_id, filename, content_type, size_bytes, sha256, r2_key)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const batch = attachments.map(att =>
    stmt.bind(att.id, att.message_id, att.filename, att.content_type, att.size_bytes, att.sha256, att.r2_key)
  );

  return db.batch(batch);
}

/**
 * Check if a message exists by dedupe key
 */
export async function checkDedupe(db, dedupeKey) {
  const result = await db.prepare('SELECT message_id FROM dedupe WHERE dedupe_key = ?')
    .bind(dedupeKey)
    .first();

  return result !== null;
}

/**
 * Insert dedupe record
 */
export async function insertDedupe(db, dedupeKey, messageId) {
  return db.prepare('INSERT INTO dedupe (dedupe_key, message_id) VALUES (?, ?)')
    .bind(dedupeKey, messageId)
    .run();
}

/**
 * Get messages with pagination
 */
export async function getMessages(db, { limit = 50, before = null, spamStatus = null }) {
  let query = 'SELECT * FROM messages';
  const params = [];

  const conditions = [];
  if (before) {
    conditions.push('received_at < ?');
    params.push(before);
  }
  if (spamStatus && spamStatus !== 'all') {
    conditions.push('spam_status = ?');
    params.push(spamStatus);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY received_at DESC LIMIT ?';
  params.push(limit);

  const stmt = db.prepare(query);
  const result = await stmt.bind(...params).all();

  return result.results || [];
}

/**
 * Get a single message by ID
 */
export async function getMessage(db, messageId) {
  return db.prepare('SELECT * FROM messages WHERE id = ?')
    .bind(messageId)
    .first();
}

/**
 * Get attachments for a message
 */
export async function getAttachments(db, messageId) {
  const result = await db.prepare('SELECT * FROM attachments WHERE message_id = ?')
    .bind(messageId)
    .all();

  return result.results || [];
}

/**
 * Get a single attachment by ID
 */
export async function getAttachment(db, attachmentId) {
  return db.prepare('SELECT * FROM attachments WHERE id = ?')
    .bind(attachmentId)
    .first();
}

/**
 * Update spam classification for a message
 */
export async function updateSpamStatus(db, messageId, spamData) {
  return db.prepare(`
    UPDATE messages
    SET spam_status = ?, spam_confidence = ?, spam_reason = ?, spam_checked_at = ?
    WHERE id = ?
  `).bind(
    spamData.spam_status,
    spamData.spam_confidence,
    spamData.spam_reason,
    spamData.spam_checked_at,
    messageId
  ).run();
}
