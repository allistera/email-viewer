/**
 * D1 Database Helper
 */

export const DB = {
  // ==================
  // User & Auth
  // ==================

  /**
   * Get user by API token
   * @param {D1Database} db
   * @param {string} token
   */
  async getUserByToken(db, token) {
    return db.prepare(`
      SELECT u.*
      FROM users u
      JOIN api_tokens t ON u.id = t.user_id
      WHERE t.token = ?
      AND (t.expires_at IS NULL OR t.expires_at > ?)
    `).bind(token, Date.now()).first();
  },

  /**
   * Get user by email address
   * @param {D1Database} db
   * @param {string} address
   */
  async getUserByAddress(db, address) {
    return db.prepare(`
      SELECT u.*
      FROM users u
      JOIN user_addresses ua ON u.id = ua.user_id
      WHERE ua.address = ?
    `).bind(address).first();
  },

  /**
   * Get user by username
   * @param {D1Database} db
   * @param {string} username
   */
  async getUserByUsername(db, username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  },

  /**
   * Create a new API token for user
   * @param {D1Database} db
   * @param {string} userId
   * @param {number} expiresIn - ms, default 30 days
   */
  async createApiToken(db, userId, expiresIn = 2592000000) {
    const token = crypto.randomUUID(); // Simple UUID token for now
    const now = Date.now();
    const expiresAt = now + expiresIn;

    await db.prepare('INSERT INTO api_tokens (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .bind(token, userId, now, expiresAt)
      .run();

    return { token, expiresAt };
  },

  // ==================
  // Messages
  // ==================

  /**
   * Insert a new message
   * @param {D1Database} db 
   * @param {Object} message 
   */
  async insertMessage(db, message) {
    const query = `
      INSERT INTO messages (
        id, user_id, received_at, from_addr, to_addr, subject,
        date_header, snippet, has_attachments, raw_r2_key, 
        text_body, html_body, headers_json, snoozed_until
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.prepare(query).bind(
      message.id,
      message.user_id, // New field
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
      message.headers_json,
      message.snoozed_until ?? null
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

    const BATCH_SIZE = 100;
    for (let i = 0; i < attachments.length; i += BATCH_SIZE) {
      const chunk = attachments.slice(i, i + BATCH_SIZE);
      const batch = chunk.map(att => stmt.bind(
        att.id,
        att.message_id,
        att.filename,
        att.content_type,
        att.size_bytes,
        att.sha256,
        att.r2_key
      ));

      await db.batch(batch);
    }
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
   * @param {Object} params - userId is mandatory
   * @param {Object} filters { limit, before, tag, excludeTag, archived }
   */
  async listMessages(db, { userId, limit = 50, before = null, tag = null, excludeTag = null, archived = false, search = null, hideSnoozed = false, snoozed = false } = {}) {
    if (!userId) throw new Error('userId is required');

    let query = 'SELECT m.* FROM messages m';
    const params = [];
    const conditions = ['m.user_id = ?'];
    params.push(userId);

    // FTS Join
    if (search) {
      query += ' JOIN messages_fts ON m.rowid = messages_fts.rowid';
      conditions.push('messages_fts MATCH ?');
      const sanitizedSearch = search.replace(/"/g, '');
      const ftsQuery = sanitizedSearch.split(/\s+/).filter(s => s.length > 0).map(s => `"${s}"*`).join(' AND ');
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

    if (snoozed === true) {
      conditions.push('m.snoozed_until IS NOT NULL AND m.snoozed_until > ?');
      params.push(Date.now());
    } else if (hideSnoozed === true) {
      conditions.push('(m.snoozed_until IS NULL OR m.snoozed_until <= ?)');
      params.push(Date.now());
    }

    query += ' WHERE ' + conditions.join(' AND ');

    if (search) {
      query += ' ORDER BY rank, m.received_at DESC LIMIT ?';
    } else {
      query += ' ORDER BY m.received_at DESC LIMIT ?';
    }
    params.push(limit);

    const { results } = await db.prepare(query).bind(...params).all();

    // Enrich with tags using parameterized query to prevent SQL injection
    if (results && results.length > 0) {
      const placeholders = results.map(() => '?').join(',');
      const messageIds = results.map(r => r.id);
      const tagsQuery = `
           SELECT mt.message_id, t.name 
           FROM message_tags mt 
           JOIN tags t ON mt.tag_id = t.id 
           WHERE mt.message_id IN (${placeholders})
         `;
      const { results: allTags } = await db.prepare(tagsQuery).bind(...messageIds).all();

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
   * Count messages with same filters as listMessages (no limit/before)
   * @param {D1Database} db
   * @param {Object} params - userId is required
   * @param {Object} filters { tag, excludeTag, archived, includeArchived, search }
   */
  async countMessages(db, { userId, tag = null, excludeTag = null, archived = false, includeArchived = false, search = null } = {}) {
    if (!userId) throw new Error('userId is required');

    let query = 'SELECT COUNT(*) as count FROM messages m';
    const params = [];
    const conditions = ['m.user_id = ?'];
    params.push(userId);

    if (search) {
      query += ' JOIN messages_fts ON m.rowid = messages_fts.rowid';
      conditions.push('messages_fts MATCH ?');
      const sanitizedSearch = search.replace(/"/g, '');
      const ftsQuery = sanitizedSearch.split(/\s+/).filter(s => s.length > 0).map(s => `"${s}"*`).join(' AND ');
      params.push(ftsQuery);
    }

    if (tag) {
      conditions.push('EXISTS (SELECT 1 FROM message_tags mt JOIN tags t ON mt.tag_id = t.id WHERE mt.message_id = m.id AND (t.name = ? OR t.name LIKE ?))');
      params.push(tag, `${tag}/%`);
    }

    if (excludeTag) {
      conditions.push('NOT EXISTS (SELECT 1 FROM message_tags mt JOIN tags t ON mt.tag_id = t.id WHERE mt.message_id = m.id AND t.name = ?)');
      params.push(excludeTag);
    }

    if (!includeArchived) {
      if (archived === true) {
        conditions.push('m.is_archived = 1');
      } else if (archived === false) {
        conditions.push('(m.is_archived = 0 OR m.is_archived IS NULL)');
      }
    }

    query += ' WHERE ' + conditions.join(' AND ');

    const row = await db.prepare(query).bind(...params).first();
    return row?.count ?? 0;
  },

  /**
   * Get all message counts in one query
   * @param {D1Database} db
   * @param {string} userId
   */
  async getCounts(db, userId) {
    if (!userId) throw new Error('userId is required');

    const query = `
      SELECT
        'archive' as type,
        NULL as tag_name,
        COUNT(*) as count
      FROM messages
      WHERE user_id = ? AND is_archived = 1

      UNION ALL

      SELECT
        'total_unarchived' as type,
        NULL as tag_name,
        COUNT(*) as count
      FROM messages
      WHERE user_id = ?
        AND (is_archived = 0 OR is_archived IS NULL)
        AND (snoozed_until IS NULL OR snoozed_until <= strftime('%s','now') * 1000)

      UNION ALL

      SELECT
        'tag' as type,
        t.name as tag_name,
        COUNT(m.id) as count
      FROM messages m
      JOIN message_tags mt ON m.id = mt.message_id
      JOIN tags t ON mt.tag_id = t.id
      WHERE m.user_id = ?
        AND (m.is_archived = 0 OR m.is_archived IS NULL)
        AND (m.snoozed_until IS NULL OR m.snoozed_until <= strftime('%s','now') * 1000)
      GROUP BY t.name
    `;

    const { results } = await db.prepare(query).bind(userId, userId, userId).all();

    let archive = 0;
    let totalUnarchived = 0;
    const tagCounts = {};

    if (results) {
      for (const row of results) {
        if (row.type === 'archive') {
          archive = row.count;
        } else if (row.type === 'total_unarchived') {
          totalUnarchived = row.count;
        } else if (row.type === 'tag') {
          tagCounts[row.tag_name] = row.count;
        }
      }
    }

    const spam = tagCounts['Spam'] || 0;
    // Inbox = Unarchived - Unarchived Spam
    const inbox = Math.max(0, totalUnarchived - spam);
    // Sent is usually archived? Or separate?
    // In original code, sent was just tagCounts['Sent'].
    const sent = tagCounts['Sent'] || 0;

    return {
      inbox,
      archive,
      spam,
      sent,
      tagCounts
    };
  },

  /**
   * Archive a message
   * @param {D1Database} db 
   * @param {string} id 
   * @param {string} userId - optional check
   */
  async archiveMessage(db, id, userId = null) {
    let query = 'UPDATE messages SET is_archived = 1 WHERE id = ?';
    const params = [id];
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    await db.prepare(query).bind(...params).run();
  },

  /**
   * Unarchive a message
   * @param {D1Database} db 
   * @param {string} id 
   * @param {string} userId
   */
  async unarchiveMessage(db, id, userId = null) {
    let query = 'UPDATE messages SET is_archived = 0 WHERE id = ?';
    const params = [id];
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    await db.prepare(query).bind(...params).run();
  },

  /**
   * Snooze a message until a future timestamp
   * @param {D1Database} db
   * @param {string} id
   * @param {number} until
   * @param {string} userId
   */
  async snoozeMessage(db, id, until, userId = null) {
    let query = 'UPDATE messages SET snoozed_until = ? WHERE id = ?';
    const params = [until, id];
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    await db.prepare(query).bind(...params).run();
  },

  /**
   * Clear snooze on a message
   * @param {D1Database} db
   * @param {string} id
   * @param {string} userId
   */
  async unsnoozeMessage(db, id, userId = null) {
    let query = 'UPDATE messages SET snoozed_until = NULL WHERE id = ?';
    const params = [id];
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    await db.prepare(query).bind(...params).run();
  },

  /**
   * Mark a message as read
   * @param {D1Database} db
   * @param {string} id
   * @param {string} userId
   */
  async markRead(db, id, userId = null) {
    let query = 'UPDATE messages SET is_read = 1 WHERE id = ?';
    const params = [id];
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    await db.prepare(query).bind(...params).run();
  },

  /**
   * Update Todoist info for a message
   * @param {D1Database} db
   * @param {string} id
   * @param {Object} info
   * @param {string} userId
   */
  async updateTodoistInfo(db, id, { projectName = null, projectUrl = null } = {}, userId = null) {
    let query = `
      UPDATE messages
      SET todoist_project_name = ?, todoist_project_url = ?
      WHERE id = ?
    `;
    const params = [projectName, projectUrl, id];
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    await db.prepare(query).bind(...params).run();
  },

  /**
   * Get full message detail
   * @param {D1Database} db 
   * @param {string} id 
   * @param {string} userId
   */
  async getMessage(db, id, userId = null) {
    if (!id) return null;
    
    let query = 'SELECT * FROM messages WHERE id = ?';
    const params = [id];
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    const msg = await db.prepare(query).bind(...params).first();
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
      attachments: attachments || [],
      tags: tagNames,
      tag: tagNames[0] || null
    };
  },

  // ==================
  // Tags
  // ==================

  /**
   * Add a tag to a message
   * @param {D1Database} db
   * @param {string} messageId
   * @param {string} tagName
   * @param {string} userId
   */
  async addMessageTag(db, messageId, tagName, userId) {
    if (!userId) throw new Error('userId is required for tags');

    // Ensure tag exists for this user
    let tag = await db.prepare('SELECT id FROM tags WHERE name = ? AND user_id = ?').bind(tagName, userId).first();
    if (!tag) {
      tag = await this.createTag(db, tagName, userId);
    }

    await db.prepare('INSERT OR IGNORE INTO message_tags (message_id, tag_id) VALUES (?, ?)').bind(messageId, tag.id).run();

    // Update legacy field
    await db.prepare('UPDATE messages SET tag = ? WHERE id = ?').bind(tagName, messageId).run();
  },

  /**
   * Remove a tag from a message
   * @param {D1Database} db
   * @param {string} messageId
   * @param {string} tagName
   * @param {string} userId
   */
  async removeMessageTag(db, messageId, tagName, userId) {
    if (!userId) throw new Error('userId is required for tags');

    const tag = await db.prepare('SELECT id FROM tags WHERE name = ? AND user_id = ?').bind(tagName, userId).first();
    if (!tag) return;

    await db.prepare('DELETE FROM message_tags WHERE message_id = ? AND tag_id = ?').bind(messageId, tag.id).run();

    // Legacy cleanup
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
   * @param {string} userId
   */
  async setMessageTags(db, messageId, tags, userId) {
    if (!userId) throw new Error('userId is required for tags');

    // Clear existing
    await db.prepare('DELETE FROM message_tags WHERE message_id = ?').bind(messageId).run();

    const uniqueTags = [...new Set(tags || [])].filter(t => t && t.trim().length > 0);

    if (uniqueTags.length === 0) {
      await db.prepare('UPDATE messages SET tag = NULL WHERE id = ?').bind(messageId).run();
      return;
    }

    // 1. Resolve Tag IDs for User
    const placeholders = uniqueTags.map(() => '?').join(',');
    const { results: existing } = await db.prepare(`SELECT id, name FROM tags WHERE user_id = ? AND name IN (${placeholders})`)
      .bind(userId, ...uniqueTags)
      .all();

    const existingMap = new Map((existing || []).map(t => [t.name, t.id]));
    const missingNames = uniqueTags.filter(name => !existingMap.has(name));

    // Create missing tags
    if (missingNames.length > 0) {
      const createStmt = db.prepare('INSERT OR IGNORE INTO tags (id, user_id, name, created_at) VALUES (?, ?, ?, ?)');
      const now = Date.now();
      await db.batch(missingNames.map(name =>
        createStmt.bind(crypto.randomUUID(), userId, name, now)
      ));

      // Fetch IDs
      const missingPlaceholders = missingNames.map(() => '?').join(',');
      const { results: newTags } = await db.prepare(`SELECT id, name FROM tags WHERE user_id = ? AND name IN (${missingPlaceholders})`)
        .bind(userId, ...missingNames)
        .all();

      if (newTags) {
        for (const t of newTags) {
          existingMap.set(t.name, t.id);
        }
      }
    }

    // 2. Insert Message Tags
    const insertMtStmt = db.prepare('INSERT INTO message_tags (message_id, tag_id) VALUES (?, ?)');
    const batch = [];

    for (const name of uniqueTags) {
      const tagId = existingMap.get(name);
      if (tagId) {
        batch.push(insertMtStmt.bind(messageId, tagId));
      }
    }

    if (batch.length > 0) {
      await db.batch(batch);
    }

    // 3. Update legacy field
    await db.prepare('UPDATE messages SET tag = ? WHERE id = ?').bind(uniqueTags[0], messageId).run();
  },

  /**
   * Update tag info (Legacy/Single Tag wrapper)
   * @param {D1Database} db
   * @param {string} id
   * @param {Object} tagInfo
   * @param {string} userId - required for setting tags
   */
  async updateTagInfo(db, id, { tag, confidence, reason }, userId) {
    if (tag) {
      // Must have userId to set tags
      if (!userId) throw new Error('userId is required to update tag');
      await this.setMessageTags(db, id, [tag], userId);
    }

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
   * Get all tags for user
   * @param {D1Database} db
   * @param {string} userId
   */
  async getTags(db, userId) {
    if (!userId) throw new Error('userId is required');

    const { results } = await db.prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY created_at DESC').bind(userId).all();
    let finalResults = results || [];

    // Ensure 'Spam' tag always exists for this user
    const spamTag = finalResults.find(t => t.name === 'Spam');
    if (!spamTag) {
      const id = crypto.randomUUID();
      await db.prepare('INSERT INTO tags (id, user_id, name, created_at) VALUES (?, ?, ?, ?)')
        .bind(id, userId, 'Spam', 0)
        .run();
      finalResults = [...finalResults, { id, user_id: userId, name: 'Spam', created_at: 0 }];
    }

    // Ensure 'Sent' tag always exists
    const sentTag = finalResults.find(t => t.name === 'Sent');
    if (!sentTag) {
      const id = crypto.randomUUID();
      await db.prepare('INSERT INTO tags (id, user_id, name, created_at) VALUES (?, ?, ?, ?)')
        .bind(id, userId, 'Sent', 0)
        .run();
      finalResults = [...finalResults, { id, user_id: userId, name: 'Sent', created_at: 0 }];
    }

    return finalResults;
  },

  /**
   * Create a new tag
   * @param {D1Database} db
   * @param {string} name
   * @param {string} userId
   */
  async createTag(db, name, userId) {
    if (!userId) throw new Error('userId is required');

    if (name.toLowerCase() === 'spam') {
      const existing = await db.prepare('SELECT * FROM tags WHERE name = ? AND user_id = ?').bind('Spam', userId).first();
      if (existing) return existing;
    }
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO tags (id, user_id, name, created_at) VALUES (?, ?, ?, ?)')
      .bind(id, userId, name, Date.now())
      .run();
    return { id, name };
  },

  /**
   * Update a tag name (supporting hierarchy rename)
   * @param {D1Database} db
   * @param {string} id
   * @param {string} newName
   * @param {string} userId
   */
  async updateTag(db, id, newName, userId) {
    if (!userId) throw new Error('userId is required');

    const oldTag = await db.prepare('SELECT name FROM tags WHERE id = ? AND user_id = ?').bind(id, userId).first();
    if (!oldTag) throw new Error('Tag not found');
    const oldName = oldTag.name;

    if (oldName === newName) return;

    // Check collision
    const existing = await db.prepare('SELECT id FROM tags WHERE name = ? AND id != ? AND user_id = ?').bind(newName, id, userId).first();
    if (existing) throw new Error('Tag name already exists');

    // Update Tag Name
    await db.prepare('UPDATE tags SET name = ? WHERE id = ?').bind(newName, id).run();

    // Update Child Tags (Hierarchy)
    await db.prepare(`
      UPDATE tags 
      SET name = ? || SUBSTR(name, LENGTH(?) + 1) 
      WHERE user_id = ? AND name LIKE ? || '/%'
    `).bind(newName, oldName, userId, oldName).run();

    // Update Messages (Exact match)
    // Legacy: update string tag on messages. But messages should check user_id.
    // Since we know these tags belong to userId, and messages linked to these tags belong to userId (mostly),
    // but message.tag is a string.
    await db.prepare('UPDATE messages SET tag = ? WHERE user_id = ? AND tag = ?').bind(newName, userId, oldName).run();

    // Update Messages (Children / Hierarchy)
    await db.prepare(`
      UPDATE messages 
      SET tag = ? || SUBSTR(tag, LENGTH(?) + 1) 
      WHERE user_id = ? AND tag LIKE ? || '/%'
    `).bind(newName, oldName, userId, oldName).run();
  },

  /**
   * Delete a tag
   * @param {D1Database} db
   * @param {string} id
   * @param {string} userId
   */
  async deleteTag(db, id, userId) {
    // Prevent deleting system tags (Spam, Sent)
    const tag = await db.prepare('SELECT name FROM tags WHERE id = ? AND user_id = ?').bind(id, userId).first();
    if (tag && (tag.name === 'Spam' || tag.name === 'Sent')) {
      throw new Error(`Cannot delete system tag: ${tag.name}`);
    }
    await db.prepare('DELETE FROM tags WHERE id = ?').bind(id).run();
  },

  // ==================
  // Tagging Rules CRUD
  // ==================

  /**
   * Get all tagging rules ordered by priority
   * @param {D1Database} db
   * @param {string} userId
   */
  async getTaggingRules(db, userId) {
    if (!userId) throw new Error('userId is required');
    const { results } = await db.prepare(
      'SELECT * FROM tagging_rules WHERE user_id = ? ORDER BY priority DESC, created_at ASC'
    ).bind(userId).all();
    return results || [];
  },

  /**
   * Get enabled tagging rules (for matching)
   * @param {D1Database} db
   * @param {string} userId
   */
  async getEnabledTaggingRules(db, userId) {
    if (!userId) throw new Error('userId is required');
    const { results } = await db.prepare(
      'SELECT * FROM tagging_rules WHERE user_id = ? AND is_enabled = 1 ORDER BY priority DESC, created_at ASC'
    ).bind(userId).all();
    return results || [];
  },

  /**
   * Get a tagging rule by ID
   * @param {D1Database} db
   * @param {string} id
   * @param {string} userId
   */
  async getTaggingRule(db, id, userId) {
    let query = 'SELECT * FROM tagging_rules WHERE id = ?';
    const params = [id];
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    return db.prepare(query).bind(...params).first();
  },

  /**
   * Create a new tagging rule
   * @param {D1Database} db
   * @param {Object} rule
   * @param {string} userId
   */
  async createTaggingRule(db, rule, userId) {
    if (!userId) throw new Error('userId is required');

    const id = crypto.randomUUID();
    const now = Date.now();

    await db.prepare(`
      INSERT INTO tagging_rules (
        id, user_id, name, match_from, match_to, match_subject, match_body,
        tag_name, priority, is_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      userId,
      rule.name,
      rule.matchFrom || null,
      rule.matchTo || null,
      rule.matchSubject || null,
      rule.matchBody || null,
      rule.tagName,
      rule.priority ?? 0,
      rule.isEnabled !== false ? 1 : 0,
      now,
      now
    ).run();

    return { id, ...rule, created_at: now, updated_at: now };
  },

  /**
   * Update a tagging rule
   * @param {D1Database} db
   * @param {string} id
   * @param {Object} updates
   * @param {string} userId
   */
  async updateTaggingRule(db, id, updates, userId) {
    const existing = await this.getTaggingRule(db, id, userId);
    if (!existing) throw new Error('Tagging rule not found');

    const now = Date.now();

    await db.prepare(`
      UPDATE tagging_rules SET
        name = ?,
        match_from = ?,
        match_to = ?,
        match_subject = ?,
        match_body = ?,
        tag_name = ?,
        priority = ?,
        is_enabled = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(
      updates.name ?? existing.name,
      updates.matchFrom !== undefined ? (updates.matchFrom || null) : existing.match_from,
      updates.matchTo !== undefined ? (updates.matchTo || null) : existing.match_to,
      updates.matchSubject !== undefined ? (updates.matchSubject || null) : existing.match_subject,
      updates.matchBody !== undefined ? (updates.matchBody || null) : existing.match_body,
      updates.tagName ?? existing.tag_name,
      updates.priority ?? existing.priority,
      updates.isEnabled !== undefined ? (updates.isEnabled ? 1 : 0) : existing.is_enabled,
      now,
      id
    ).run();
  },

  /**
   * Delete a tagging rule
   * @param {D1Database} db
   * @param {string} id
   * @param {string} userId
   */
  async deleteTaggingRule(db, id, userId) {
    let query = 'DELETE FROM tagging_rules WHERE id = ?';
    const params = [id];
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    await db.prepare(query).bind(...params).run();
  },

  /**
   * Match a message against enabled tagging rules
   * Returns the first matching rule's tag, or null if no match
   * @param {D1Database} db
   * @param {Object} message - Message with from_addr, to_addr, subject, text_body, html_body
   * @param {string} userId
   */
  async matchTaggingRules(db, message, userId) {
    if (!userId) throw new Error('userId is required');

    const rules = await this.getEnabledTaggingRules(db, userId);

    // Pre-calculate lowercased values once for performance
    const normalizedMessage = {
      ...message,
      _lower_from: (message.from_addr || '').toLowerCase(),
      _lower_to: (message.to_addr || '').toLowerCase(),
      _lower_subject: (message.subject || '').toLowerCase(),
      _lower_body: (message.text_body || message.html_body || '').toLowerCase()
    };

    for (const rule of rules) {
      if (this.doesRuleMatch(rule, normalizedMessage)) {
        return {
          tag: rule.tag_name,
          ruleId: rule.id,
          ruleName: rule.name,
          confidence: 1.0,
          reason: `Matched rule: ${rule.name}`
        };
      }
    }

    return null;
  },

  /**
   * Check if a rule matches a message
   * All non-null conditions must match (AND logic)
   * @param {Object} rule
   * @param {Object} message
   */
  doesRuleMatch(rule, message) {
    const from = message._lower_from !== undefined ? message._lower_from : (message.from_addr || '').toLowerCase();
    const to = message._lower_to !== undefined ? message._lower_to : (message.to_addr || '').toLowerCase();
    const subject = message._lower_subject !== undefined ? message._lower_subject : (message.subject || '').toLowerCase();
    const body = message._lower_body !== undefined ? message._lower_body : (message.text_body || message.html_body || '').toLowerCase();

    // All specified conditions must match
    if (rule.match_from && !from.includes(rule.match_from.toLowerCase())) {
      return false;
    }
    if (rule.match_to && !to.includes(rule.match_to.toLowerCase())) {
      return false;
    }
    if (rule.match_subject && !subject.includes(rule.match_subject.toLowerCase())) {
      return false;
    }
    if (rule.match_body && !body.includes(rule.match_body.toLowerCase())) {
      return false;
    }

    // At least one condition must be specified
    if (!rule.match_from && !rule.match_to && !rule.match_subject && !rule.match_body) {
      return false;
    }

    return true;
  }
};
