/**
 * D1 Database Helper
 */

export const DB = {
  /**
   * Insert a new message
   * @param {D1Database} db 
   * @param {Object} message 
   */
  async insertMessage(db, message) {
    const query = `
      INSERT INTO messages (
        id, received_at, from_addr, to_addr, subject, 
        date_header, snippet, has_attachments, raw_r2_key, 
        text_body, html_body, headers_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.prepare(query).bind(
      message.id,
      message.received_at,
      message.from_addr,
      message.to_addr,
      message.subject,
      message.date_header,
      message.snippet,
      message.has_attachments ? 1 : 0,
      message.raw_r2_key,
      message.text_body,
      message.html_body,
      message.headers_json
    ).run();
  },

  /**
   * Insert attachments
   * @param {D1Database} db 
   * @param {Array<Object>} attachments 
   */
  async insertAttachments(db, attachments) {
    if (!attachments || attachments.length === 0) return;

    const stmt = db.prepare(`
      INSERT INTO attachments (
        id, message_id, filename, content_type, 
        size_bytes, sha256, r2_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const batch = attachments.map(att => stmt.bind(
      att.id,
      att.message_id,
      att.filename,
      att.content_type,
      att.size_bytes,
      att.sha256,
      att.r2_key
    ));

    await db.batch(batch);
  },

  /**
   * Check deduplication key
   * @param {D1Database} db 
   * @param {string} dedupeKey 
   * @param {string} messageId 
   * @returns {Promise<boolean>} true if inserted (not duplicate), false if duplicate exists
   */
  async checkDedupe(db, dedupeKey, messageId) {
    try {
      await db.prepare('INSERT INTO dedupe (dedupe_key, message_id) VALUES (?, ?)')
        .bind(dedupeKey, messageId)
        .run();
      return true;
    } catch (e) {
      // Constraint violation means duplicate
      return false;
    }
  },

  /**
   * List messages for inbox
   * @param {D1Database} db 
   * @param {Object} filters { limit, before, spamStatus }
   */
  async listMessages(db, { limit = 50, before = null, spamStatus = null } = {}) {
    let query = 'SELECT * FROM messages';
    const params = [];
    const conditions = [];

    if (before) {
      conditions.push('received_at < ?');
      params.push(before);
    }

    if (spamStatus) {
      conditions.push('spam_status = ?');
      params.push(spamStatus);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY received_at DESC LIMIT ?';
    params.push(limit);

    const { results } = await db.prepare(query).bind(...params).all();
    return results;
  },

  /**
   * Get full message detail
   * @param {D1Database} db 
   * @param {string} id 
   */
  async getMessage(db, id) {
    const msg = await db.prepare('SELECT * FROM messages WHERE id = ?').bind(id).first();
    if (!msg) return null;

    const { results: attachments } = await db.prepare('SELECT * FROM attachments WHERE message_id = ?')
      .bind(id)
      .all();

    return { ...msg, attachments };
  },

  /**
   * Update spam info
   * @param {D1Database} db 
   * @param {string} id 
   * @param {Object} spamInfo 
   */
  async updateSpamInfo(db, id, { attempts, is_spam, confidence, reason }) {
    await db.prepare(`
      UPDATE messages 
      SET spam_status = ?, spam_confidence = ?, spam_reason = ?, spam_checked_at = ? 
      WHERE id = ?
    `).bind(
      is_spam ? 'spam' : (is_spam === false ? 'ham' : 'unknown'),
      confidence,
      reason,
      Date.now(),
      id
    ).run();
  }
};
