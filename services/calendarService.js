const db = require('../db/database');

const calendarService = {
  create({ title, description, event_date, start_time, end_time, location, category, created_by }) {
    const stmt = db.prepare(`
      INSERT INTO calendar_events (title, description, event_date, start_time, end_time, location, category, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(title, description || null, event_date, start_time || null, end_time || null, location || 'Galilee MBC', category || 'general', created_by);
    return this.getById(result.lastInsertRowid);
  },

  getById(id) {
    return db.prepare(`
      SELECT e.*, u.full_name as creator_name
      FROM calendar_events e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.id = ?
    `).get(id) || null;
  },

  getByMonth(year, month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    return db.prepare(`
      SELECT e.*, u.full_name as creator_name
      FROM calendar_events e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.event_date >= ? AND e.event_date < ?
      ORDER BY e.event_date, e.start_time
    `).all(startDate, endDate);
  },

  getUpcoming(limit = 5) {
    const today = new Date().toISOString().split('T')[0];
    return db.prepare(`
      SELECT e.*, u.full_name as creator_name
      FROM calendar_events e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.event_date >= ?
      ORDER BY e.event_date, e.start_time
      LIMIT ?
    `).all(today, limit);
  },

  update(id, { title, description, event_date, start_time, end_time, location, category }) {
    db.prepare(`
      UPDATE calendar_events
      SET title = ?, description = ?, event_date = ?, start_time = ?, end_time = ?, location = ?, category = ?
      WHERE id = ?
    `).run(title, description || null, event_date, start_time || null, end_time || null, location || 'Galilee MBC', category || 'general', id);
    return this.getById(id);
  },

  delete(id) {
    db.prepare('DELETE FROM calendar_events WHERE id = ?').run(id);
  }
};

module.exports = calendarService;
