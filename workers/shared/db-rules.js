/**
 * D1 helpers — tagging rules and auto-response rules.
 * Self-contained: no dependencies on the rest of the data layer.
 */
export const RulesDB = {
  // ==================
  // Tagging Rules CRUD
  // ==================

  async getTaggingRules(db) {
    const { results } = await db.prepare(
      'SELECT * FROM tagging_rules ORDER BY priority DESC, created_at ASC'
    ).all();
    return results || [];
  },

  async getEnabledTaggingRules(db) {
    const { results } = await db.prepare(
      'SELECT * FROM tagging_rules WHERE is_enabled = 1 ORDER BY priority DESC, created_at ASC'
    ).all();
    return results || [];
  },

  async getTaggingRule(db, id) {
    return db.prepare('SELECT * FROM tagging_rules WHERE id = ?').bind(id).first();
  },

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

  async deleteTaggingRule(db, id) {
    await db.prepare('DELETE FROM tagging_rules WHERE id = ?').bind(id).run();
  },

  /**
   * Match a message against enabled tagging rules.
   * Returns the first matching rule's tag, or null if no match.
   */
  async matchTaggingRules(db, message) {
    const rules = await this.getEnabledTaggingRules(db);

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

  doesRuleMatch(rule, message) {
    const from = message._lower_from !== undefined ? message._lower_from : (message.from_addr || '').toLowerCase();
    const to = message._lower_to !== undefined ? message._lower_to : (message.to_addr || '').toLowerCase();
    const subject = message._lower_subject !== undefined ? message._lower_subject : (message.subject || '').toLowerCase();
    const body = message._lower_body !== undefined ? message._lower_body : (message.text_body || message.html_body || '').toLowerCase();

    if (rule.match_from && !from.includes(rule.match_from.toLowerCase())) return false;
    if (rule.match_to && !to.includes(rule.match_to.toLowerCase())) return false;
    if (rule.match_subject && !subject.includes(rule.match_subject.toLowerCase())) return false;
    if (rule.match_body && !body.includes(rule.match_body.toLowerCase())) return false;

    if (!rule.match_from && !rule.match_to && !rule.match_subject && !rule.match_body) return false;

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
   * Returns matching rule rows (rules require at least one of match_tag / match_text to be set).
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
      if (!hasTag && !hasText) continue;

      if (hasTag && !messageTags.includes(String(rule.match_tag).toLowerCase())) continue;
      if (hasText && !haystack.includes(String(rule.match_text).toLowerCase())) continue;
      matched.push(rule);
    }

    return matched;
  }
};
