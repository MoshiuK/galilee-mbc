const bcrypt = require('bcryptjs');
const db = require('../db/database');

const authService = {
  register(username, password, fullName) {
    const hash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare(
      'INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?)'
    );
    const result = stmt.run(username.toLowerCase(), hash, fullName);
    return this.findById(result.lastInsertRowid);
  },

  login(username, password) {
    const user = db.prepare('SELECT * FROM users WHERE username = ?')
      .get(username.toLowerCase());
    if (!user) return null;
    if (!bcrypt.compareSync(password, user.password_hash)) return null;
    return { id: user.id, username: user.username, full_name: user.full_name, role: user.role };
  },

  findById(id) {
    const user = db.prepare('SELECT id, username, full_name, role, created_at FROM users WHERE id = ?')
      .get(id);
    return user || null;
  },

  findByUsername(username) {
    return db.prepare('SELECT id, username, full_name, role, created_at FROM users WHERE username = ?')
      .get(username.toLowerCase()) || null;
  },

  getAllUsers() {
    return db.prepare('SELECT id, username, full_name, role FROM users ORDER BY full_name').all();
  }
};

module.exports = authService;
