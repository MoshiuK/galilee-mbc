const db = require('../db/database');

const churchMessageService = {
  create({ sender_id, title, body, category, pinned }) {
    const stmt = db.prepare(`
      INSERT INTO church_messages (sender_id, title, body, category, pinned)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(sender_id, title, body, category || 'announcement', pinned ? 1 : 0);
    return this.getById(result.lastInsertRowid);
  },

  getById(id) {
    return db.prepare(`
      SELECT cm.*, u.full_name as sender_name
      FROM church_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.id = ?
    `).get(id) || null;
  },

  getAll(limit = 50) {
    return db.prepare(`
      SELECT cm.*, u.full_name as sender_name
      FROM church_messages cm
      JOIN users u ON cm.sender_id = u.id
      ORDER BY cm.pinned DESC, cm.created_at DESC
      LIMIT ?
    `).all(limit);
  },

  getByCategory(category) {
    return db.prepare(`
      SELECT cm.*, u.full_name as sender_name
      FROM church_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.category = ?
      ORDER BY cm.pinned DESC, cm.created_at DESC
    `).all(category);
  },

  togglePin(id) {
    db.prepare('UPDATE church_messages SET pinned = CASE WHEN pinned = 1 THEN 0 ELSE 1 END WHERE id = ?').run(id);
    return this.getById(id);
  },

  delete(id) {
    db.prepare('DELETE FROM church_messages WHERE id = ?').run(id);
  }
};

module.exports = churchMessageService;
