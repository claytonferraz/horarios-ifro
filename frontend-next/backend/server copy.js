const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());

// Aumento do limite para 50mb para suportar o arquivo gigante do "Padrão Anual"
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const JWT_SECRET = 'SUA_CHAVE_SECRETA_AQUI_MUITO_SEGURA_2026';
const db = new sqlite3.Database('./horarios.db');

// ==========================================
// CONTROLE DE SMART POLLING
// ==========================================
// Registra o tempo exato da última alteração no banco. 
// O frontend pergunta essa variável a cada 5 min para saber se precisa baixar os dados.
let lastUpdateTimestamp = Date.now();

// ==========================================
// CRIAÇÃO DAS TABELAS NO SQLITE
// ==========================================
db.serialize(() => {
  // Tabelas Base
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    week TEXT,
    type TEXT,
    fileName TEXT,
    records TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY,
    disabledWeeks TEXT
  )`);
  
  // Novas Tabelas para a Gestão Acadêmica (Admin)
  db.run(`CREATE TABLE IF NOT EXISTS discipline_meta (
    id TEXT PRIMARY KEY,
    suapHours INTEGER
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS subject_hours (
    id TEXT PRIMARY KEY,
    totalHours INTEGER
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS academic_years (
    year TEXT PRIMARY KEY,
    totalDays INTEGER,
    currentDays INTEGER
  )`);
});

// Middleware de Proteção (Segurança com JWT)
const verifyToken = (req, res, next) => {
  const bearerHeader = req.headers['authorization'];
  if (!bearerHeader) return res.status(403).json({ error: 'Acesso negado.' });
  const token = bearerHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Sessão expirada.' });
    req.userId = decoded.id;
    next();
  });
};

// ==========================================
// ROTA PÚBLICA DE STATUS (Para o Frontend)
// ==========================================
app.get('/api/status', (req, res) => {
  res.json({ lastUpdate: lastUpdateTimestamp });
});

// ==========================================
// ROTAS DE AUTENTICAÇÃO (Login / Criação)
// ==========================================
app.get('/api/auth/setup', (req, res) => {
  db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ needsSetup: row.count === 0 });
  });
});

app.post('/api/auth/setup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || password.length < 4) return res.status(400).json({ error: "Credenciais inválidas." });
  
  db.get("SELECT COUNT(*) as count FROM users", async (err, row) => {
    if (row.count > 0) return res.status(403).json({ error: "O administrador mestre já foi configurado." });
    
    const hash = await bcrypt.hash(password, 10);
    db.run("INSERT INTO users (username, password_hash) VALUES (?, ?)", [username, hash], function(err) {
      if (err) return res.status(500).json({ error: "Erro ao criar admin." });
      res.json({ message: "Admin criado com sucesso." });
    });
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: "Usuário ou senha incorretos." });
    
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(401).json({ error: "Usuário ou senha incorretos." });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token });
  });
});

app.post('/api/auth/change-password', verifyToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: "Nova senha muito curta." });

  db.get("SELECT * FROM users WHERE id = ?", [req.userId], async (err, user) => {
    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
    
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) return res.status(401).json({ error: "Senha atual incorreta." });

    const newHash = await bcrypt.hash(newPassword, 10);
    db.run("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, req.userId], (err) => {
      if (err) return res.status(500).json({ error: "Erro ao atualizar senha." });
      res.json({ message: "Senha atualizada com sucesso." });
    });
  });
});

app.post('/api/auth/register', verifyToken, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || password.length < 4) return res.status(400).json({ error: "Dados inválidos." });

  const hash = await bcrypt.hash(password, 10);
  db.run("INSERT INTO users (username, password_hash) VALUES (?, ?)", [username, hash], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) return res.status(400).json({ error: "Usuário já existe." });
      return res.status(500).json({ error: "Erro ao criar usuário." });
    }
    res.json({ message: "Usuário criado com sucesso." });
  });
});

// ==========================================
// ROTAS DE HORÁRIOS
// ==========================================
app.get('/api/schedules', (req, res) => {
  db.all("SELECT * FROM schedules", (err, rows) => {
    res.json(rows || []);
  });
});

app.get('/api/config', (req, res) => {
  db.get("SELECT disabledWeeks FROM config WHERE id = 1", (err, row) => {
    if (row && row.disabledWeeks) res.json({ disabledWeeks: JSON.parse(row.disabledWeeks) });
    else res.json({ disabledWeeks: [] });
  });
});

app.post('/api/schedules', verifyToken, (req, res) => {
  const { id, week, type, fileName, records } = req.body;
  db.run(`INSERT OR REPLACE INTO schedules (id, week, type, fileName, records) VALUES (?, ?, ?, ?, ?)`, 
    [id, week, type, fileName, records], 
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      lastUpdateTimestamp = Date.now(); // Dispara o Smart Polling do front
      res.json({ success: true });
    }
  );
});

app.delete('/api/schedules/:id', verifyToken, (req, res) => {
  const id = req.params.id; 
  db.run("DELETE FROM schedules WHERE id = ?", [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    lastUpdateTimestamp = Date.now(); // Dispara o Smart Polling do front
    res.json({ success: true });
  });
});

app.put('/api/config', verifyToken, (req, res) => {
  const { disabledWeeks } = req.body;
  db.run(`INSERT OR REPLACE INTO config (id, disabledWeeks) VALUES (1, ?)`, 
    [JSON.stringify(disabledWeeks)], 
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      lastUpdateTimestamp = Date.now(); // Dispara o Smart Polling do front
      res.json({ success: true });
    }
  );
});

// ==========================================
// ROTAS GESTÃO ACADÊMICA (ADMIN)
// ==========================================

// --- SUAP: Vinculado à Turma/Disciplina ---
app.get('/api/admin/disciplines', verifyToken, (req, res) => {
  db.all("SELECT * FROM discipline_meta", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const map = {};
    (rows || []).forEach(r => { map[r.id] = { suapHours: r.suapHours }; });
    res.json(map);
  });
});

app.put('/api/admin/disciplines', verifyToken, (req, res) => {
  const { id, suapHours } = req.body;
  db.run(`INSERT OR REPLACE INTO discipline_meta (id, suapHours) VALUES (?, ?)`,
    [id, suapHours || null],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      lastUpdateTimestamp = Date.now(); // Dispara o Smart Polling do front
      res.json({ success: true });
    }
  );
});

// --- CARGA HORÁRIA TOTAL: Compartilhado pela Série/Disciplina ---
app.get('/api/admin/subject-hours', verifyToken, (req, res) => {
  db.all("SELECT * FROM subject_hours", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const map = {};
    (rows || []).forEach(r => { map[r.id] = { totalHours: r.totalHours }; });
    res.json(map);
  });
});

app.put('/api/admin/subject-hours', verifyToken, (req, res) => {
  const { id, totalHours } = req.body;
  db.run(`INSERT OR REPLACE INTO subject_hours (id, totalHours) VALUES (?, ?)`,
    [id, totalHours || null],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      lastUpdateTimestamp = Date.now(); // Dispara o Smart Polling do front
      res.json({ success: true });
    }
  );
});

// --- CONTROLE DE ANO LETIVO ---
app.get('/api/admin/academic-years', verifyToken, (req, res) => {
  db.all("SELECT * FROM academic_years", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const map = {};
    (rows || []).forEach(r => { map[r.year] = { totalDays: r.totalDays, currentDays: r.currentDays }; });
    res.json(map);
  });
});

app.put('/api/admin/academic-years', verifyToken, (req, res) => {
  const { year, totalDays, currentDays } = req.body;
  db.run(`INSERT OR REPLACE INTO academic_years (year, totalDays, currentDays) VALUES (?, ?, ?)`,
    [year, totalDays || null, currentDays || null],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      lastUpdateTimestamp = Date.now(); // Dispara o Smart Polling do front
      res.json({ success: true });
    }
  );
});

app.listen(3000, () => console.log('Backend rodando na porta 3000'));