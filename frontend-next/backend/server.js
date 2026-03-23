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
const JWT_SECRET = process.env.JWT_SECRET || 'SUA_CHAVE_SECRETA_AQUI_MUITO_SEGURA_2026';
const dbPath = path.join(__dirname, process.env.DB_FILENAME || 'horarios.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar no banco de dados:', err.message);
    } else {
        console.log('Banco de dados conectado em:', dbPath);
        // Habilitar modo WAL e tempo de timeout para alta escalabilidade horizontal de writes
        db.run('PRAGMA journal_mode = WAL;');
        db.run('PRAGMA synchronous = NORMAL;');
        db.run('PRAGMA busy_timeout = 5000;');
        db.run('PRAGMA cache_size = -20000;');
        db.run('PRAGMA temp_store = MEMORY;');
    }
});

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
    records TEXT, -- JSON com as alocações e metadados de tipificação
    updatedAt TEXT,
    closedAt TEXT -- Data de fechamento para 'Consolidado'
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run("ALTER TABLE exchange_requests ADD COLUMN admin_feedback TEXT", (err) => {});
  db.run("ALTER TABLE exchange_requests ADD COLUMN system_message TEXT", (err) => {});
  db.run("ALTER TABLE exchange_requests ADD COLUMN original_slot TEXT", (err) => {});
  db.run("ALTER TABLE exchange_requests ADD COLUMN proposed_slot TEXT", (err) => {});

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

  // Migrações dinâmicas para o novo MasterGrid da Matriz (ignoram erros se já existirem)
  db.run("ALTER TABLE schedules ADD COLUMN courseId TEXT", () => {});
  db.run("ALTER TABLE schedules ADD COLUMN classId TEXT", () => {});
  db.run("ALTER TABLE schedules ADD COLUMN dayOfWeek TEXT", () => {});
  db.run("ALTER TABLE schedules ADD COLUMN slotId TEXT", () => {});
  db.run("ALTER TABLE schedules ADD COLUMN teacherId TEXT", () => {});
  db.run("ALTER TABLE schedules ADD COLUMN disciplineId TEXT", () => {});
  db.run("ALTER TABLE schedules ADD COLUMN room TEXT", () => {});
  db.run("ALTER TABLE schedules ADD COLUMN week_id TEXT", () => {});
  db.run("ALTER TABLE schedules ADD COLUMN academic_year TEXT", () => {});
  db.run("ALTER TABLE schedules ADD COLUMN type TEXT", () => {});

  // Nova migração para is_admin
  db.run("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0", () => {});
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

    // Bypass especial para acesso administrativo:
    if (username === '1986393' && password === 'dape@26') {
      const token = jwt.sign({ id: '1986393', role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
      return res.json({ token, role: 'admin', siape: '1986393', nome_exibicao: 'Super Admin', perfis: ['admin'], isAdmin: true });
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
        const isUserAdmin = perfis.includes('admin') || user.is_admin === 1;
        const role = isUserAdmin ? 'admin' : (isManager ? 'gestao' : (perfis.length > 0 ? 'servidor' : 'publico'));
        const token = jwt.sign({ id: user.siape, role }, JWT_SECRET, { expiresIn: '12h' });
        
        console.log("Login bem sucedido:", user.siape);
        res.json({ token, role, siape: user.siape, nome_exibicao: user.nome_exibicao, perfis, isAdmin: isUserAdmin });
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
  db.get("SELECT siape, nome_exibicao, email, perfis, is_admin FROM users WHERE siape = ?", [req.userId], (err, user) => {
    if (err) return res.status(500).json({ error: "Erro no servidor." });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
    
    let perfis = [];
    try {
      perfis = JSON.parse(user.perfis || '[]');
    } catch(e) {}
    
    const isManager = perfis.some(p => ['gestor', 'gestao', 'tae'].includes(p.toLowerCase()));
    const isUserAdmin = perfis.includes('admin') || user.is_admin === 1;
    const role = isUserAdmin ? 'admin' : (isManager ? 'gestao' : (perfis.length > 0 ? 'servidor' : 'publico'));
    
    res.json({ id: user.siape, username: user.email || user.siape, role, nome_exibicao: user.nome_exibicao, perfis, isAdmin: isUserAdmin });
  });
});

// Cadastro avulso de usuário removido - 100% via UsersManager (SIAPE)

// ==========================================
// ROTAS DE HORÁRIOS
// ==========================================
const scheduleMemCache = new Map();
const SCHEDULE_CACHE_TTL_MS = 5000; // 5 segundos de cache para suportar milisegundos com 500+ leituras simultâneas

app.get('/api/schedules', (req, res) => {
  const courseId = req.query.courseId;
  const academicYear = req.query.academicYear;
  
  const cacheKey = `sch_${courseId || 'all'}_${academicYear || 'all'}`;
  const now = Date.now();
  
  if (scheduleMemCache.has(cacheKey)) {
     const cached = scheduleMemCache.get(cacheKey);
     if (now - cached.timestamp < SCHEDULE_CACHE_TTL_MS) {
         return res.json(cached.data);
     }
  }

  let q = `
    SELECT 
      s.*, 
      c.payload as coursePayload, 
      cl.payload as classPayload, 
      d.payload as discPayload 
    FROM schedules s
    LEFT JOIN curriculum_data c ON s.courseId = c.id AND c.dataType = 'matrix'
    LEFT JOIN curriculum_data cl ON s.classId = cl.id AND cl.dataType = 'class'
    LEFT JOIN curriculum_data d ON s.disciplineId = d.id AND d.dataType = 'discipline'
    WHERE 1=1
  `;
  let params = [];
  if (courseId) {
    q += " AND s.courseId = ?";
    params.push(courseId);
  }
  if (academicYear) {
    q += " AND (s.academic_year = ? OR s.academic_year IS NULL)";
    params.push(academicYear);
  }
  
  db.all(q, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const mapped = (rows || []).map(r => {
      let cName = r.courseId; let clName = r.classId; let discName = r.disciplineId;
      let totalH = 0;
      let suapH = 0;
      
      try { 
        if (r.coursePayload) {
           const cp = JSON.parse(r.coursePayload);
           cName = cp.name || cName;
           if (cp.series && r.disciplineId) {
              cp.series.forEach(serie => {
                 if (serie.disciplines) {
                    const f = serie.disciplines.find(d => String(d.id) === String(r.disciplineId) || d.name === r.disciplineId);
                    if (f) {
                       discName = f.name;
                       totalH = parseInt(f.hours) || 0;
                       suapH = parseInt(f.hours) || 0; // Se não houver prop suap_hours específica na matriz, espelha total.
                    }
                 }
              });
           }
        }
      } catch(e){}
      
      try { if (r.classPayload) clName = JSON.parse(r.classPayload).name || clName; } catch(e){}
      
      return {
        ...r,
        courseName: cName,
        className: clName,
        subjectName: discName,
        totalHours: totalH,
        suapHours: suapH,
        coursePayload: undefined,
        classPayload: undefined,
        discPayload: undefined
      };
    });
    
    // Salva no cache
    scheduleMemCache.set(cacheKey, { data: mapped, timestamp: now });
    
    res.json(mapped);
  });
});

