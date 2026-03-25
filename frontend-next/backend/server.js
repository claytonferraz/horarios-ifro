const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
// const xss = require('xss-clean'); (Incompatível com Express 5)
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
require('dotenv').config();

const app = express();
const http = require('http');
const { Server } = require('socket.io');

const defaultAllowedOrigins = [
  'http://localhost:3001',
  'http://localhost:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3000',
  'https://10.60.5.67:3001',
  'http://10.60.5.67:3001'
];
const envAllowedOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envAllowedOrigins]));

const localNetworkOriginPattern = /^https?:\/\/((localhost|127\.0\.0\.1|\[::1\])(:\d+)?|(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?)$/;

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (localNetworkOriginPattern.test(origin)) return true;
  if (process.env.NODE_ENV !== 'production') return true;
  return false;
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
};

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV !== 'production' ? true : allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// 1. Segurança e Proteção Contra Ataques
// Helmet protege cabeçalhos HTTP
app.use(helmet());

// app.use(xss()); // Comentado pois o pacote xss-clean v0.1.4 ainda quebra no Express 5 (req.query sem setter)

app.options(/.*/, cors(corsOptions));
app.use(cors(corsOptions));

// Proteção contra DDoS e Brute Force Geral
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 1000, 
  message: { error: 'Muitas requisições deste IP, por favor aguarde 15 minutos.' }
});
app.use(generalLimiter);

// Limite específico rígido para Rotas de Login e Setup (Brute Force)
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 20, 
  message: { error: 'Muitas tentativas de login. IP bloqueado por 1 hora.' }
});
app.use('/api/auth/', authLimiter);

// Payload sizes limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const path = require('path');
const db = require('./db');
const { verifyToken, JWT_SECRET } = require('./middlewares/auth.middleware');

// CONTROLE DE SMART POLLING
// ==========================================
// Registra o tempo exato da última alteração no banco. 
// O frontend pergunta essa variável a cada 5 min para saber se precisa baixar os dados.

