/**
 * D1 helpers — calendar events.
 * Extracted from db.js so the rest of the data layer can stay focused on mail.
 */
export const CalendarDB = {
  async listCalendarEvents(db, rangeStart, rangeEnd) {
    const { results } = await db.prepare(
      'SELECT * FROM calendar_events WHERE start_time < ? AND end_time > ? ORDER BY start_time ASC'
    ).bind(rangeEnd, rangeStart).all();
    return results || [];
  },

  async getCalendarEvent(db, id) {
    return db.prepare('SELECT * FROM calendar_events WHERE id = ?').bind(id).first();
  },

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

  async deleteCalendarEvent(db, id) {
    await db.prepare('DELETE FROM calendar_events WHERE id = ?').bind(id).run();
  }
};
