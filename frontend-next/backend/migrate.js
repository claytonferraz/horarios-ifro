const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./horarios.db');

db.serialize(() => {
  db.get("SELECT * FROM users LIMIT 1", (err, adminUser) => {
    db.run("DROP TABLE IF EXISTS teachers;");
    db.run("DROP TABLE IF EXISTS users;");
    db.run(`CREATE TABLE users (
      siape TEXT PRIMARY KEY,
      nome_completo TEXT,
      nome_exibicao TEXT,
      email TEXT UNIQUE,
      senha_hash TEXT,
      status TEXT DEFAULT 'ativo',
      perfis TEXT DEFAULT '[]',
      atua_como_docente INTEGER DEFAULT 1
    )`, (err) => {
      if (err) {
        console.error(err);
      } else {
        if (adminUser) {
          db.run("INSERT INTO users (siape, nome_completo, nome_exibicao, email, senha_hash, perfis, atua_como_docente) VALUES (?, ?, ?, ?, ?, ?, ?)",
          ['admin', 'Administrador do Sistema', 'Admin', adminUser.username, adminUser.password_hash, '["admin"]', 0]);
        }
        console.log("Migration done");
      }
      db.close();
    });
  });
});
