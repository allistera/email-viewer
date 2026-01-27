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
   * @param {Object} filters { limit, before, tag, excludeTag }
   */
  async listMessages(db, { limit = 50, before = null, tag = null, excludeTag = null } = {}) {
    let query = 'SELECT * FROM messages';
    const params = [];
    const conditions = [];

    if (before) {
      conditions.push('received_at < ?');
      params.push(before);
    }

    if (tag) {
      conditions.push('(tag = ? OR tag LIKE ?)');
      params.push(tag, `${tag}/%`);
    }

    if (excludeTag) {
      conditions.push('(tag IS NULL OR tag != ?)');
      params.push(excludeTag);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY received_at DESC LIMIT ?';
    params.push(limit);

    const { results } = await db.prepare(query).bind(...params).all();
    return results || [];
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
   * Update tag info
   * @param {D1Database} db
   * @param {string} id
   * @param {Object} tagInfo
   */
  async updateTagInfo(db, id, { tag, confidence, reason }) {
    await db.prepare(`
      UPDATE messages
      SET tag = ?, tag_confidence = ?, tag_reason = ?, tag_checked_at = ?
      WHERE id = ?
    `).bind(
      tag ?? null,
      confidence ?? null,
      reason ?? null,
      Date.now(),
      id
    ).run();
  },

  /**
   * Get all tags
   * @param {D1Database} db
   */
  async getTags(db) {
    const { results } = await db.prepare('SELECT * FROM tags ORDER BY created_at DESC').all();

    // Ensure 'Spam' tag always exists
    const spamTag = results.find(t => t.name === 'Spam');
    if (!spamTag) {
      const id = crypto.randomUUID();
      await db.prepare('INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)')
        .bind(id, 'Spam', 0) // 0 to keep it at bottom/top depending on sort, or just old
        .run();
      // Return with new tag
      return [...results, { id, name: 'Spam', created_at: 0 }];
    }

    return results || [];
  },

  /**
   * Create a new tag
   * @param {D1Database} db
   * @param {string} name
   */
  async createTag(db, name) {
    if (name.toLowerCase() === 'spam') {
      const existing = await db.prepare('SELECT * FROM tags WHERE name = ?').bind('Spam').first();
      if (existing) return existing;
    }
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)')
      .bind(id, name, Date.now())
      .run();
    return { id, name };
  },

  /**
   * Update a tag name (supporting hierarchy rename)
   * @param {D1Database} db
   * @param {string} id
   * @param {string} newName
   */
  async updateTag(db, id, newName) {
    const oldTag = await db.prepare('SELECT name FROM tags WHERE id = ?').bind(id).first();
    if (!oldTag) throw new Error('Tag not found');
    const oldName = oldTag.name;

    if (oldName === newName) return;

    // Check collision
    const existing = await db.prepare('SELECT id FROM tags WHERE name = ? AND id != ?').bind(newName, id).first();
    if (existing) throw new Error('Tag name already exists');

    // Update Tag Name
    await db.prepare('UPDATE tags SET name = ? WHERE id = ?').bind(newName, id).run();

    // Update Child Tags (Hierarchy)
    await db.prepare(`
      UPDATE tags 
      SET name = ? || SUBSTR(name, LENGTH(?) + 1) 
      WHERE name LIKE ? || '/%'
    `).bind(newName, oldName, oldName).run();

    // Update Messages (Exact match)
    await db.prepare('UPDATE messages SET tag = ? WHERE tag = ?').bind(newName, oldName).run();

    // Update Messages (Children / Hierarchy)
    // Replace prefix match
    await db.prepare(`
      UPDATE messages 
      SET tag = ? || SUBSTR(tag, LENGTH(?) + 1) 
      WHERE tag LIKE ? || '/%'
    `).bind(newName, oldName, oldName).run();
  },

  /**
   * Delete a tag
   * @param {D1Database} db
   * @param {string} id
   */
  async deleteTag(db, id) {
    // Prevent deleting Spam tag
    const tag = await db.prepare('SELECT name FROM tags WHERE id = ?').bind(id).first();
    if (tag && tag.name === 'Spam') {
      throw new Error('Cannot delete system tag: Spam');
    }
    await db.prepare('DELETE FROM tags WHERE id = ?').bind(id).run();
  }
};
