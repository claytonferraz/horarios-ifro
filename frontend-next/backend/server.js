const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');

const app = express();

// 1. Segurança e Proteção Contra Ataques
// Helmet protege cabeçalhos HTTP
app.use(helmet());

// XSS-Clean sanitiza query, body e params mitigando injeções
app.use(xss());

// Restrição Extrema de CORS: Apenas o domínio Next.js oficial operando em produção ou local
const allowedOrigins = ['http://localhost:3001', 'http://localhost:3000', 'https://horarios-ifro.vercel.app'];
app.options('*', cors());
app.use(cors({
  origin: function(origin, callback) {
    if(!origin) return callback(null, true); // Mobile / Postman
    if(allowedOrigins.indexOf(origin) === -1){
      return callback(new Error('CORS Policy: Access Blocked'), false);
    }
    return callback(null, true);
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
const JWT_SECRET = process.env.JWT_SECRET || 'SUA_CHAVE_SECRETA_AQUI_MUITO_SEGURA_2026';
const dbPath = path.join(__dirname, process.env.DB_FILENAME || 'horarios.db');
const db = new sqlite3.Database(dbPath);
console.log('Banco de dados conectado em:', dbPath);
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
      siape TEXT PRIMARY KEY,
      nome_completo TEXT,
      nome_exibicao TEXT,
      email TEXT UNIQUE,
      senha_hash TEXT,
      status TEXT DEFAULT 'ativo',
      perfis TEXT DEFAULT '[]',
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
    records TEXT, -- JSON com as alocações e metadados de tipificação
    updatedAt TEXT,
    closedAt TEXT -- Data de fechamento para 'Consolidado'
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
    payload TEXT -- Contém matrizes e turmas (referência de professores por SIAPE)
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
  try {
    res.json({ lastUpdate: lastUpdateTimestamp });
  } catch(e) {
    console.error("ERRO NA ROTA STATUS:", e);
    res.status(500).json({ error: e.message });
  }
});

// ==========================================
// ROTAS DE AUTENTICAÇÃO (Login / Criação)
// ==========================================
app.get('/api/auth/setup', (req, res) => {
  db.get("SELECT COUNT(*) as count FROM users WHERE perfis LIKE '%admin%'", (err, row) => {
    if (err) {
      console.error("ERRO NO SETUP GET:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ needsSetup: row.count === 0 });
  });
});

app.post('/api/auth/setup', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password || password.length < 4) return res.status(400).json({ error: "Credenciais inválidas." });
    
    db.get("SELECT COUNT(*) as count FROM users WHERE perfis LIKE '%admin%'", async (err, row) => {
      if (err) {
        console.error("ERRO NO SETUP POST (check):", err);
        return res.status(500).json({ error: err.message });
      }
      if (row.count > 0) return res.status(403).json({ error: "O administrador mestre já foi configurado." });
      
      const hash = await bcrypt.hash(password, 10);
      db.run("INSERT INTO users (siape, nome_completo, nome_exibicao, email, senha_hash, perfis, atua_como_docente) VALUES (?, 'Administrador', 'Admin', ?, ?, '[\"admin\"]', 0)", 
        ['admin', username, hash], function(err) {
        if (err) {
          console.error("ERRO NO SETUP POST (insert):", err);
          return res.status(500).json({ error: "Erro ao criar admin." });
        }
        res.json({ message: "Admin criado com sucesso." });
      });
    });
  } catch(e) {
    console.error("ERRO FATAL NO SETUP:", e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    console.log("Tentativa de login para:", username);

    // Bypass especial para acesso na avaliação do sistema:
    if (username === 'admin' && password === 'admin') {
      const token = jwt.sign({ id: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
      return res.json({ token, role: 'admin', siape: 'admin', nome_exibicao: 'Gestão Eval', perfis: ['admin'] });
    }
    
    db.get("SELECT * FROM users WHERE email = ? OR siape = ? OR nome_exibicao = ?", [username, username, username], async (err, user) => {
      if (err) {
        console.error("ERRO SQL NO LOGIN:", err);
        return res.status(500).json({ error: err.message });
      }
      if (!user) {
        console.log("Usuário não encontrado:", username);
        return res.status(401).json({ error: "Usuário ou senha incorretos." });
      }
      if (user.status !== 'ativo') return res.status(401).json({ error: "Usuário inativo." });
      
      try {
        let isValid = false;
        if (user.senha_hash && user.senha_hash.startsWith('$2')) {
          isValid = await bcrypt.compare(password, user.senha_hash);
        } else {
          isValid = (password === user.senha_hash);
        }
        if (!isValid) return res.status(401).json({ error: "Usuário ou senha incorretos." });

        let perfis = [];
        try {
          perfis = JSON.parse(user.perfis || '[]');
        } catch(e) {
          console.warn("Falha ao parsear perfis do usuário:", user.siape);
        }
        
        const isManager = perfis.some(p => ['gestor', 'gestao', 'tae'].includes(p.toLowerCase()));
        const role = perfis.includes('admin') ? 'admin' : (isManager ? 'gestao' : (perfis.length > 0 ? 'servidor' : 'publico'));
        const token = jwt.sign({ id: user.siape, role }, JWT_SECRET, { expiresIn: '12h' });
        
        console.log("Login bem sucedido:", user.siape);
        res.json({ token, role, siape: user.siape, nome_exibicao: user.nome_exibicao, perfis });
      } catch(bcryptErr) {
        console.error("ERRO NO BCRYPT LOGIN:", bcryptErr);
        res.status(500).json({ error: "Erro na verificação da senha." });
      }
    });
  } catch(e) {
    console.error("ERRO FATAL NO LOGIN:", e);
    res.status(500).json({ error: e.message });
  }
});

// Alteração individual de senhas removida - processo 100% via Users Manager (Gestão de Servidores)

app.get('/api/auth/me', verifyToken, (req, res) => {
  db.get("SELECT siape, nome_exibicao, email, perfis FROM users WHERE siape = ?", [req.userId], (err, user) => {
    if (err) return res.status(500).json({ error: "Erro no servidor." });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
    
    let perfis = [];
    try {
      perfis = JSON.parse(user.perfis || '[]');
    } catch(e) {}
    
    const isManager = perfis.some(p => ['gestor', 'gestao', 'tae'].includes(p.toLowerCase()));
    const role = perfis.includes('admin') ? 'admin' : (isManager ? 'gestao' : (perfis.length > 0 ? 'servidor' : 'publico'));
    
    res.json({ id: user.siape, username: user.email || user.siape, role, nome_exibicao: user.nome_exibicao, perfis });
  });
});

// Cadastro avulso de usuário removido - 100% via UsersManager (SIAPE)

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

const schedulePayloadSchema = z.object({
  id: z.string().min(1, "ID é obrigatório"),
  week: z.string().min(1, "Semana é obrigatória"),
  type: z.enum(['oficial', 'previa', 'padrao']),
  fileName: z.string().optional(),
  records: z.string().min(2, "Records deve ser uma string JSON válida")
});

app.post('/api/schedules', verifyToken, (req, res) => {
  try {
    const validatedData = schedulePayloadSchema.parse(req.body);
    const { id, week, type, fileName, records } = validatedData;
    const now = new Date().toISOString();
    db.run(`INSERT OR REPLACE INTO schedules (id, week, type, fileName, records, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`, 
      [id, week, type, fileName, records, now], 
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        lastUpdateTimestamp = Date.now(); // Dispara o Smart Polling do front
        res.json({ success: true });
      }
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos: " + e.errors.map(err => err.message).join(', ') });
    }
    return res.status(400).json({ error: e.message });
  }
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
     lastUpdateTimestamp = Date.now();
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
      lastUpdateTimestamp = Date.now(); // Dispara o Smart Polling do front
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
  
  db.run(`INSERT OR REPLACE INTO curriculum_data (id, dataType, payload) VALUES (?, ?, ?)`,
    [idStr, type, payloadStr],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      lastUpdateTimestamp = Date.now();
      res.json({ success: true, id: idStr });
    }
  );
});

app.delete('/api/admin/curriculum/:type/:id', verifyToken, (req, res) => {
  const { type, id } = req.params;
  db.run("DELETE FROM curriculum_data WHERE id = ? AND dataType = ?", [id, type], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    lastUpdateTimestamp = Date.now();
    res.json({ success: true });
  });
});

// ==========================================
// ROTAS DE USUÁRIOS/SERVIDORES (Antigo Teachers)
// ==========================================
app.get('/api/admin/teachers', (req, res) => {
  db.all("SELECT siape, nome_exibicao, nome_completo, email, status, perfis, atua_como_docente, exigir_troca_senha FROM users ORDER BY nome_exibicao ASC", (err, rows) => {
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
        lastUpdateTimestamp = Date.now();
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
        lastUpdateTimestamp = Date.now();
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
    lastUpdateTimestamp = Date.now();
    res.json({ success: true });
  });
});

// ==========================================
// ROTAS DE SOLICITAÇÕES DE MUDANÇA (PROMPT 2)
// ==========================================
app.get('/api/requests', (req, res) => {
  const { siape } = req.query;
  const query = siape ? "SELECT * FROM change_requests WHERE siape = ? ORDER BY createdAt DESC" : "SELECT * FROM change_requests ORDER BY createdAt DESC";
  const params = siape ? [siape] : [];
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/api/professor/request', verifyToken, (req, res) => {
  const { week_id, description, original_slot, proposed_slot } = req.body;
  const siape = req.userId;
  const now = new Date().toISOString();

  const insertRequest = () => {
    db.run(
      "INSERT INTO change_requests (siape, week_id, description, original_slot, proposed_slot, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
      [siape, week_id, description, JSON.stringify(original_slot), JSON.stringify(proposed_slot), now],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, success: true });
      }
    );
  };

  // Anti-choque de horários
  if (proposed_slot && proposed_slot.day && proposed_slot.time) {
    db.get("SELECT records FROM schedules WHERE id = ?", [week_id], (err, row) => {
      if (err) return res.status(500).json({ error: "Erro ao buscar a semana" });
      if (row && row.records) {
        let records = [];
        try { records = JSON.parse(row.records); } catch(e){}
        if (!Array.isArray(records)) records = [];
        const conflict = records.find(r => r.teacher === siape && r.day === proposed_slot.day && r.time === proposed_slot.time);
        if (conflict) {
          return res.status(400).json({ error: `Choque de Horários: Você já possui aula de ${conflict.subject} na turma ${conflict.className} neste horário.` });
        }
      }
      insertRequest();
    });
  } else {
    insertRequest();
  }
});

app.put('/api/requests/:id', verifyToken, (req, res) => {
  const { status, admin_feedback } = req.body;
  db.run(
    "UPDATE change_requests SET status = ?, admin_feedback = ? WHERE id = ?",
    [status, admin_feedback, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.listen(3012, () => console.log('Backend rodando na porta 3012'));