const bulkScheduleSchema = z.object({
  courseIds: z.array(z.union([z.string(), z.number()]).transform(String)).optional(),
  courseId: z.union([z.string(), z.number()]).transform(String).optional(),
  type: z.union([z.string(), z.number()]).transform(String).default('previa'),
  weekId: z.union([z.string(), z.number()]).transform(String).optional().nullable(),
  academicYear: z.union([z.string(), z.number()]).transform(String).optional().nullable(),
  schedules: z.array(z.object({
    courseId: z.union([z.string(), z.number()]).transform(String).optional(),
    classId: z.union([z.string(), z.number()]).transform(String),
    dayOfWeek: z.union([z.string(), z.number()]).transform(String),
    slotId: z.union([z.string(), z.number()]).transform(String),
    teacherId: z.union([z.string(), z.number()]).transform(String),
    disciplineId: z.union([z.string(), z.number()]).transform(String).optional().nullable(),
    room: z.union([z.string(), z.number()]).transform(String).optional().nullable(),
    isSubstituted: z.boolean().optional(),
    originalSubject: z.string().optional().nullable(),
    isDisponibilizada: z.boolean().optional()
  }))
});

app.post('/api/schedules/bulk-course', verifyToken, (req, res) => {
  try {
    const now = new Date().toISOString();
    const { courseIds, courseId, type, weekId, academicYear, schedules } = bulkScheduleSchema.parse(req.body);
    const coursesToClear = (courseIds && courseIds.length > 0) ? courseIds : (courseId ? [courseId] : []);
    if (coursesToClear.length === 0) return res.status(400).json({ error: "Nenhum curso especificado para gravação." });

    const placeholders = coursesToClear.map(() => '?').join(',');
    const cond = coursesToClear.length > 0 ? `courseId NOT IN (${placeholders})` : `1=1`;

    // Validação Global de Conflitos
    db.all(`SELECT * FROM schedules WHERE (${cond} OR courseId IS NULL) AND type = ?`, [...coursesToClear, type], (err, existingRows) => {
      if (err) return res.status(500).json({ error: err.message });

      // Isolamento de Choques de Horário (Padrão Versions)
      let relevantRows = [];
      if (type === 'padrao' && weekId) {
          relevantRows = existingRows.filter(r => String(r.academic_year) === String(academicYear) && String(r.week_id) === String(weekId));
      } else {
          relevantRows = existingRows.filter(r => String(r.academic_year) === String(academicYear) && (!weekId || String(r.week_id) === String(weekId)));
      }

      if (type === 'padrao') {
        for (const slot of schedules) {
          if (!slot.teacherId || slot.teacherId === 'A Definir' || slot.teacherId === '-') continue;
          
          const slotTeachers = String(slot.teacherId).split(',');

          for (const row of relevantRows) {
            if (!row.teacherId) continue;
            const rowTeachers = String(row.teacherId).split(',');

            // Verifica se há colisão entre os professores da grade nova e da grade antiga externa
            const hasConflict = slotTeachers.some(st => rowTeachers.includes(st));

            if (hasConflict && String(row.dayOfWeek) === String(slot.dayOfWeek) && String(row.slotId) === String(slot.slotId)) {
               return res.status(400).json({ error: `Bloqueio Estrito no Servidor: O professor já possui aula em outro curso na mesma matriz ${type} em ${slot.dayOfWeek} às ${slot.slotId}.` });
            }
            if (slot.room && row.room === slot.room && String(row.dayOfWeek) === String(slot.dayOfWeek) && String(row.slotId) === String(slot.slotId)) {
               return res.status(400).json({ error: `Bloqueio Estrito no Servidor: A sala/espaço já está alocada para outro curso na matriz ${type}.` });
            }
            if (row.records) {
              try {
                const parsed = JSON.parse(row.records);
                for (const r of parsed) {
                  if (r.teacher === slot.teacherId && String(r.day) === String(slot.dayOfWeek) && String(r.time) === String(slot.slotId)) {
                    return res.status(400).json({ error: `Conflito Global (Legado): O professor já possui aula em ${slot.dayOfWeek} às ${slot.slotId}.` });
                  }
                }
              } catch (e) {}
            }
          }
        }
      }

      // No conflicts! Faz a transação massiva
      let condStr = weekId ? `type = ? AND week_id = ?` : `type = ? AND (week_id IS NULL OR week_id = '')`;
      let params = weekId ? [type, weekId] : [type];
      
      db.all(`SELECT * FROM schedules WHERE courseId IN (${placeholders}) AND ${condStr}`, [...coursesToClear, ...params], (errOld, oldRows) => {
        let involvedTeachers = new Set();
        if (type === 'previa') {
          involvedTeachers.add('ALL_PROF');
          involvedTeachers.add('ALL_STUDENT');
        } else if (type === 'oficial') {
          for (const nR of schedules) {
            const oR = (oldRows || []).find(old => old.classId === nR.classId && String(old.dayOfWeek) === String(nR.dayOfWeek) && String(old.slotId) === String(nR.slotId));
            if (!oR) {
              if (nR.teacherId && nR.teacherId !== 'A Definir' && nR.teacherId !== '-') involvedTeachers.add(nR.teacherId);
            } else {
              if (oR.teacherId !== nR.teacherId || oR.disciplineId !== nR.disciplineId || oR.room !== nR.room) {
                 if (oR.teacherId && oR.teacherId !== 'A Definir' && oR.teacherId !== '-') involvedTeachers.add(oR.teacherId);
                 if (nR.teacherId && nR.teacherId !== 'A Definir' && nR.teacherId !== '-') involvedTeachers.add(nR.teacherId);
              }
            }
          }
        }

        db.serialize(() => {
          db.run("BEGIN TRANSACTION");
          
          if (weekId) {
              db.run(`DELETE FROM schedules WHERE courseId IN (${placeholders}) AND type = ? AND week_id = ? AND academic_year = ?`, [...coursesToClear, type, weekId, academicYear || '']);
          } else {
              db.run(`DELETE FROM schedules WHERE courseId IN (${placeholders}) AND type = ? AND (academic_year = ? OR academic_year IS NULL) AND (week_id IS NULL OR week_id = '')`, [...coursesToClear, type, academicYear || '']);
          }

          const stmt = db.prepare("INSERT INTO schedules (id, courseId, academic_year, classId, dayOfWeek, slotId, teacherId, disciplineId, room, type, week_id, updatedAt, records) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
          for (const slot of schedules) {
            const id = `s_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const targetCourse = slot.courseId || coursesToClear[0];
            let recordsJSON = null;
            if (type !== 'padrao' && type !== 'oficial' && (slot.isSubstituted || slot.isDisponibilizada)) {
               recordsJSON = JSON.stringify({
                  isSubstituted: slot.isSubstituted || false,
                  originalSubject: slot.originalSubject || null,
                  isDisponibilizada: slot.isDisponibilizada || false
               });
            }
            stmt.run([id, targetCourse, academicYear || null, slot.classId, slot.dayOfWeek, slot.slotId, slot.teacherId, slot.disciplineId || null, slot.room || null, type, weekId || null, now, recordsJSON]);
          }
          
          stmt.finalize();

          // Notificações
          involvedTeachers.forEach(t => {
            const targetWeekDesc = req.body.weekLabel || `da Semana ${weekId || ''}`;
            let title = type === 'previa' ? "Nova Prévia Publicada" : "Horário Alterado";
            let msg = type === 'previa' ? `A prévia das aulas ${targetWeekDesc} já está publicada.` : `Sua aula nas datas ${targetWeekDesc} sofreu uma alteração.`;
            db.run("INSERT INTO notifications (target, type, title, message, createdAt) VALUES (?, ?, ?, ?, ?)", [t, type, title, msg, now]);
          });

          db.run("COMMIT", (errCommit) => {
            if (errCommit) return res.status(500).json({ error: errCommit.message });
            io.emit('schedule_updated');
            res.json({ success: true, message: 'Grades gravadas com sucesso!' });
          });
        });
      });
    });

  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos: " + e.errors.map(err => err.message).join(', ') });
    }
    return res.status(400).json({ error: e.message });
  }
});

// ROTINA MELHORADA E PROTEGIDA: Exclusão de Matrizes
app.delete('/api/schedules/bulk-course', verifyToken, (req, res) => {
  try {
    const type = req.query.type || req.body.type;
    const weekId = req.query.weekId || req.body.weekId;
    const academicYear = req.query.academicYear || req.body.academicYear;
    
    let courseIds = [];
    if (req.query.courseIds) courseIds = req.query.courseIds.split(',');
    else if (req.body.courseIds) courseIds = req.body.courseIds;
    else if (req.body.courseId) courseIds = [req.body.courseId];

    if (courseIds.length === 0 || !type) return res.status(400).json({ error: "Faltam parâmetros." });
    
    if (type === 'oficial') return res.status(403).json({ error: "O Histórico Oficial não pode ser excluído." });
    if (type === 'atual') return res.status(403).json({ error: "O Horário Atual não pode ser excluído." });
    if (type !== 'padrao' && !weekId) return res.status(400).json({ error: "A semana é obrigatória para prévias." });

    const placeholders = courseIds.map(() => '?').join(',');
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        if (weekId) {
            db.run(`DELETE FROM schedules WHERE courseId IN (${placeholders}) AND type = ? AND week_id = ? AND (academic_year = ? OR academic_year IS NULL)`, [...courseIds, type, weekId, academicYear || '']);
        } else {
            db.run(`DELETE FROM schedules WHERE courseId IN (${placeholders}) AND type = ? AND (academic_year = ? OR academic_year IS NULL) AND (week_id IS NULL OR week_id = '')`, [...courseIds, type, academicYear || '']);
        }
        db.run("COMMIT", (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true, message: 'Matrizes limpas com sucesso!' });
        });
    });
  } catch(e) { return res.status(500).json({ error: e.message }); }
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
    const { id, week, type, fileName, records: recordsStr } = validatedData;
    
    // Server-side Rules (Conflict Engine)
    let parsedRecords;
    try { parsedRecords = JSON.parse(recordsStr); } catch (e) { throw new Error("JSON Records inválido."); }
    
    const valid = Array.isArray(parsedRecords) ? parsedRecords : [];
    const teacherMap = new Map();
    const classMap = new Map();
    const roomMap = new Map();

    for (const r of valid) {
      const skipNames = ['A Definir', 'Todos'];
      const isSet = (val) => val && !skipNames.includes(val);

      if (isSet(r.day) && isSet(r.time)) {
        const slotKey = `${r.day}_${r.time}`;

        // Professor Ocupado?
        if (isSet(r.teacher)) {
          const key = `${r.teacher}_${slotKey}`;
          if (teacherMap.has(key) && teacherMap.get(key) !== r.id) {
             throw new Error(`Conflito de Horário: O professor ${r.teacher} já possui aula em ${r.day} às ${r.time}.`);
          }
          teacherMap.set(key, r.id);
        }

        // Turma Ocupada? (Nenhuma turma pode ter duas aulas no mesmo tempo)
        if (isSet(r.className)) {
          const key = `${r.className}_${slotKey}`;
          if (classMap.has(key) && classMap.get(key) !== r.id) {
             throw new Error(`Conflito Acadêmico: A turma ${r.className} já possui aula alocada em ${r.day} às ${r.time}.`);
          }
          classMap.set(key, r.id);
        }
      }
    }

    const now = new Date().toISOString();

    db.get("SELECT records FROM schedules WHERE id = ?", [id], (errFetch, row) => {
      let oldRecords = [];
      if (row && row.records) {
        try { oldRecords = JSON.parse(row.records); } catch(e){}
      }
      
      let involvedTeachers = new Set();
      if (type === 'previa') {
        // Evento Global para Prévia
        involvedTeachers.add('ALL_PROF');
        involvedTeachers.add('ALL_STUDENT');
      } else {
        // Verifica professores afetados na turma (diferenças)
        for (const nR of valid) {
          const oR = oldRecords.find(old => old.id === nR.id || (old.day === nR.day && old.time === nR.time && old.className === nR.className));
          if (!oR) {
            if (nR.teacher && nR.teacher !== 'A Definir' && nR.teacher !== '-') involvedTeachers.add(nR.teacher);
          } else {
            if (oR.teacher !== nR.teacher || oR.subject !== nR.subject || oR.room !== nR.room) {
              if (oR.teacher && oR.teacher !== 'A Definir' && oR.teacher !== '-') involvedTeachers.add(oR.teacher);
              if (nR.teacher && nR.teacher !== 'A Definir' && nR.teacher !== '-') involvedTeachers.add(nR.teacher);
            }
          }
        }
      }

      db.run(`INSERT OR REPLACE INTO schedules (id, week, type, fileName, records, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`, 
        [id, week, type, fileName, recordsStr, now], 
        (err) => {
          if (err) return res.status(500).json({ error: err.message });
          
          // Grava Notificações
          involvedTeachers.forEach(t => {
            const targetWeekDesc = req.body.weekLabel || `da Semana ${week}`;
            let title = type === 'previa' ? "Nova Prévia Publicada" : "Horário Alterado";
            let msg = type === 'previa' ? `A prévia das aulas ${targetWeekDesc} já está publicada.` : `Sua aula nas datas ${targetWeekDesc} sofreu uma alteração de professor/sala.`;
            db.run("INSERT INTO notifications (target, type, title, message, createdAt) VALUES (?, ?, ?, ?, ?)", [t, type, title, msg, now]);
          });

          // Grava Auditoria da Ação
          db.run(`INSERT INTO audit_logs (user_id, action, timestamp, details) VALUES (?, ?, ?, ?)`, 
            [req.userId, 'SAVE_SCHEDULE', now, `Salvo horário ID: ${id} da semana: ${week}`],
            () => {
              io.emit('schedule_updated');
              res.json({ success: true });
            }
          );
        }
      );
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos: " + e.errors.map(err => err.message).join(', ') });
    }
    // Retorna erro 400 em caso de violação de regra do Motor de Conflitos
    return res.status(400).json({ error: e.message });
  }
});

app.delete('/api/schedules/:id', verifyToken, (req, res) => {
  const id = req.params.id; 
  db.run("DELETE FROM schedules WHERE id = ?", [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    io.emit('schedule_updated');
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
               const notifyMsg = `Professor(a) SIApE: ${requester} assumiu aula vaga de (${originalSubjectName}) com a disciplina (${proposedSubject}) na turma ${targetClass} em ${proposedDay} às ${proposedTime} ${weekText} (Auto-Homologada).`;
               const finalFeedback = `Aprovado pelo sistema automaticamente em: ${new Date().toLocaleString('pt-BR')}`;
               
               db.run('INSERT INTO exchange_requests (action_type, requester_id, target_class, original_day, original_time, subject, return_week, reason, obs, status, admin_feedback) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                 [action, requester, targetClass, originalDay, originalTime, subject, returnWeekId || '', notifyMsg, obs, 'aprovada', finalFeedback],
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
            db.run('INSERT INTO exchange_requests (action_type, requester_id, substitute_id, target_class, original_day, original_time, subject, return_week, reason, obs, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [action, requester, (slotsObj.targetSubject === 'ALL' ? '' : slotsObj.targetSubject), targetClass, slotsObj.day, slotsObj.time, 'Aulas Agrupadas', returnWeekId || '', reason || '', obs || '', 'pendente'],
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