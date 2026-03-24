const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
// const xss = require('xss-clean'); (Incompatível com Express 5)
const rateLimit = require('express-rate-limit');
const { z } = require('zod');

const app = express();
const http = require('http');
const { Server } = require('socket.io');

// Restrição Extrema de CORS: Apenas o domínio Next.js oficial operando em produção ou local
const allowedOrigins = ['http://localhost:3001', 'http://localhost:3000', 'https://10.60.5.67:3001','http://10.60.5.67:3001'];

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// 1. Segurança e Proteção Contra Ataques
// Helmet protege cabeçalhos HTTP
app.use(helmet());

// app.use(xss()); // Comentado pois o pacote xss-clean v0.1.4 ainda quebra no Express 5 (req.query sem setter)

app.options(/.*/, cors());
app.use(cors({
  origin: function(origin, callback) {
    if(!origin) return callback(null, true); // Mobile / Postman
    // Libera conexões de rede locais e outras abas do dev (necessário para testes em outros navegadores/dispositivos)
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin.startsWith('http://192.168.') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS Blocked'), false);
  },
  credentials: true
}));

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

require('dotenv').config();
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

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
      io.emit('schedule_updated');
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
      io.emit('schedule_updated');
      res.json({ success: true });
    }
  );
});

app.delete('/api/academic-weeks/:id', verifyToken, (req, res) => {
  db.run("DELETE FROM academic_weeks WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    io.emit('schedule_updated');
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
      io.emit('schedule_updated');
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
      io.emit('schedule_updated');
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
    
    // Busca na tabela de configuração para não perder os anos salvos la
    db.all("SELECT id FROM config", (err2, confRows) => {
       if(!err2) {
         (confRows || []).forEach(cr => {
            const y = String(cr.id || '').replace('config_', '');
            if(!map[y] && y) map[y] = { totalDays: '', currentDays: '' };
         });
       }
       
       // E no curriculum_data (Turmas) para garantir
       db.all("SELECT payload FROM curriculum_data WHERE dataType = 'class'", (err3, classRows) => {
          if(!err3) {
             (classRows || []).forEach(cRow => {
                try {
                   const parsed = JSON.parse(cRow.payload);
                   if(parsed.academicYear && !map[parsed.academicYear]) {
                      map[parsed.academicYear] = { totalDays: '', currentDays: '' };
                   }
                } catch(e){}
             });
          }
          res.json(map);
       });
    });
  });
});

app.put('/api/admin/academic-years', verifyToken, (req, res) => {
  const { year, totalDays, currentDays } = req.body;
  db.run(`INSERT OR REPLACE INTO academic_years (year, totalDays, currentDays) VALUES (?, ?, ?)`,
    [year, totalDays || null, currentDays || null],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      io.emit('schedule_updated');
      res.json({ success: true });
    }
  );
});

// --- CURRICULUM MANAGEMENT ---
app.get('/api/admin/curriculum/:type', (req, res) => {
  const { type } = req.params;
  if (!['matrix', 'class'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
  
  db.all("SELECT id, payload FROM curriculum_data WHERE dataType = ?", [type], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const records = rows.map(r => {
      try { return JSON.parse(r.payload); } catch (e) { return null; }
    }).filter(Boolean);
    res.json(records);
  });
});

app.put('/api/admin/curriculum/:type', verifyToken, (req, res) => {
  const { type } = req.params;
  if (!['matrix', 'class'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
  const payloadStr = JSON.stringify(req.body);
  const idStr = String(req.body.id);
  
  let academic_year = req.body.academicYear || null;
  let course_id = req.body.course || req.body.courseAcronym || null;
  let matrix_id = req.body.matrixId || (type === 'matrix' ? idStr : null);
  
  db.run(`INSERT OR REPLACE INTO curriculum_data (id, dataType, academic_year, course_id, matrix_id, payload) VALUES (?, ?, ?, ?, ?, ?)`,
    [idStr, type, academic_year, course_id, matrix_id, payloadStr],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      io.emit('schedule_updated');
      res.json({ success: true, id: idStr });
    }
  );
});

app.delete('/api/admin/curriculum/:type/:id', verifyToken, (req, res) => {
  const { type, id } = req.params;
  db.run("DELETE FROM curriculum_data WHERE id = ? AND dataType = ?", [id, type], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    io.emit('schedule_updated');
    res.json({ success: true });
  });
});

// ==========================================
// ROTAS DE USUÁRIOS/SERVIDORES (Antigo Teachers)
// ==========================================
app.get('/api/admin/teachers', (req, res) => {
  db.all("SELECT siape, nome_exibicao, nome_completo, email, status, perfis, atua_como_docente, exigir_troca_senha, is_admin FROM users ORDER BY nome_exibicao ASC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    // Parse perfis string back to array for frontend
    const mapped = (rows || []).map(r => {
      let p = [];
      try { p = JSON.parse(r.perfis || '[]'); } catch(e){}
      return { ...r, perfis: p };
    });
    res.json(mapped);
  });
});

