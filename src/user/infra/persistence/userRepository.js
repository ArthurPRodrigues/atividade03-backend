const { SQLiteDatabase } = require("./user_sqlite");
const User = require("../../user");

class UserRepository {
  constructor(dbPath = null) {
    this.database = new SQLiteDatabase(dbPath);
  }

  async save(user) {
    await this.database.initialize();
    const db = await this.database.connect();

    const sql = `INSERT INTO users (name, email, telefone) VALUES (?, ?, ?)`;
    return new Promise((resolve, reject) => {
      db.run(
        sql,
        [user.getName(), user.getEmail(), user.getTelefone()],
        function (err) {
          db.close(() => {
            resolve({
              id: this.lastID,
              name: user.getName(),
              email: user.getEmail(),
              telefone: user.getTelefone(),
            });
          });
        }
      );
    });
  }

  async findByEmail(email) {
    await this.database.initialize();
    const db = await this.database.connect();

    const sql = `SELECT id, name, email, telefone FROM users WHERE email = ? LIMIT 1`;
    return new Promise((resolve, reject) => {
      db.get(sql, [email], (err, row) => {
        db.close(() => {
          if (err) return reject(err);
          if (!row) return resolve(null);
          resolve(row);
        });
      });
    });
  }
}

module.exports = UserRepository;
