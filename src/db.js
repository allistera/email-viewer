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
   * @param {Object} filters { limit, before, tag, excludeTag, archived }
   */

  async listMessages(db, { limit = 50, before = null, tag = null, excludeTag = null, archived = false, search = null } = {}) {
    let query = 'SELECT m.* FROM messages m';
    const params = [];
    const conditions = [];

    // FTS Join
    if (search) {
      query += ' JOIN messages_fts fts ON m.rowid = fts.rowid';
      conditions.push('messages_fts MATCH ?');
      // Format search query for FTS5 (phrase or simple)
      // "foo bar" -> "foo" AND "bar" maybe? Or just pass through user query?
      // Simple prefix: "term*"
      const ftsQuery = search.split(/\s+/).map(s => `"${s}"*`).join(' OR ');
      params.push(ftsQuery);
    }

    if (before) {
      conditions.push('m.received_at < ?');
      params.push(before);
    }

    if (tag) {
      conditions.push('EXISTS (SELECT 1 FROM message_tags mt JOIN tags t ON mt.tag_id = t.id WHERE mt.message_id = m.id AND (t.name = ? OR t.name LIKE ?))');
      params.push(tag, `${tag}/%`);
    }

    if (excludeTag) {
      conditions.push('NOT EXISTS (SELECT 1 FROM message_tags mt JOIN tags t ON mt.tag_id = t.id WHERE mt.message_id = m.id AND t.name = ?)');
      params.push(excludeTag);
    }

    // Archived filter:
    if (archived === true) {
      conditions.push('m.is_archived = 1');
    } else if (archived === false) {
      conditions.push('(m.is_archived = 0 OR m.is_archived IS NULL)');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    if (search) {
      query += ' ORDER BY rank, m.received_at DESC LIMIT ?';
    } else {
      query += ' ORDER BY m.received_at DESC LIMIT ?';
    }
    params.push(limit);

    const { results } = await db.prepare(query).bind(...params).all();

    // Enrich with tags (N+1 but limited to 50, acceptable for NOW, or use group_concat query above)
    // Optimization: Fetch all tags for these messages
    if (results && results.length > 0) {
      const ids = results.map(r => `'${r.id}'`).join(',');
      const tagsQuery = `
           SELECT mt.message_id, t.name 
           FROM message_tags mt 
           JOIN tags t ON mt.tag_id = t.id 
           WHERE mt.message_id IN (${ids})
         `;
      const { results: allTags } = await db.prepare(tagsQuery).all();

      const tagsMap = {};
      if (allTags) {
        for (const t of allTags) {
          if (!tagsMap[t.message_id]) tagsMap[t.message_id] = [];
          tagsMap[t.message_id].push(t.name);
        }
      }

      for (const r of results) {
        r.tags = tagsMap[r.id] || [];
        r.tag = r.tags[0] || null; // Backward compat
      }
    }

    return results || [];
  },

  /**
   * Archive a message
   * @param {D1Database} db 
   * @param {string} id 
   */
  async archiveMessage(db, id) {
    await db.prepare('UPDATE messages SET is_archived = 1 WHERE id = ?').bind(id).run();
  },

  /**
   * Unarchive a message
   * @param {D1Database} db 
   * @param {string} id 
   */
  async unarchiveMessage(db, id) {
    await db.prepare('UPDATE messages SET is_archived = 0 WHERE id = ?').bind(id).run();
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

    const { results: tags } = await db.prepare(`
        SELECT t.name 
        FROM message_tags mt 
        JOIN tags t ON mt.tag_id = t.id 
        WHERE mt.message_id = ?
    `).bind(id).all();

    const tagNames = tags ? tags.map(t => t.name) : [];

    return {
      ...msg,
      attachments,
      tags: tagNames,
      tag: tagNames[0] || null
    };
  },

  /**
   * Add a tag to a message
   * @param {D1Database} db
   * @param {string} messageId
   * @param {string} tagName
   */
  async addMessageTag(db, messageId, tagName) {
    // Ensure tag exists
    let tag = await db.prepare('SELECT id FROM tags WHERE name = ?').bind(tagName).first();
    if (!tag) {
      tag = await this.createTag(db, tagName);
    }

    await db.prepare('INSERT OR IGNORE INTO message_tags (message_id, tag_id) VALUES (?, ?)').bind(messageId, tag.id).run();

    // Update legacy field for now (though we are moving away)
    await db.prepare('UPDATE messages SET tag = ? WHERE id = ?').bind(tagName, messageId).run();
  },

  /**
   * Remove a tag from a message
   * @param {D1Database} db
   * @param {string} messageId
   * @param {string} tagName
   */
  async removeMessageTag(db, messageId, tagName) {
    const tag = await db.prepare('SELECT id FROM tags WHERE name = ?').bind(tagName).first();
    if (!tag) return;

    await db.prepare('DELETE FROM message_tags WHERE message_id = ? AND tag_id = ?').bind(messageId, tag.id).run();

    // Legacy cleanup: if we deleted the tag that is in messages.tag, grab another one
    const remainingTag = await db.prepare(`
        SELECT t.name FROM message_tags mt JOIN tags t ON mt.tag_id = t.id 
        WHERE mt.message_id = ? LIMIT 1
      `).bind(messageId).first();

    await db.prepare('UPDATE messages SET tag = ? WHERE id = ?').bind(remainingTag ? remainingTag.name : null, messageId).run();
  },

  /**
   * Set list of tags (Replace)
   * @param {D1Database} db
   * @param {string} messageId
   * @param {string[]} tags
   */
  async setMessageTags(db, messageId, tags) {
    // Clear existing
    await db.prepare('DELETE FROM message_tags WHERE message_id = ?').bind(messageId).run();

    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        await this.addMessageTag(db, messageId, tagName);
      }
    } else {
      await db.prepare('UPDATE messages SET tag = NULL WHERE id = ?').bind(messageId).run();
    }
  },

  /**
   * Update tag info (Legacy/Single Tag wrapper)
   * @param {D1Database} db
   * @param {string} id
   * @param {Object} tagInfo
   */
  async updateTagInfo(db, id, { tag, confidence, reason }) {
    // Treat as "Set this tag" (and remove others? Or add?)
    // "Tag the highlighted email" usually implies adding or setting primary.
    // The previous behavior was "replace".
    if (tag) {
      await this.setMessageTags(db, id, [tag]);
    }

    // Update metadata if needed (confidence/reason still on messages table? Yes)
    await db.prepare(`
      UPDATE messages
      SET tag_confidence = ?, tag_reason = ?, tag_checked_at = ?
      WHERE id = ?
    `).bind(
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