app.put('/api/admin/teachers', verifyToken, async (req, res) => {
  let { siape, nome_exibicao, nome_completo, email, senha, status, perfis, atua_como_docente } = req.body;
  if (!siape || !nome_completo) return res.status(400).json({ error: "SIAPE e Nome Mínimos requeridos." });

  const perfisStr = JSON.stringify(perfis || []);
  const atuaDoc = atua_como_docente ? 1 : 0;

  db.get("SELECT senha_hash, exigir_troca_senha FROM users WHERE siape = ?", [siape], async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    
    let finalHash = row ? row.senha_hash : null;
    
    if (!finalHash && !senha) senha = "prof@2026";
    if (senha) finalHash = await bcrypt.hash(senha, 10);
    
    // Se a senha foi alterada via admin, força a flag de exigir_troca_senha para 1. Se não, mantém a atual.
    const exigirTroca = senha ? 1 : (row ? row.exigir_troca_senha : 1);

    db.run(
      `INSERT OR REPLACE INTO users (siape, nome_exibicao, nome_completo, email, senha_hash, status, perfis, atua_como_docente, exigir_troca_senha) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [siape, nome_exibicao || '', nome_completo, email || null, finalHash, status || 'ativo', perfisStr, atuaDoc, exigirTroca],
      (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        io.emit('schedule_updated');
        res.json({ success: true, siape });
      }
    );
  });
});

app.post('/api/admin/teachers/batch', verifyToken, async (req, res) => {
  const users = req.body;
  if (!Array.isArray(users)) return res.status(400).json({ error: "O corpo da requisição deve ser um array." });

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    const stmtMerge = db.prepare("INSERT OR REPLACE INTO users (siape, nome_exibicao, nome_completo, email, senha_hash, status, perfis, atua_como_docente, exigir_troca_senha) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const stmtUpdateSiape = db.prepare("UPDATE users SET siape = ?, nome_exibicao = ?, nome_completo = ?, email = ?, status = ?, perfis = ?, atua_como_docente = ? WHERE siape = ?");
    const stmtCheck = db.prepare("SELECT senha_hash, exigir_troca_senha FROM users WHERE siape = ?");

    const processItem = async (item) => {
      const { siape, oldSiape, nome_exibicao, nome_completo, email, status, perfis, atua_como_docente, exigir_troca_senha } = item;
      if (!siape || !nome_completo) return; 

      const targetSiape = oldSiape && oldSiape.trim() !== '' ? oldSiape : siape;
      const perfisStr = JSON.stringify(perfis || []);
      const atuaDoc = atua_como_docente ? 1 : 0;

      return new Promise((resolve, reject) => {
        stmtCheck.get([targetSiape], async (err, row) => {
          if (err) return reject(err);
          let exigirTroca = exigir_troca_senha !== undefined ? exigir_troca_senha : (row ? row.exigir_troca_senha : 1);
          try {
            let finalHash = row ? row.senha_hash : null;
            if (!finalHash) {
              finalHash = await bcrypt.hash(`prof@${new Date().getFullYear()}`, 10);
              exigirTroca = 1;
            }

            if (oldSiape && oldSiape !== siape) {
               stmtUpdateSiape.run([siape, nome_exibicao || '', nome_completo, email || null, status || 'ativo', perfisStr, atuaDoc, oldSiape], (err) => {
                  if (err) return reject(err);
                  resolve();
               });
            } else {
               stmtMerge.run([siape, nome_exibicao || '', nome_completo, email || null, finalHash, status || 'ativo', perfisStr, atuaDoc, exigirTroca], (err) => {
                  if (err) return reject(err);
                  resolve();
               });
            }
          } catch(e) {
            reject(e);
          }
        });
      });
    };

    (async () => {
      try {
        for (const item of users) await processItem(item);
        db.run("COMMIT");
        io.emit('schedule_updated');
        res.json({ success: true, count: users.length });
      } catch (err) {
        db.run("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    })();
  });
});

app.delete('/api/admin/teachers/:siape', verifyToken, (req, res) => {
  db.run("DELETE FROM users WHERE siape = ?", [req.params.siape], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    io.emit('schedule_updated');
    res.json({ success: true });
  });
});

app.put('/api/teachers/:siape/admin-status', verifyToken, (req, res) => {
  const { is_admin } = req.body;
  const adminValue = is_admin ? 1 : 0;
  
  db.run(
    "UPDATE users SET is_admin = ? WHERE siape = ?",
    [adminValue, req.params.siape],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      io.emit('schedule_updated');
      res.json({ success: true, is_admin: adminValue });
    }
  );
});

// ==========================================
// ROTAS DE SOLICITAÇÕES DE TROCA E VAGA
// ==========================================
app.get('/api/requests', (req, res) => {
  try {
    let query = 'SELECT * FROM exchange_requests ORDER BY created_at DESC';
    let params = [];
    if (req.query.siape) {
        query = 'SELECT * FROM exchange_requests WHERE requester_id LIKE ? OR substitute_id LIKE ? ORDER BY id DESC';
        const likeSiape = `%${req.query.siape}%`;
        params = [likeSiape, likeSiape];
    }
    db.all(query, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    });
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/requests', (req, res) => {
  try {
    const data = req.body;
    let action = data.action || 'vaga';

    // O fallback de ação protege o endpoint
    if (!['vaga', 'troca', 'oferta_vaga'].includes(action)) {
        return res.status(400).json({ error: "Ação não especificada ou inválida." });
    }

    let requester = data.requester_id || data.siape;
    let targetClass = data.targetClass || data.original_slot?.className || '';
    let returnWeekId = data.returnWeekId || data.week_id;
    let reason = data.reason || data.description;
    let substituteId = data.substitute_id || '';

    let originalDay = data.original_slot?.day || '';
    let originalTime = data.original_slot?.time || '';
    let subject = data.original_slot?.subject || '';

    // Empacotamos toda a clareza da permuta na coluna OBS para facilitar o Motor de Troco
    const corePayload = JSON.stringify({ 
         original: data.original_slot, 
         proposed: data.proposed_slot 
    });
    let obs = data.obs ? `${data.obs} | [SYSTEM_DATA]: ${corePayload}` : corePayload;

    if (action === 'vaga') {
        const proposedDay = data.proposed_slot?.day || originalDay;
        const proposedTime = data.proposed_slot?.time || originalTime;
        const proposedSubject = data.proposed_slot?.subject || subject;
        const classIdToUpdate = data.proposed_slot?.classId || targetClass;
        const originalSubjectName = data.proposed_slot?.originalSubject || subject;

        const REVERSE_MAP_DAYS = { 'Segunda-feira': 1, 'Terça-feira': 2, 'Quarta-feira': 3, 'Quinta-feira': 4, 'Sexta-feira': 5, 'Sábado': 6 };
        const dayOfWeekToUpdate = REVERSE_MAP_DAYS[proposedDay] || proposedDay;

        const updateQ = `UPDATE schedules SET teacherId = ?, disciplineId = ?, records = json_patch(COALESCE(records, '{}'), ?) WHERE classId = ? AND dayOfWeek = ? AND slotId = ? AND ( (week_id = ? AND type IN ('previa', 'atual', 'oficial')) OR (? IS NULL AND type = 'padrao' AND (week_id IS NULL OR week_id = '')) )`;
        const newRecordsFragment = JSON.stringify({ isSubstituted: true, originalSubject: originalSubjectName });

        db.run(updateQ, [requester, proposedSubject, newRecordsFragment, classIdToUpdate, dayOfWeekToUpdate, proposedTime, returnWeekId || null, returnWeekId || null], function(err) {
           if (err) return res.status(500).json({ error: err.message });
           
           const executeInsert = (weekText) => {
               const notifyMsg = 'Auto-ocupação de Vaga Registrada no Sistema.';
               const finalFeedback = `Aprovado pelo sistema automaticamente em: ${new Date().toLocaleString('pt-BR')}`;
               
               db.run('INSERT INTO exchange_requests (action_type, requester_id, target_class, original_day, original_time, subject, return_week, reason, obs, status, admin_feedback, original_slot, proposed_slot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                 [action, requester, targetClass, originalDay, originalTime, subject, returnWeekId || '', notifyMsg, obs, 'aprovada', finalFeedback, JSON.stringify(data.original_slot || {}), JSON.stringify(data.proposed_slot || {})],
                 function(err2) {
                   if (err2) return res.status(500).json({ error: err2.message });
                   const insertedId = this.lastID;
                   const now = new Date().toISOString();
                   db.run("INSERT INTO notifications (type, target, title, message, createdAt) VALUES ('SYSTEM', 'ALL_ADMIN', 'Substituição Automática', ?, ?)", [notifyMsg, now], function(){});
                   io.emit('schedule_updated');
                   res.json({ success: true, id: insertedId, automatic: true });
                 }
               );
           };

           if (returnWeekId && returnWeekId !== 'padrao') {
               db.get("SELECT name, start_date, end_date FROM academic_weeks WHERE id = ?", [returnWeekId], (err3, row) => {
                 if (!err3 && row && row.start_date && row.end_date) {
                   const pS = row.start_date.split('-');
                   const pE = row.end_date.split('-');
                   executeInsert(`(Semana: ${pS[2]}/${pS[1]} a ${pE[2]}/${pE[1]})`);
                 } else {
                   executeInsert('');
                 }
               });
           } else {
               executeInsert('(Matriz Padrão)');
           }
        });

    } else if (action === 'oferta_vaga') {
        const slotsObj = data.proposed_slot || {};
        const targets = slotsObj.slots || [];
        const REVERSE_MAP_DAYS = { 'Segunda-feira': 1, 'Terça-feira': 2, 'Quarta-feira': 3, 'Quinta-feira': 4, 'Sexta-feira': 5, 'Sábado': 6 };
        const dayNum = REVERSE_MAP_DAYS[slotsObj.day] || slotsObj.day;
        const cid = slotsObj.classId || targetClass;

        const promises = targets.map((s) => {
           return new Promise((resolve) => {
               const uQ = `UPDATE schedules SET teacherId = 'A Definir', records = json_patch(COALESCE(records, '{}'), ?) WHERE classId = ? AND dayOfWeek = ? AND slotId = ? AND ( (week_id = ? AND type IN ('previa', 'atual', 'oficial')) OR (? IS NULL AND type = 'padrao' AND (week_id IS NULL OR week_id = '')) )`;
               const meta = JSON.stringify({ isSubstituted: true, originalSubject: (s.subject || subject), isDisponibilizada: true, offeredTo: slotsObj.targetSubject });
               db.run(uQ, [meta, cid, dayNum, s.time, returnWeekId || null, returnWeekId || null], () => resolve());
           });
        });

        Promise.all(promises).then(() => {
            db.run('INSERT INTO exchange_requests (action_type, requester_id, substitute_id, target_class, original_day, original_time, subject, return_week, reason, obs, status, original_slot, proposed_slot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [action, requester, (slotsObj.targetSubject === 'ALL' ? '' : slotsObj.targetSubject), targetClass, slotsObj.day, slotsObj.time, 'Aulas Agrupadas', returnWeekId || '', reason || '', obs || '', 'pendente', JSON.stringify(data.original_slot || {}), JSON.stringify(data.proposed_slot || {})],
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    const insertedId = this.lastID;
                    const now = new Date().toISOString();
                    const nMsg = `Professor(a) SIApE: ${requester} disponibilizou aula(s) vaga(s) na turma ${targetClass} em ${slotsObj.day} (${slotsObj.time}). Alvo: ${slotsObj.targetSubject}`;
                    db.run("INSERT INTO notifications (type, target, title, message, createdAt) VALUES ('SYSTEM', 'ALL_ADMIN', 'Aula(s) Disponibilizada(s)', ?, ?)", [nMsg, now], function(){});
                    io.emit('schedule_updated');
                    res.json({ success: true, id: insertedId, automatic: true });
                }
            );
        });

    } else if (action === 'troca' || !action) {
        // Se action_type estiver estritamente vazio (modal antigo/incompleto), forçamos 'troca_aberta' ou assumimos o fluxo base para evitar nulls
        const finalAction = action || 'vaga';
        const status = finalAction === 'troca' ? 'aguardando_colega' : 'pendente'; 

        db.run(
          // Na tabela, usaremos a query com "obs" espelhando o formato stricto.
          'INSERT INTO exchange_requests (action_type, requester_id, substitute_id, target_class, original_day, original_time, subject, return_week, reason, obs, status, original_slot, proposed_slot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [finalAction, requester, substituteId || '', targetClass, originalDay, originalTime, subject, returnWeekId || '', reason || '', obs, status, JSON.stringify(data.original_slot || {}), JSON.stringify(data.proposed_slot || {})],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
          }
        );
    }
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.put('/api/requests/:id/status', (req, res) => {
  try {
    const { status, admin_feedback, system_message } = req.body;
    db.run('UPDATE exchange_requests SET status = ?, admin_feedback = COALESCE(?, admin_feedback), system_message = COALESCE(?, system_message) WHERE id = ?', [status, admin_feedback || null, system_message || null, req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      const now = new Date().toISOString();

      if (status === 'pronto_para_homologacao') {
        db.run("INSERT INTO notifications (type, target, title, message, createdAt) VALUES ('SYSTEM', 'ALL_ADMIN', 'Permuta Aceita pelo Colega', 'Um pedido de mudança acaba de receber o aceite do professor substituto. Aguardando sua homologação.', ?)", [now], function(){});
        io.emit('schedule_updated');
        res.json({ success: true });

      } else if (status === 'rejeitado') {
         db.get("SELECT requester_id FROM exchange_requests WHERE id = ?", [req.params.id], (err2, row) => {
            if (!err2 && row && row.requester_id) {
               db.run("INSERT INTO notifications (type, target, title, message, createdAt) VALUES ('SYSTEM', ?, 'Permuta Recusada', 'O seu colega não aceitou a proposta de troca de aula(s).', ?)", [row.requester_id, now], function(){
                 io.emit('schedule_updated');
               });
            }
         });
         res.json({ success: true });

      } else if (status === 'aprovada' || status === 'aprovado') {
         // MOTOR DE TROCA (SWAP ENGINE) V2 - Execução Homologada
         db.get("SELECT * FROM exchange_requests WHERE id = ?", [req.params.id], (err3, row) => {
             if (!err3 && row && row.action_type === 'troca') {
                 try {
                     let sysMatch = row.obs.indexOf('[SYSTEM_DATA]:');
                     let payloadData = null;
                     if (sysMatch > -1) {
                          payloadData = JSON.parse(row.obs.substring(sysMatch + 14).trim());
                     } else {
                          payloadData = JSON.parse(row.obs);
                     }
                     
                     const orig = payloadData.original;
                     const prop = payloadData.proposed;
                     
                     const REVERSE_MAP_DAYS = { 'Segunda-feira': 1, 'Terça-feira': 2, 'Quarta-feira': 3, 'Quinta-feira': 4, 'Sexta-feira': 5, 'Sábado': 6 };
                     const origDay = REVERSE_MAP_DAYS[orig.day] || orig.day;
                     const propDay = REVERSE_MAP_DAYS[prop.day] || prop.day;
                     
                     const weekIdFilter = row.return_week || null;

                     const origTargetClass = orig.classId || orig.className || row.target_class;
                     const propTargetClass = prop.classId || prop.className || row.target_class;

                     console.log("\n[SWAP_ENGINE] ==============================================");
                     console.log("[SWAP_ENGINE] INICIANDO HOMOLOGAÇÃO / SWAP CRUZADO IDREQ:", req.params.id);
                     console.log(`[SWAP_ENGINE] NÓ ORIGEM  -> SIApE (A): ${row.requester_id} entregando ${orig.subject} [${orig.day} ${orig.time}] - T: ${origTargetClass}`);
                     console.log(`[SWAP_ENGINE] NÓ OBJETIVO-> SIApE (B): ${row.substitute_id} recebendo ${prop.subject} [${prop.day} ${prop.time}] - T: ${propTargetClass}`);

                     db.serialize(() => {
                         console.log("[SWAP_ENGINE] > BEGIN TRANSACTION");
                         db.run("BEGIN TRANSACTION;");

                         // AULA 1 (A passa para B) -> Update Original Node
                         const updateOrig = `UPDATE schedules SET teacherId = ?, disciplineId = ?, records = json_patch(COALESCE(records, '{}'), ?) WHERE classId = ? AND dayOfWeek = ? AND slotId = ? AND ( (week_id = ? AND type IN ('previa', 'atual', 'oficial')) OR (? IS NULL AND type = 'padrao' AND (week_id IS NULL OR week_id = '')) )`;
                         const patchOrig = JSON.stringify({ isSubstituted: true, isPermuted: true, originalSubject: (orig.originalSubject || orig.subject) });
                         
                         db.run(updateOrig, [row.substitute_id, prop.subject, patchOrig, origTargetClass, origDay, orig.time, weekIdFilter, weekIdFilter]);
                         console.log(`[SWAP_ENGINE] > UPDATE 1 (A->B) DISPARADO (Patch: ${patchOrig})`);

                         // AULA 2 (B passa para A) -> Update Proposed Node
                         const updateProp = `UPDATE schedules SET teacherId = ?, disciplineId = ?, records = json_patch(COALESCE(records, '{}'), ?) WHERE classId = ? AND dayOfWeek = ? AND slotId = ? AND ( (week_id = ? AND type IN ('previa', 'atual', 'oficial')) OR (? IS NULL AND type = 'padrao' AND (week_id IS NULL OR week_id = '')) )`;
                         const patchProp = JSON.stringify({ isSubstituted: true, isPermuted: true, originalSubject: (prop.originalSubject || prop.subject) });
                         
                         db.run(updateProp, [row.requester_id, orig.subject, patchProp, propTargetClass, propDay, prop.time, weekIdFilter, weekIdFilter]);
                         console.log(`[SWAP_ENGINE] > UPDATE 2 (B->A) DISPARADO (Patch: ${patchProp})`);

                         db.run("COMMIT;", (commitErr) => {
                             if (commitErr) {
                                 console.error("[SWAP_ENGINE] [ERRO CRÍTICO] Falha no COMMIT:", commitErr);
                                 db.run("ROLLBACK;");
                                 res.status(500).json({ error: "Erro na integridade da Transação" });
                             } else {
                                 console.log("[SWAP_ENGINE] > COMMIT REALIZADO COM SUCESSO. GRADE MUTADA DE FORMA SEGURA.");
                                 console.log("[SWAP_ENGINE] ==============================================\n");
                                 
                                 const notifyTitle = 'Sua Permuta de Aulas foi Efetivada na Grade';
                                 const notifyMsg = `A troca envolvendo suas aulas de ${orig.subject} (${orig.day}) e ${prop.subject} (${prop.day}) acaba de ser homologada oficialmente.`;
                                 db.run("INSERT INTO notifications (type, target, title, message, createdAt) VALUES ('SYSTEM', ?, ?, ?, ?)", [row.requester_id, notifyTitle, notifyMsg, now], function(){});
                                 db.run("INSERT INTO notifications (type, target, title, message, createdAt) VALUES ('SYSTEM', ?, ?, ?, ?)", [row.substitute_id, notifyTitle, notifyMsg, now], function(){});

                                 io.emit('schedule_updated'); 
                                 res.json({ success: true, homologacaoStatus: 'EXECUTADA' });
                             }
                         });
                     });

                 } catch(jsonErr) {
                     console.warn("[SWAP_ENGINE] Falha ao parsear JSON payload. Requisição Legada. Pulando motor.", jsonErr);
                     io.emit('schedule_updated');
                     res.json({ success: true, homologacaoStatus: 'MANUAL_LEGADO' });
                 }
             } else {
                 io.emit('schedule_updated');
                 res.json({ success: true });
             }
         });
      } else {
         res.json({ success: true });
      }
    });
  } catch(e) { res.status(500).json({error: e.message}); }
});

const PORT = process.env.PORT || 3012;
server.listen(PORT, () => console.log(`Backend rodando com alta performance na porta ${PORT}`));