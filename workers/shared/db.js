/**
 * D1 Database Helper
 */

// Cache for tags to reduce DB reads
let tagsCache = null;
let tagsCacheTime = 0;
const TAGS_CACHE_TTL = 60 * 1000; // 60 seconds

// Cache for settings to reduce DB reads
let settingsCache = {};
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 60 * 1000; // 60 seconds
const messageColumnsCache = new WeakMap();

// Escapes special characters for SQL LIKE pattern
// Uses backslash as the escape character
const escapeLikePattern = (str) => {
  return str.replace(/[\\%_]/g, '\\$&');
};

const normalizeTagFilterList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(','))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const EMAIL_PATTERN = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/ig;

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const extractEmailAddresses = (input) => {
  if (!input) return [];
  const source = Array.isArray(input) ? input.join(',') : String(input);
  const matches = source.match(EMAIL_PATTERN) || [];
  const unique = [];
  const seen = new Set();

  for (const match of matches) {
    const normalized = normalizeEmail(match);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }

  return unique;
};

const getMessageColumns = async (db) => {
  if (messageColumnsCache.has(db)) {
    return messageColumnsCache.get(db);
  }

  const { results } = await db.prepare('PRAGMA table_info(messages)').all();
  const columns = new Set((results || []).map((row) => row.name));
  messageColumnsCache.set(db, columns);
  return columns;
};

