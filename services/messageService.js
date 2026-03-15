const db = require('../db/database');

const messageService = {
  send({ sender_id, recipient_id, subject, body }) {
    const stmt = db.prepare(`
      INSERT INTO messages (sender_id, recipient_id, subject, body)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(sender_id, recipient_id, subject, body);
    return this.getById(result.lastInsertRowid);
  },

  getById(id) {
    return db.prepare(`
      SELECT m.*, s.full_name as sender_name, r.full_name as recipient_name
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.recipient_id = r.id
      WHERE m.id = ?
    `).get(id) || null;
  },

  getInbox(userId) {
    return db.prepare(`
      SELECT m.*, s.full_name as sender_name, r.full_name as recipient_name
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.recipient_id = r.id
      WHERE m.recipient_id = ?
      ORDER BY m.created_at DESC
    `).all(userId);
  },

  getSent(userId) {
    return db.prepare(`
      SELECT m.*, s.full_name as sender_name, r.full_name as recipient_name
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.recipient_id = r.id
      WHERE m.sender_id = ?
      ORDER BY m.created_at DESC
    `).all(userId);
  },

  getConversation(userId, otherUserId) {
    // Mark incoming messages as read
    db.prepare(`
      UPDATE messages SET read = 1
      WHERE sender_id = ? AND recipient_id = ? AND read = 0
    `).run(otherUserId, userId);

    return db.prepare(`
      SELECT m.*, s.full_name as sender_name, r.full_name as recipient_name
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.recipient_id = r.id
      WHERE (m.sender_id = ? AND m.recipient_id = ?)
         OR (m.sender_id = ? AND m.recipient_id = ?)
      ORDER BY m.created_at ASC
    `).all(userId, otherUserId, otherUserId, userId);
  },

  getUnreadCount(userId) {
    const row = db.prepare('SELECT COUNT(*) as count FROM messages WHERE recipient_id = ? AND read = 0').get(userId);
    return row ? row.count : 0;
  },

  markRead(id, userId) {
    db.prepare('UPDATE messages SET read = 1 WHERE id = ? AND recipient_id = ?').run(id, userId);
  }
};

module.exports = messageService;