// ==========================================
// CRIAÇÃO DAS TABELAS NO SQLITE
// ==========================================
db.serialize(() => {
  // Tabelas Base
  db.run(`CREATE TABLE IF NOT EXISTS users (
      siape TEXT PRIMARY KEY,
      nome_completo TEXT,
      nome_exibicao TEXT,
      email TEXT UNIQUE,
      senha_hash TEXT,
      status TEXT DEFAULT 'ativo',
      perfis TEXT DEFAULT '[]',
      is_admin INTEGER DEFAULT 0,
      atua_como_docente INTEGER DEFAULT 1,
      exigir_troca_senha INTEGER DEFAULT 1
  )`);

  // ESTRUTURA REFORMULADA: Schedules com Tipificação e Ciclo de Vida
  // status: 'Padrão' (Template), 'Prévia' (Editável Semanal), 'Consolidado' (Imutável)
  db.run(`CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    academic_year TEXT,
    week_id TEXT, 
    status TEXT DEFAULT 'Padrão', 
    type TEXT, 
    fileName TEXT,
    records TEXT,
    updatedAt TEXT,
    closedAt TEXT,
    courseId TEXT,
    classId TEXT,
    dayOfWeek TEXT,
    slotId TEXT,
    teacherId TEXT,
    disciplineId TEXT,
    room TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS exchange_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT,
    requester_id TEXT,
    substitute_id TEXT,
    target_class TEXT,
    original_day TEXT,
    original_time TEXT,
    subject TEXT,
    return_week TEXT,
    reason TEXT,
    obs TEXT,
    status TEXT DEFAULT 'pendente',
    admin_feedback TEXT,
    system_message TEXT,
    original_slot TEXT,
    proposed_slot TEXT,
    approved_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`ALTER TABLE exchange_requests ADD COLUMN approved_by TEXT`, (err) => { /* ignorar se já existe */ });

  db.run(`CREATE TABLE IF NOT EXISTS config (
    id TEXT PRIMARY KEY, -- config_2026
    disabledWeeks TEXT,
    activeDays TEXT,
    classTimes TEXT, -- Inclui durações e lógica de cadeia
    intervals TEXT,   -- Configuração de 20min/10min por turno
    activeDefaultScheduleId TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS academic_weeks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    start_date TEXT,
    end_date TEXT,
    category TEXT DEFAULT 'regular',
    school_days INTEGER DEFAULT 0,
    academic_year TEXT,
    is_closed INTEGER DEFAULT 0 -- Bloqueia edições se consolidado
  )`);

  // Tabelas de Metadados e Controle
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
  
  db.run(`CREATE TABLE IF NOT EXISTS curriculum_data (
    id TEXT PRIMARY KEY,
    dataType TEXT,
    academic_year TEXT,
    course_id TEXT,
    matrix_id TEXT,
    payload TEXT
  )`);

  // Tabela de Solicitações de Mudança (Portal do Professor)
  db.run(`CREATE TABLE IF NOT EXISTS change_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    siape TEXT,
    week_id TEXT,
    description TEXT,
    original_slot TEXT, -- JSON: {day, time, className, subject}
    proposed_slot TEXT, -- JSON: {day, time}
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    admin_feedback TEXT,
    createdAt TEXT
  )`);

  // Tabela de Log de Conflitos (Para Auditoria/Motor de Regras)
  db.run(`CREATE TABLE IF NOT EXISTS conflict_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id TEXT,
    type TEXT, -- 'Professor', 'SaúdeDocente', 'Espaço'
    description TEXT,
    severity TEXT, -- 'Bloqueio', 'Aviso'
    createdAt TEXT
  )`);

  // Tabela de Auditoria (Audit Logs)
  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT,
    timestamp TEXT,
    details TEXT
  )`);

  // Tabela de Notificações
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target TEXT, 
    type TEXT,
    title TEXT,
    message TEXT,
    createdAt TEXT
  )`);

});



// ==========================================
// ROTA PÚBLICA DE STATUS (Para o Frontend)
// ==========================================
app.get('/api/status', (req, res) => {
  try {
    res.json({ lastUpdate: lastUpdateTimestamp });
  } catch(e) {
    console.error("ERRO NA ROTA STATUS:", e);
    res.status(500).json({ error: e.message });
  }
});

// ==========================================
// ROTA DE NOTIFICAÇÕES (Chat/Alert Widget)
// ==========================================
app.get('/api/notifications', (req, res) => {
  const { siape, userRole } = req.query;
  const limit = 10;

  let targets = ["ALL"]; // Sempre buscar eventos pra todo mundo
  if (userRole === 'aluno') {
    targets.push('ALL_STUDENT');
  } else if (['professor', 'servidor', 'admin', 'gestao'].includes(userRole)) {
    targets.push('ALL_PROF');
    if (['admin', 'gestao'].includes(userRole)) targets.push('ALL_ADMIN');
    if (siape && siape !== 'undefined') targets.push(siape);
  }

  const inStr = targets.map(() => '?').join(',');
  const query = `SELECT * FROM notifications WHERE target IN (${inStr}) ORDER BY id DESC LIMIT ?`;
  
  db.all(query, [...targets, limit], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// ==========================================
// ROTAS DE AUTENTICAÇÃO (Login / Criação)
// ==========================================
const authRoutes = require('./routes/auth.routes');
app.use('/api/auth', authRoutes);

// ==========================================
// ROTAS DE HORÁRIOS
// ==========================================
const schedulesRoutes = require('./routes/schedules.routes')(io);
app.use('/api/schedules', schedulesRoutes);

app.get('/api/config', (req, res) => {
  const year = req.query.year || new Date().getFullYear().toString();
  const configId = `config_${year}`;

  db.get("SELECT disabledWeeks, activeDays, classTimes, bimesters, activeDefaultScheduleId FROM config WHERE id = ?", [configId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) {
      let dWeeks = [], aDays = null, cTimes = null, bimesters = null;
      try { dWeeks = row.disabledWeeks ? JSON.parse(row.disabledWeeks) : []; } catch(e) {}
      try { aDays = row.activeDays ? JSON.parse(row.activeDays) : null; } catch(e) {}
      try { cTimes = row.classTimes ? JSON.parse(row.classTimes) : null; } catch(e) {}
      try { bimesters = row.bimesters ? JSON.parse(row.bimesters) : null; } catch(e) {}
      res.json({
        disabledWeeks: dWeeks,
        activeDays: aDays,
        classTimes: cTimes,
        bimesters: bimesters,
        activeDefaultScheduleId: row.activeDefaultScheduleId || null
      });
    } else {
      res.json({ disabledWeeks: [], activeDays: null, classTimes: null, bimesters: null, activeDefaultScheduleId: null });
    }
  });
});

app.put('/api/config', verifyToken, (req, res) => {
  const { disabledWeeks, activeDays, classTimes, bimesters, activeDefaultScheduleId, intervals, year } = req.body;
  const targetYear = year || new Date().getFullYear().toString();
  const configId = `config_${targetYear}`;
  
  db.run(
    `INSERT OR REPLACE INTO config (id, disabledWeeks, activeDays, classTimes, bimesters, activeDefaultScheduleId, intervals) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`, 
    [
      configId,
      disabledWeeks ? JSON.stringify(disabledWeeks) : '[]',
      activeDays ? JSON.stringify(activeDays) : null,
      classTimes ? JSON.stringify(classTimes) : null,
      bimesters ? JSON.stringify(bimesters) : null,
      activeDefaultScheduleId || null,
      intervals ? JSON.stringify(intervals) : '[]'
    ], 
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      io.emit('schedule_updated');
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
      const finalDisabled = existing.disabledWeeks || '[]';

      db.run(
        `INSERT OR REPLACE INTO config (id, disabledWeeks, activeDays, classTimes, bimesters, activeDefaultScheduleId) 
         VALUES (?, ?, ?, ?, ?, ?)`, 
        [toId, finalDisabled, finalDays, finalTimes, finalBimester, finalDefault], 
        (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });

          // --- AGORA REALIZA A DUPLICAÇÃO DAS TURMAS ---
          db.all("SELECT id, payload FROM curriculum_data WHERE dataType = 'class'", (err3, classRows) => {
             if(err3) return finishImport(res);

             const insertStmt = db.prepare("INSERT INTO curriculum_data (id, dataType, payload) VALUES (?, 'class', ?)");
             const classesToInsert = [];

             // Busca as turmas do ano base
             (classRows || []).forEach(cr => {
                try {
                   const classData = JSON.parse(cr.payload);
                   if (classData.academicYear === fromYear) {
                      // Duplica e ajusta
                      const newId = `c_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                      const newPayload = { ...classData, id: newId, academicYear: toYear };
                      classesToInsert.push([newId, JSON.stringify(newPayload)]);
                   }
                } catch(e){}
             });

             if(classesToInsert.length === 0) {
               return finishImport(res);
             }

             // Insere as cópias
             let completed = 0;
             let hasErrors = false;
             classesToInsert.forEach(params => {
                insertStmt.run(params, (errInsert) => {
                   if(errInsert) hasErrors = true;
                   completed++;
                   if(completed === classesToInsert.length) {
                     insertStmt.finalize();
                     finishImport(res, hasErrors);
                   }
                });
             });
          });
        }
      );
    });
  });

  function finishImport(responseObj, partialErrors = false) {
     io.emit('schedule_updated');
     responseObj.json({ success: true, message: partialErrors ? 'Importação concluída com alguns alertas na cópia de turmas.' : 'Importação da configuração base e duplicação da malha de turmas concluída com sucesso!' });
  }
});


const configRoutes = require('./routes/config.routes')(io);
const adminRoutes = require('./routes/admin.routes')(io);
const requestsRoutes = require('./routes/requests.routes')(io);

app.use('/api/academic-weeks', configRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/requests', requestsRoutes);

const PORT = process.env.PORT || 3012;
server.listen(PORT, () => console.log(`Backend rodando com alta performance na porta ${PORT}`));
