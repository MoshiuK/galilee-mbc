const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'galilee.db');

// Wrapper that provides a better-sqlite3-compatible synchronous API over sql.js
class DatabaseWrapper {
  constructor() {
    this.db = null;
    this._ready = false;
  }

  async init() {
    const SQL = await initSqlJs();

    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    // Run schema
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    this.db.run(schema);
    this._save();
    this._ready = true;
  }

  _save() {
    const data = this.db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }

  prepare(sql) {
    const db = this.db;
    const save = () => this._save();

    return {
      run(...params) {
        db.run(sql, params);
        save();
        const lastId = db.exec('SELECT last_insert_rowid() as id')[0];
        const changes = db.getRowsModified();
        return {
          lastInsertRowid: lastId ? lastId.values[0][0] : 0,
          changes
        };
      },
      get(...params) {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const cols = stmt.getColumnNames();
          const vals = stmt.get();
          stmt.free();
          const row = {};
          cols.forEach((c, i) => { row[c] = vals[i]; });
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params) {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        const cols = stmt.getColumnNames();
        while (stmt.step()) {
          const vals = stmt.get();
          const row = {};
          cols.forEach((c, i) => { row[c] = vals[i]; });
          rows.push(row);
        }
        stmt.free();
        return rows;
      }
    };
  }

  exec(sql) {
    this.db.run(sql);
    this._save();
  }
}

const wrapper = new DatabaseWrapper();

module.exports = wrapper;
