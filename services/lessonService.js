const db = require('../db/database');

const lessonService = {
  create({ title, scripture_reference, study_date, teacher, age_group, content, status, created_by }) {
    const stmt = db.prepare(`
      INSERT INTO lessons (title, scripture_reference, study_date, teacher, age_group, content, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(title, scripture_reference || null, study_date, teacher || null, age_group || 'adult', content || null, status || 'draft', created_by);
    return this.getById(result.lastInsertRowid);
  },

  getById(id) {
    return db.prepare(`
      SELECT l.*, u.full_name as creator_name
      FROM lessons l
      LEFT JOIN users u ON l.created_by = u.id
      WHERE l.id = ?
    `).get(id) || null;
  },

  getAll(limit) {
    let sql = `
      SELECT l.*, u.full_name as creator_name
      FROM lessons l
      LEFT JOIN users u ON l.created_by = u.id
      ORDER BY l.study_date DESC
    `;
    if (limit) {
      return db.prepare(sql + ' LIMIT ?').all(limit);
    }
    return db.prepare(sql).all();
  },

  getUpcoming(limit = 5) {
    const today = new Date().toISOString().split('T')[0];
    return db.prepare(`
      SELECT l.*, u.full_name as creator_name
      FROM lessons l
      LEFT JOIN users u ON l.created_by = u.id
      WHERE l.study_date >= ? AND l.status = 'published'
      ORDER BY l.study_date ASC
      LIMIT ?
    `).all(today, limit);
  },

  getByAgeGroup(ageGroup) {
    return db.prepare(`
      SELECT l.*, u.full_name as creator_name
      FROM lessons l
      LEFT JOIN users u ON l.created_by = u.id
      WHERE l.age_group = ?
      ORDER BY l.study_date DESC
    `).all(ageGroup);
  },

  update(id, { title, scripture_reference, study_date, teacher, age_group, content, status }) {
    db.prepare(`
      UPDATE lessons
      SET title = ?, scripture_reference = ?, study_date = ?, teacher = ?, age_group = ?, content = ?, status = ?
      WHERE id = ?
    `).run(title, scripture_reference || null, study_date, teacher || null, age_group || 'adult', content || null, status || 'draft', id);
    return this.getById(id);
  },

  delete(id) {
    db.prepare('DELETE FROM lessons WHERE id = ?').run(id);
  }
};

module.exports = lessonService;
