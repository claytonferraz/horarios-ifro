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
    password_hash TEXT,
    role TEXT DEFAULT 'publico'
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    week TEXT,
    type TEXT,
    fileName TEXT,
    records TEXT,
    updatedAt TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY,
    disabledWeeks TEXT,
    activeDays TEXT,
    classTimes TEXT,
    bimesters TEXT,
    activeDefaultScheduleId TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS academic_weeks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    start_date TEXT,
    end_date TEXT,
    category TEXT DEFAULT 'regular',
    school_days INTEGER DEFAULT 0,
    academic_year TEXT
  )`);
  // Migration: safe column additions for existing databases
  db.run(`ALTER TABLE academic_weeks ADD COLUMN category TEXT DEFAULT 'regular'`, () => {});
  db.run(`ALTER TABLE academic_weeks ADD COLUMN school_days INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE academic_weeks ADD COLUMN academic_year TEXT`, () => {});
  
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
    db.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')", [username, hash], function(err) {
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

    const role = user.role || 'publico';
    const token = jwt.sign({ id: user.id, role }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, role });
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

app.get('/api/auth/me', verifyToken, (req, res) => {
  db.get("SELECT id, username, role FROM users WHERE id = ?", [req.userId], (err, user) => {
    if (err) return res.status(500).json({ error: "Erro no servidor." });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
    res.json({ id: user.id, username: user.username, role: user.role || 'publico' });
  });
});

app.post('/api/auth/register', verifyToken, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || password.length < 4) return res.status(400).json({ error: "Dados inválidos." });

  const finalRole = role || 'publico';
  const hash = await bcrypt.hash(password, 10);
  db.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", [username, hash, finalRole], function(err) {
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
  const year = req.query.year || new Date().getFullYear().toString();
  const configId = `config_${year}`;

  db.get("SELECT disabledWeeks, activeDays, classTimes, bimesters, activeDefaultScheduleId FROM config WHERE id = ?", [configId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) {
      res.json({
        disabledWeeks: row.disabledWeeks ? JSON.parse(row.disabledWeeks) : [],
        activeDays: row.activeDays ? JSON.parse(row.activeDays) : null,
        classTimes: row.classTimes ? JSON.parse(row.classTimes) : null,
        bimesters: row.bimesters ? JSON.parse(row.bimesters) : null,
        activeDefaultScheduleId: row.activeDefaultScheduleId || null
      });
    } else {
      res.json({ disabledWeeks: [], activeDays: null, classTimes: null, bimesters: null, activeDefaultScheduleId: null });
    }
  });
});

app.post('/api/schedules', verifyToken, (req, res) => {
  const { id, week, type, fileName, records } = req.body;
  const now = new Date().toISOString();
  db.run(`INSERT OR REPLACE INTO schedules (id, week, type, fileName, records, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`, 
    [id, week, type, fileName, records, now], 
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
  const { disabledWeeks, activeDays, classTimes, bimesters, activeDefaultScheduleId, year } = req.body;
  const targetYear = year || new Date().getFullYear().toString();
  const configId = `config_${targetYear}`;
  
  db.run(
    `INSERT OR REPLACE INTO config (id, disabledWeeks, activeDays, classTimes, bimesters, activeDefaultScheduleId) 
     VALUES (?, ?, ?, ?, ?, ?)`, 
    [
      configId,
      disabledWeeks ? JSON.stringify(disabledWeeks) : '[]',
      activeDays ? JSON.stringify(activeDays) : null,
      classTimes ? JSON.stringify(classTimes) : null,
      bimesters ? JSON.stringify(bimesters) : null,
      activeDefaultScheduleId || null
    ], 
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      lastUpdateTimestamp = Date.now();
      res.json({ success: true });
    }
  );
});

app.post('/api/config/import', verifyToken, (req, res) => {
  const { fromYear, toYear, options } = req.body;
  if (!fromYear || !toYear) return res.status(400).json({ error: "Anos de origem e destino são obrigatórios." });

  // Options defaults to true if omitted for backward compatibility.
  const ops = options || { days: true, times: true, bimesters: true, default: true };

  const fromId = `config_${fromYear}`;
  const toId = `config_${toYear}`;

  db.get("SELECT disabledWeeks, activeDays, classTimes, bimesters, activeDefaultScheduleId FROM config WHERE id = ?", [toId], (err, targetRow) => {
    if (err) return res.status(500).json({ error: err.message });
    const existing = targetRow || {};
    
    db.get("SELECT disabledWeeks, activeDays, classTimes, bimesters, activeDefaultScheduleId FROM config WHERE id = ?", [fromId], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: "Nenhuma configuração encontrada no ano de origem." });

      // Build final config matching the options flags
      const finalDays     = ops.days      !== false ? row.activeDays : existing.activeDays;
      const finalTimes    = ops.times     !== false ? row.classTimes : existing.classTimes;
      const finalBimester = ops.bimesters !== false ? row.bimesters  : existing.bimesters;
      const finalDefault  = ops.default   !== false ? row.activeDefaultScheduleId : existing.activeDefaultScheduleId;
      // 'disabledWeeks' are usually year-specific exceptions so generally we shouldn't copy them by default, but existing logic did. 
      // We'll preserve existing target's disabledWeeks if present, else empty array.
      const finalDisabled = existing.disabledWeeks || '[]';

      db.run(
        `INSERT OR REPLACE INTO config (id, disabledWeeks, activeDays, classTimes, bimesters, activeDefaultScheduleId) 
         VALUES (?, ?, ?, ?, ?, ?)`, 
        [
          toId,
          finalDisabled,
          finalDays,
          finalTimes,
          finalBimester,
          finalDefault
        ], 
        (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });
          lastUpdateTimestamp = Date.now();
          res.json({ success: true, message: 'Importação parcial/total concluída com sucesso!' });
        }
      );
    });
  });
});

// ==========================================
// ROTAS DE SEMANAS ACADÊMICAS
// ==========================================
app.get('/api/academic-weeks', (req, res) => {
  db.all("SELECT * FROM academic_weeks ORDER BY start_date ASC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/api/academic-weeks', verifyToken, (req, res) => {
  const { name, start_date, end_date, category, school_days, academic_year } = req.body;
  db.run(
    "INSERT INTO academic_weeks (name, start_date, end_date, category, school_days, academic_year) VALUES (?, ?, ?, ?, ?, ?)",
    [name, start_date, end_date, category || 'regular', school_days || 0, academic_year || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      lastUpdateTimestamp = Date.now();
      res.json({ id: this.lastID, name, start_date, end_date, category: category || 'regular', school_days: school_days || 0, academic_year: academic_year || null });
    }
  );
});

app.put('/api/academic-weeks/:id', verifyToken, (req, res) => {
  const { name, start_date, end_date, category, school_days, academic_year } = req.body;
  db.run(
    "UPDATE academic_weeks SET name = ?, start_date = ?, end_date = ?, category = ?, school_days = ?, academic_year = ? WHERE id = ?",
    [name, start_date, end_date, category || 'regular', school_days || 0, academic_year || null, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      lastUpdateTimestamp = Date.now();
      res.json({ success: true });
    }
  );
});

app.delete('/api/academic-weeks/:id', verifyToken, (req, res) => {
  db.run("DELETE FROM academic_weeks WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    lastUpdateTimestamp = Date.now();
    res.json({ success: true });
  });
});

// ==========================================
// ROTAS GESTÃO ACADÊMICA (ADMIN & ESTATÍSTICAS)
// ==========================================

// --- SUAP: Vinculado à Turma/Disciplina ---
app.get('/api/admin/disciplines', (req, res) => { // Público para o painel do Professor ler
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
app.get('/api/admin/subject-hours', (req, res) => { // Público para o painel do Professor ler
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
app.get('/api/admin/academic-years', (req, res) => { // Público para o painel do Professor ler
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