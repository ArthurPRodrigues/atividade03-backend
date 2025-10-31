const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
class SQLiteDatabase {
  constructor(dbPath = null) {
    this._path = dbPath || path.join("data", "app.db");
    fs.mkdirSync(path.dirname(this._path), { recursive: true });
  }

  connect() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(
        this._path,
        sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
        (err) => {
          if (err) return reject(err);
          db.run("PRAGMA foreign_keys = ON", (prErr) => {
            if (prErr) {
              db.close(() => reject(prErr));
            } else {
              resolve(db);
            }
          });
        }
      );
    });
  }

  async initialize() {
    const sql = `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                telefone TEXT NOT NULL
            );
        `;

    const db = await this.connect();
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        db.close(() => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  }
}

module.exports = { SQLiteDatabase };