export const DB = {
  /**
   * Insert a new message
   * @param {D1Database} db 
   * @param {Object} message 
   */
  async insertMessage(db, message) {
    const columns = await getMessageColumns(db);
    const entries = [
      ['id', message.id],
      ['received_at', message.received_at],
      ['from_addr', message.from_addr ?? null],
      ['to_addr', message.to_addr ?? null],
      ['subject', message.subject ?? null],
      ['date_header', message.date_header ?? null],
      ['snippet', message.snippet ?? null],
      ['has_attachments', message.has_attachments ? 1 : 0],
      ['raw_r2_key', message.raw_r2_key ?? null],
      ['text_body', message.text_body ?? null],
      ['html_body', message.html_body ?? null],
      ['headers_json', message.headers_json ?? null],
      ['snoozed_until', message.snoozed_until ?? null],
      ['message_id_header', message.message_id_header ?? null],
      ['in_reply_to', message.in_reply_to ?? null],
      ['thread_id', message.thread_id ?? message.id]
    ].filter(([column]) => columns.has(column));

    const query = `
      INSERT INTO messages (${entries.map(([column]) => column).join(', ')})
      VALUES (${entries.map(() => '?').join(', ')})
    `;

    await db.prepare(query).bind(...entries.map(([, value]) => value)).run();
  },

  /**
   * Find the thread_id for a new message based on its In-Reply-To header.
   * Returns the thread_id of the parent, or null if this is a new thread.
   */
  async findThreadId(db, inReplyTo) {
    if (!inReplyTo) return null;
    const columns = await getMessageColumns(db);
    if (!columns.has('message_id_header') || !columns.has('thread_id')) return null;
    const parent = await db.prepare(
      'SELECT thread_id FROM messages WHERE message_id_header = ? LIMIT 1'
    ).bind(inReplyTo).first();
    return parent?.thread_id ?? null;
  },

  async upsertContacts(db, emails, { usedAt = Date.now(), direction = 'inbound' } = {}) {
    const normalizedDirection = direction === 'outbound' ? 'outbound' : 'inbound';
    const uniqueEmails = extractEmailAddresses(emails);
    if (uniqueEmails.length === 0) return;

    const stmt = db.prepare(`
      INSERT INTO contacts (email, first_seen_at, last_used_at, last_direction)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        first_seen_at = MIN(contacts.first_seen_at, excluded.first_seen_at),
        last_used_at = MAX(contacts.last_used_at, excluded.last_used_at),
        last_direction = CASE
          WHEN excluded.last_used_at >= contacts.last_used_at THEN excluded.last_direction
          ELSE contacts.last_direction
        END
    `);

    await db.batch(
      uniqueEmails.map((email) => stmt.bind(email, usedAt, usedAt, normalizedDirection))
    );
  },

  async getContactSuggestions(db, { query = '', limit = 10 } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const searchPattern = `${escapeLikePattern(String(query || '').trim().toLowerCase())}%`;

    const { results } = await db.prepare(`
      SELECT email, display_name, last_used_at, last_direction
      FROM contacts
      WHERE email LIKE ? ESCAPE '\\'
      ORDER BY last_used_at DESC
      LIMIT ?
    `).bind(searchPattern, safeLimit).all();

    return (results || []).map((row) => ({
      email: row.email,
      displayName: row.display_name || null,
      lastUsed: row.last_used_at,
      direction: row.last_direction
    }));
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
   * @param {Object} filters { limit, before, tag, excludeTag, archived }
   */

  async listMessages(db, { limit = 50, before = null, tag = null, excludeTag = null, excludeTags = null, archived = false, search = null, hideSnoozed = false, snoozed = false } = {}) {
    const columns = await getMessageColumns(db);
    const hasThreadId = columns.has('thread_id');
    let query = hasThreadId
      ? 'SELECT m.*, (SELECT COUNT(*) FROM messages m2 WHERE m2.thread_id = m.thread_id AND m2.thread_id IS NOT NULL AND m2.id != m.id) AS thread_reply_count FROM messages m'
      : 'SELECT m.*, 0 AS thread_reply_count FROM messages m';
    const params = [];
    const conditions = [];
    const excludedTags = normalizeTagFilterList(excludeTags?.length ? excludeTags : excludeTag);

    // FTS Join
    if (search) {
      query += ' JOIN messages_fts ON m.rowid = messages_fts.rowid';
      conditions.push('messages_fts MATCH ?');
      // Format search query for FTS5 (phrase or simple)
      // Escape double quotes in search terms to prevent FTS injection
      const sanitizedSearch = search.replace(/"/g, '');
      const ftsQuery = sanitizedSearch.split(/\s+/).filter(s => s.length > 0).map(s => `"${s}"*`).join(' AND ');
      params.push(ftsQuery);
    }

    if (before) {
      conditions.push('m.received_at < ?');
      params.push(before);
    }

    if (tag) {
      conditions.push('EXISTS (SELECT 1 FROM message_tags mt JOIN tags t ON mt.tag_id = t.id WHERE mt.message_id = m.id AND (t.name = ? OR t.name LIKE ? ESCAPE \'\\\'))');
      params.push(tag, `${escapeLikePattern(tag)}/%`);
    }

    if (excludedTags.length > 0) {
      for (const excludedTag of excludedTags) {
        conditions.push('NOT EXISTS (SELECT 1 FROM message_tags mt JOIN tags t ON mt.tag_id = t.id WHERE mt.message_id = m.id AND (t.name = ? OR t.name LIKE ? ESCAPE \'\\\'))');
        params.push(excludedTag, `${escapeLikePattern(excludedTag)}/%`);
      }
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
   * @param {Object} filters { tag, excludeTag, archived, includeArchived, search }
   */
  async countMessages(db, { tag = null, excludeTag = null, excludeTags = null, archived = false, includeArchived = false, search = null } = {}) {
    let query = 'SELECT COUNT(*) as count FROM messages m';
    const params = [];
    const conditions = [];
    const excludedTags = normalizeTagFilterList(excludeTags?.length ? excludeTags : excludeTag);

    if (search) {
      query += ' JOIN messages_fts ON m.rowid = messages_fts.rowid';
      conditions.push('messages_fts MATCH ?');
      const sanitizedSearch = search.replace(/"/g, '');
      const ftsQuery = sanitizedSearch.split(/\s+/).filter(s => s.length > 0).map(s => `"${s}"*`).join(' AND ');
      params.push(ftsQuery);
    }

    if (tag) {
      conditions.push('EXISTS (SELECT 1 FROM message_tags mt JOIN tags t ON mt.tag_id = t.id WHERE mt.message_id = m.id AND (t.name = ? OR t.name LIKE ? ESCAPE \'\\\'))');
      params.push(tag, `${escapeLikePattern(tag)}/%`);
    }

    if (excludedTags.length > 0) {
      for (const excludedTag of excludedTags) {
        conditions.push('NOT EXISTS (SELECT 1 FROM message_tags mt JOIN tags t ON mt.tag_id = t.id WHERE mt.message_id = m.id AND (t.name = ? OR t.name LIKE ? ESCAPE \'\\\'))');
        params.push(excludedTag, `${escapeLikePattern(excludedTag)}/%`);
      }
    }

    if (!includeArchived) {
      if (archived === true) {
        conditions.push('m.is_archived = 1');
      } else if (archived === false) {
        conditions.push('(m.is_archived = 0 OR m.is_archived IS NULL)');
      }
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const row = await db.prepare(query).bind(...params).first();
    return row?.count ?? 0;
  },

  /**
   * Get all message counts in one query
   * @param {D1Database} db
   */
  async getCounts(db) {
    const [archiveRes, unarchivedRes, unreadSpamRes, unreadArchiveRes, unreadInboxRes, tagRes] =
      await db.batch([
        db.prepare(`
          SELECT COUNT(*) as count FROM messages WHERE is_archived = 1
        `),
        db.prepare(`
          SELECT COUNT(*) as count FROM messages
          WHERE (is_archived = 0 OR is_archived IS NULL)
            AND (snoozed_until IS NULL OR snoozed_until <= strftime('%s','now') * 1000)
        `),
        db.prepare(`
          SELECT COUNT(m.id) as count
          FROM messages m
          JOIN message_tags mt ON m.id = mt.message_id
          JOIN tags t ON mt.tag_id = t.id
          WHERE t.name = 'Spam'
            AND (m.is_read = 0 OR m.is_read IS NULL)
        `),
        db.prepare(`
          SELECT COUNT(id) as count FROM messages
          WHERE is_archived = 1
            AND (is_read = 0 OR is_read IS NULL)
        `),
        db.prepare(`
          SELECT COUNT(m.id) as count
          FROM messages m
          LEFT JOIN message_tags mt ON m.id = mt.message_id
          LEFT JOIN tags t ON mt.tag_id = t.id AND t.name = 'Spam'
          LEFT JOIN message_tags mt_sent ON m.id = mt_sent.message_id
          LEFT JOIN tags t_sent ON mt_sent.tag_id = t_sent.id AND t_sent.name = 'Sent'
          WHERE (m.is_archived = 0 OR m.is_archived IS NULL)
            AND (m.snoozed_until IS NULL OR m.snoozed_until <= strftime('%s','now') * 1000)
            AND (m.is_read = 0 OR m.is_read IS NULL)
            AND t.id IS NULL
            AND t_sent.id IS NULL
        `),
        db.prepare(`
          SELECT t.name as tag_name, COUNT(m.id) as count
          FROM messages m
          JOIN message_tags mt ON m.id = mt.message_id
          JOIN tags t ON mt.tag_id = t.id
          WHERE (m.is_archived = 0 OR m.is_archived IS NULL)
            AND (m.snoozed_until IS NULL OR m.snoozed_until <= strftime('%s','now') * 1000)
          GROUP BY t.name
        `),
      ]);

    const archive = archiveRes.results[0]?.count ?? 0;
    const totalUnarchived = unarchivedRes.results[0]?.count ?? 0;
    const unreadSpam = unreadSpamRes.results[0]?.count ?? 0;
    const unreadArchive = unreadArchiveRes.results[0]?.count ?? 0;
    const unreadInbox = unreadInboxRes.results[0]?.count ?? 0;

    const tagCounts = {};
    for (const row of tagRes.results || []) {
      tagCounts[row.tag_name] = row.count;
    }

    const spam = tagCounts['Spam'] || 0;
    const sent = tagCounts['Sent'] || 0;
    // Inbox = Unarchived - Unarchived Spam - Unarchived Sent
    const inbox = Math.max(0, totalUnarchived - spam - sent);

    return {
      inbox,
      archive,
      spam,
      unreadSpam,
      unreadArchive,
      unreadInbox,
      sent,
      tagCounts
    };
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
   * Archive all non-archived messages in a mailbox
   * @param {D1Database} db
   * @param {object} opts
   * @param {string|null} opts.tag - tag name to filter by, or null for inbox (excludes Spam)
   */
  async archiveAllMessages(db, { tag } = {}) {
    if (tag === null || tag === undefined) {
      // Inbox: archive all non-archived messages that are not tagged Spam/Sent
      await db.prepare(`
        UPDATE messages SET is_archived = 1
        WHERE (is_archived = 0 OR is_archived IS NULL)
          AND id NOT IN (
            SELECT mt.message_id FROM message_tags mt
            JOIN tags t ON mt.tag_id = t.id
            WHERE t.name IN ('Spam', 'Sent')
          )
      `).run();
    } else {
      // Specific tag: archive all non-archived messages with that tag
      await db.prepare(`
        UPDATE messages SET is_archived = 1
        WHERE (is_archived = 0 OR is_archived IS NULL)
          AND id IN (
            SELECT mt.message_id FROM message_tags mt
            JOIN tags t ON mt.tag_id = t.id
            WHERE t.name = ?
          )
      `).bind(tag).run();
    }
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
   * Snooze a message until a future timestamp
   * @param {D1Database} db
   * @param {string} id
   * @param {number} until
   */
  async snoozeMessage(db, id, until) {
    await db.prepare('UPDATE messages SET snoozed_until = ? WHERE id = ?').bind(until, id).run();
  },

  /**
   * Clear snooze on a message
   * @param {D1Database} db
   * @param {string} id
   */
  async unsnoozeMessage(db, id) {
    await db.prepare('UPDATE messages SET snoozed_until = NULL WHERE id = ?').bind(id).run();
  },

  /**
   * Get messages whose snooze time has passed and clear their snooze.
   * Returns the woken messages so notifications can be sent.
   * @param {D1Database} db
   * @param {number} now - current timestamp in ms
   */
  async wakeUpSnoozedMessages(db, now) {
    const { results } = await db.prepare(
      'SELECT id, subject, from_addr, snippet FROM messages WHERE snoozed_until IS NOT NULL AND snoozed_until <= ?'
    ).bind(now).all();
    if (results.length > 0) {
      const ids = results.map(m => `'${m.id}'`).join(',');
      await db.prepare(`UPDATE messages SET snoozed_until = NULL WHERE id IN (${ids})`).run();
    }
    return results || [];
  },

  /**
   * Mark a message as read
   * @param {D1Database} db
   * @param {string} id
   */
  async markRead(db, id) {
    await db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').bind(id).run();
  },

  /**
   * Mark all messages in a mailbox as read
   * @param {D1Database} db
   * @param {object} opts
   * @param {string|null} opts.tag - tag name or null for inbox (excludes Spam)
   */
  async markAllRead(db, { tag } = {}) {
    if (tag === null || tag === undefined) {
      await db.prepare(`
        UPDATE messages SET is_read = 1
        WHERE (is_read = 0 OR is_read IS NULL)
          AND (is_archived = 0 OR is_archived IS NULL)
          AND id NOT IN (
            SELECT mt.message_id FROM message_tags mt
            JOIN tags t ON mt.tag_id = t.id
            WHERE t.name IN ('Spam', 'Sent')
          )
      `).run();
    } else {
      await db.prepare(`
        UPDATE messages SET is_read = 1
        WHERE (is_read = 0 OR is_read IS NULL)
          AND id IN (
            SELECT mt.message_id FROM message_tags mt
            JOIN tags t ON mt.tag_id = t.id
            WHERE t.name = ?
          )
      `).bind(tag).run();
    }
  },

  /**
   * Update Todoist info for a message
   * @param {D1Database} db
   * @param {string} id
   * @param {Object} info
   */
  async updateTodoistInfo(db, id, { projectName = null, projectUrl = null } = {}) {
    await db.prepare(`
      UPDATE messages
      SET todoist_project_name = ?, todoist_project_url = ?
      WHERE id = ?
    `).bind(
      projectName,
      projectUrl,
      id
    ).run();
  },

  /**
   * Get full message detail
   * @param {D1Database} db 
   * @param {string} id 
   */
  async getMessage(db, id) {
    if (!id) return null;
    
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
      attachments: attachments || [],
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

    const uniqueTags = [...new Set(tags || [])].filter(t => t && t.trim().length > 0);

    if (uniqueTags.length === 0) {
      await db.prepare('UPDATE messages SET tag = NULL WHERE id = ?').bind(messageId).run();
      return;
    }

    // 1. Resolve Tag IDs
    const placeholders = uniqueTags.map(() => '?').join(',');
    const { results: existing } = await db.prepare(`SELECT id, name FROM tags WHERE name IN (${placeholders})`)
      .bind(...uniqueTags)
      .all();

    const existingMap = new Map((existing || []).map(t => [t.name, t.id]));
    const missingNames = uniqueTags.filter(name => !existingMap.has(name));

    // Create missing tags
    if (missingNames.length > 0) {
      const createStmt = db.prepare('INSERT OR IGNORE INTO tags (id, name, created_at) VALUES (?, ?, ?)');
      const now = Date.now();
      await db.batch(missingNames.map(name =>
        createStmt.bind(crypto.randomUUID(), name, now)
      ));

      // Invalidate cache
      tagsCache = null;

      // Fetch IDs for the newly created tags
      const missingPlaceholders = missingNames.map(() => '?').join(',');
      const { results: newTags } = await db.prepare(`SELECT id, name FROM tags WHERE name IN (${missingPlaceholders})`)
        .bind(...missingNames)
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
    const now = Date.now();
    if (tagsCache && (now - tagsCacheTime < TAGS_CACHE_TTL)) {
      return tagsCache;
    }

    const { results } = await db.prepare('SELECT * FROM tags ORDER BY created_at DESC').all();
    let finalResults = results || [];

    // Ensure 'Spam' tag always exists
    const spamTag = finalResults.find(t => t.name === 'Spam');
    if (!spamTag) {
      const id = crypto.randomUUID();
      await db.prepare('INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)')
        .bind(id, 'Spam', 0)
        .run();
      finalResults = [...finalResults, { id, name: 'Spam', created_at: 0 }];
    }

    // Ensure 'Sent' tag always exists
    const sentTag = finalResults.find(t => t.name === 'Sent');
    if (!sentTag) {
      const id = crypto.randomUUID();
      await db.prepare('INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)')
        .bind(id, 'Sent', 0)
        .run();
      finalResults = [...finalResults, { id, name: 'Sent', created_at: 0 }];
    }

    // Update cache
    tagsCache = finalResults;
    tagsCacheTime = now;

    return finalResults;
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

    // Invalidate cache
    tagsCache = null;

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
      WHERE name LIKE ? || '/%' ESCAPE '\\'
    `).bind(newName, oldName, escapeLikePattern(oldName)).run();

    // Update Messages (Exact match)
    await db.prepare('UPDATE messages SET tag = ? WHERE tag = ?').bind(newName, oldName).run();

    // Update Messages (Children / Hierarchy)
    // Replace prefix match
    await db.prepare(`
      UPDATE messages 
      SET tag = ? || SUBSTR(tag, LENGTH(?) + 1) 
      WHERE tag LIKE ? || '/%' ESCAPE '\\'
    `).bind(newName, oldName, escapeLikePattern(oldName)).run();

    // Invalidate cache
    tagsCache = null;
  },

  /**
   * Delete a tag
   * @param {D1Database} db
   * @param {string} id
   */
  async deleteTag(db, id) {
    // Prevent deleting system tags (Spam, Sent)
    const tag = await db.prepare('SELECT name FROM tags WHERE id = ?').bind(id).first();
    if (tag && (tag.name === 'Spam' || tag.name === 'Sent')) {
      throw new Error(`Cannot delete system tag: ${tag.name}`);
    }
    await db.prepare('DELETE FROM tags WHERE id = ?').bind(id).run();

    // Invalidate cache
    tagsCache = null;
  },

  // ==================
  // Tagging Rules CRUD
  // ==================

  /**
   * Get all tagging rules ordered by priority
   * @param {D1Database} db
   */
  async getTaggingRules(db) {
    const { results } = await db.prepare(
      'SELECT * FROM tagging_rules ORDER BY priority DESC, created_at ASC'
    ).all();
    return results || [];
  },

  /**
   * Get enabled tagging rules (for matching)
   * @param {D1Database} db
   */
  async getEnabledTaggingRules(db) {
    const { results } = await db.prepare(
      'SELECT * FROM tagging_rules WHERE is_enabled = 1 ORDER BY priority DESC, created_at ASC'
    ).all();
    return results || [];
  },

  /**
   * Get a tagging rule by ID
   * @param {D1Database} db
   * @param {string} id
   */
  async getTaggingRule(db, id) {
    return db.prepare('SELECT * FROM tagging_rules WHERE id = ?').bind(id).first();
  },

  /**
   * Create a new tagging rule
   * @param {D1Database} db
   * @param {Object} rule
   */
  async createTaggingRule(db, rule) {
    const id = crypto.randomUUID();
    const now = Date.now();

    await db.prepare(`
      INSERT INTO tagging_rules (
        id, name, match_from, match_to, match_subject, match_body,
        tag_name, priority, is_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
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
   */
  async updateTaggingRule(db, id, updates) {
    const existing = await this.getTaggingRule(db, id);
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
   */
  async deleteTaggingRule(db, id) {
    await db.prepare('DELETE FROM tagging_rules WHERE id = ?').bind(id).run();
  },

  /**
   * Match a message against enabled tagging rules
   * Returns the first matching rule's tag, or null if no match
   * @param {D1Database} db
   * @param {Object} message - Message with from_addr, to_addr, subject, text_body, html_body
   */
  async matchTaggingRules(db, message) {
    const rules = await this.getEnabledTaggingRules(db);

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
  },

  // ==================
  // Auto Response Rules CRUD
  // ==================

  async getAutoResponseRules(db) {
    const { results } = await db.prepare(
      'SELECT * FROM auto_response_rules ORDER BY created_at ASC'
    ).all();
    return results || [];
  },

  async getEnabledAutoResponseRules(db) {
    const { results } = await db.prepare(
      'SELECT * FROM auto_response_rules WHERE is_enabled = 1 ORDER BY created_at ASC'
    ).all();
    return results || [];
  },

  async getAutoResponseRule(db, id) {
    return db.prepare('SELECT * FROM auto_response_rules WHERE id = ?').bind(id).first();
  },

  async createAutoResponseRule(db, rule) {
    const id = crypto.randomUUID();
    const now = Date.now();

    await db.prepare(`
      INSERT INTO auto_response_rules (
        id, name, match_tag, match_text, reply_subject, reply_body,
        is_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      rule.name,
      rule.matchTag || null,
      rule.matchText || null,
      rule.replySubject || null,
      rule.replyBody,
      rule.isEnabled !== false ? 1 : 0,
      now,
      now
    ).run();

    return { id, ...rule, created_at: now, updated_at: now };
  },

  async updateAutoResponseRule(db, id, updates) {
    const existing = await this.getAutoResponseRule(db, id);
    if (!existing) throw new Error('Auto-response rule not found');

    const now = Date.now();

    await db.prepare(`
      UPDATE auto_response_rules SET
        name = ?,
        match_tag = ?,
        match_text = ?,
        reply_subject = ?,
        reply_body = ?,
        is_enabled = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(
      updates.name ?? existing.name,
      updates.matchTag !== undefined ? (updates.matchTag || null) : existing.match_tag,
      updates.matchText !== undefined ? (updates.matchText || null) : existing.match_text,
      updates.replySubject !== undefined ? (updates.replySubject || null) : existing.reply_subject,
      updates.replyBody ?? existing.reply_body,
      updates.isEnabled !== undefined ? (updates.isEnabled ? 1 : 0) : existing.is_enabled,
      now,
      id
    ).run();
  },

  async deleteAutoResponseRule(db, id) {
    await db.prepare('DELETE FROM auto_response_rules WHERE id = ?').bind(id).run();
  },

  /**
   * Find auto-response rules that match a message.
   * @param {D1Database} db
   * @param {Object} message - { subject, text_body, html_body, tags }
   * @returns {Promise<Array>} matching rule rows
   */
  async matchAutoResponseRules(db, message) {
    const rules = await this.getEnabledAutoResponseRules(db);
    if (rules.length === 0) return [];

    const subject = (message.subject || '').toLowerCase();
    const body = (message.text_body || message.html_body || '').toLowerCase();
    const haystack = `${subject}\n${body}`;
    const messageTags = Array.isArray(message.tags) ? message.tags.map((t) => String(t).toLowerCase()) : [];

    const matched = [];
    for (const rule of rules) {
      const hasTag = !!rule.match_tag;
      const hasText = !!rule.match_text;
      if (!hasTag && !hasText) continue; // require at least one criterion

      if (hasTag && !messageTags.includes(String(rule.match_tag).toLowerCase())) {
        continue;
      }
      if (hasText && !haystack.includes(String(rule.match_text).toLowerCase())) {
        continue;
      }
      matched.push(rule);
    }

    return matched;
  },

  // ==================
  // Settings Helpers
  // ==================

  /**
   * Get a setting value
   * @param {D1Database} db
   * @param {string} key
   * @returns {Promise<string|null>}
   */
  async getSetting(db, key) {
    const now = Date.now();
    if (settingsCache[key] !== undefined && (now - settingsCacheTime < SETTINGS_CACHE_TTL)) {
      return settingsCache[key];
    }

    const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
    const value = row ? row.value : null;

    // Invalidate if TTL expired, otherwise just add to cache
    if (now - settingsCacheTime >= SETTINGS_CACHE_TTL) {
      settingsCache = {};
    }
    settingsCache[key] = value;
    settingsCacheTime = now;

    return value;
  },

  /**
   * Set a setting value
   * @param {D1Database} db
   * @param {string} key
   * @param {string} value
   */
  async setSetting(db, key, value) {
    await db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).bind(key, value, Date.now()).run();

    // Update cache
    settingsCache[key] = value;
    settingsCacheTime = Date.now();
  },

  // ==================
  // Retention Helpers
  // ==================

  /**
   * Get messages older than a specific timestamp for retention policy
   * @param {D1Database} db
   * @param {number} cutoffTimestamp
   * @param {number} limit
   */
  async getMessagesForRetention(db, cutoffTimestamp, limit = 50) {
    const { results } = await db.prepare(
      'SELECT id, raw_r2_key FROM messages WHERE received_at < ? ORDER BY received_at ASC LIMIT ?'
    ).bind(cutoffTimestamp, limit).all();
    return results || [];
  },

  /**
   * Get attachments for a list of message IDs
   * @param {D1Database} db
   * @param {string[]} messageIds
   */
  async getAttachmentsForMessages(db, messageIds) {
    if (!messageIds || messageIds.length === 0) return [];

    // SQLite limits variables, so we might need to batch if messageIds is huge.
    // Assuming limit=50 from getMessagesForRetention, it's fine.
    const placeholders = messageIds.map(() => '?').join(',');
    const { results } = await db.prepare(
      `SELECT r2_key FROM attachments WHERE message_id IN (${placeholders})`
    ).bind(...messageIds).all();

    return results ? results.map(r => r.r2_key) : [];
  },

  /**
   * Delete messages by ID (and cascading attachments)
   * @param {D1Database} db
   * @param {string[]} messageIds
   */
  async deleteMessages(db, messageIds) {
    if (!messageIds || messageIds.length === 0) return;

    const placeholders = messageIds.map(() => '?').join(',');
    await db.prepare(
      `DELETE FROM messages WHERE id IN (${placeholders})`
    ).bind(...messageIds).run();
  },

  /**
   * Delete dedupe entries for message IDs
   * @param {D1Database} db
   * @param {string[]} messageIds
   */
  async deleteDedupeForMessages(db, messageIds) {
    if (!messageIds || messageIds.length === 0) return;

    const placeholders = messageIds.map(() => '?').join(',');
    await db.prepare(
      `DELETE FROM dedupe WHERE message_id IN (${placeholders})`
    ).bind(...messageIds).run();
  },

  // ==================
  // Calendar Events
  // ==================

  /**
   * List calendar events within a time range
   * @param {D1Database} db
   * @param {number} rangeStart - Unix ms timestamp
   * @param {number} rangeEnd - Unix ms timestamp
   */
  async listCalendarEvents(db, rangeStart, rangeEnd) {
    const { results } = await db.prepare(
      'SELECT * FROM calendar_events WHERE start_time < ? AND end_time > ? ORDER BY start_time ASC'
    ).bind(rangeEnd, rangeStart).all();
    return results || [];
  },

  /**
   * Get a single calendar event
   * @param {D1Database} db
   * @param {string} id
   */
  async getCalendarEvent(db, id) {
    return db.prepare('SELECT * FROM calendar_events WHERE id = ?').bind(id).first();
  },

  /**
   * Create a calendar event
   * @param {D1Database} db
   * @param {Object} event
   */
  async createCalendarEvent(db, event) {
    const id = crypto.randomUUID();
    const now = Date.now();
    await db.prepare(`
      INSERT INTO calendar_events (id, title, description, start_time, end_time, all_day, color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      event.title,
      event.description || null,
      event.startTime,
      event.endTime,
      event.allDay ? 1 : 0,
      event.color || null,
      now,
      now
    ).run();
    return { id, ...event, created_at: now, updated_at: now };
  },

  /**
   * Update a calendar event
   * @param {D1Database} db
   * @param {string} id
   * @param {Object} updates
   */
  async updateCalendarEvent(db, id, updates) {
    const existing = await this.getCalendarEvent(db, id);
    if (!existing) throw new Error('Calendar event not found');

    const now = Date.now();
    await db.prepare(`
      UPDATE calendar_events SET
        title = ?, description = ?, start_time = ?, end_time = ?,
        all_day = ?, color = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      updates.title ?? existing.title,
      updates.description !== undefined ? (updates.description || null) : existing.description,
      updates.startTime ?? existing.start_time,
      updates.endTime ?? existing.end_time,
      updates.allDay !== undefined ? (updates.allDay ? 1 : 0) : existing.all_day,
      updates.color !== undefined ? (updates.color || null) : existing.color,
      now,
      id
    ).run();
    return { id, updated_at: now };
  },

  /**
   * Delete a calendar event
   * @param {D1Database} db
   * @param {string} id
   */
  async deleteCalendarEvent(db, id) {
    await db.prepare('DELETE FROM calendar_events WHERE id = ?').bind(id).run();
  }
};
