const express = require('express');
const db = require('../db');
const { verifyToken, requireAdmin, requireManager } = require('../middlewares/auth.middleware');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { z } = require('zod');

const booleanishSchema = z.union([z.boolean(), z.number().int().min(0).max(1)]);

const teacherSchema = z.object({
  siape: z.string().trim().min(1),
  nome_exibicao: z.string().trim().optional().or(z.literal('')),
  nome_completo: z.string().trim().min(1),
  email: z.string().trim().email().nullable().optional().or(z.literal('')),
  senha: z.string().min(8).optional(),
  status: z.string().trim().optional(),
  perfis: z.array(z.string()).optional(),
  atua_como_docente: booleanishSchema.optional(),
});

const adminStatusSchema = z.object({
  is_admin: z.boolean(),
});

module.exports = function(io) {
  const router = express.Router();
// ==========================================
// ROTAS GESTÃO ACADÊMICA (ADMIN & ESTATÍSTICAS)
// ==========================================

// --- SUAP: Vinculado à Turma/Disciplina ---
router.get('/disciplines', (req, res) => { // Público para o painel do Professor ler
  db.all("SELECT * FROM discipline_meta", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const map = {};
    (rows || []).forEach(r => { map[r.id] = { suapHours: r.suapHours }; });
    res.json(map);
  });
});

router.put('/disciplines', verifyToken, requireManager, (req, res) => {
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
router.get('/subject-hours', (req, res) => { // Público para o painel do Professor ler
  db.all("SELECT * FROM subject_hours", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const map = {};
    (rows || []).forEach(r => { map[r.id] = { totalHours: r.totalHours }; });
    res.json(map);
  });
});

router.put('/subject-hours', verifyToken, requireManager, (req, res) => {
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
router.get('/academic-years', (req, res) => { // Público para o painel do Professor ler
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

router.put('/academic-years', verifyToken, requireManager, (req, res) => {
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
router.get('/curriculum/:type', (req, res) => {
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

router.put('/curriculum/:type', verifyToken, requireManager, (req, res) => {
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

router.delete('/curriculum/:type/:id', verifyToken, requireManager, (req, res) => {
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
router.get('/teachers', verifyToken, requireManager, (req, res) => {
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

router.put('/teachers', verifyToken, requireAdmin, async (req, res) => {
  let payload;
  try {
    payload = teacherSchema.parse(req.body);
  } catch (error) {
    return res.status(400).json({ error: error.issues?.[0]?.message || 'Dados inválidos.' });
  }

  let { siape, nome_exibicao, nome_completo, email, senha, status, perfis, atua_como_docente } = payload;

  const perfisStr = JSON.stringify(perfis || []);
  const atuaDoc = atua_como_docente ? 1 : 0;

  db.get("SELECT senha_hash, exigir_troca_senha FROM users WHERE siape = ?", [siape], async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    
    let finalHash = row ? row.senha_hash : null;
    
    if (!finalHash && !senha) senha = crypto.randomBytes(12).toString('base64url');
    if (senha) finalHash = await bcrypt.hash(senha, 10);
    
    // Se a senha foi alterada via admin, força a flag de exigir_troca_senha para 1. Se não, mantém a atual.
    const exigirTroca = senha ? 1 : (row ? row.exigir_troca_senha : 1);

    if (row) {
      db.run(
        `UPDATE users
         SET nome_exibicao = ?, nome_completo = ?, email = ?, senha_hash = ?, status = ?, perfis = ?, atua_como_docente = ?, exigir_troca_senha = ?
         WHERE siape = ?`,
        [nome_exibicao || '', nome_completo, email || null, finalHash, status || 'ativo', perfisStr, atuaDoc, exigirTroca, siape],
        (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });
          io.emit('schedule_updated');
          res.json({ success: true, siape });
        }
      );
      return;
    }

    db.run(
      `INSERT INTO users (siape, nome_exibicao, nome_completo, email, senha_hash, status, perfis, atua_como_docente, exigir_troca_senha)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [siape, nome_exibicao || '', nome_completo, email || null, finalHash, status || 'ativo', perfisStr, atuaDoc, exigirTroca],
      (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        io.emit('schedule_updated');
        res.json({ success: true, siape });
      }
    );
  });
});

router.post('/teachers/batch', verifyToken, requireAdmin, async (req, res) => {
  const users = req.body;
  if (!Array.isArray(users)) return res.status(400).json({ error: "O corpo da requisição deve ser um array." });

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    const stmtMerge = db.prepare(`
      INSERT INTO users (siape, nome_exibicao, nome_completo, email, senha_hash, status, perfis, atua_como_docente, exigir_troca_senha)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(siape) DO UPDATE SET
        nome_exibicao = excluded.nome_exibicao,
        nome_completo = excluded.nome_completo,
        email = excluded.email,
        senha_hash = excluded.senha_hash,
        status = excluded.status,
        perfis = excluded.perfis,
        atua_como_docente = excluded.atua_como_docente,
        exigir_troca_senha = excluded.exigir_troca_senha
    `);
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
              finalHash = await bcrypt.hash(crypto.randomBytes(12).toString('base64url'), 10);
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
        db.run("COMMIT", (commitErr) => {
          if (commitErr) {
            db.run("ROLLBACK");
            return res.status(500).json({ error: commitErr.message });
          }
          io.emit('schedule_updated');
          return res.json({ success: true, count: users.length });
        });
      } catch (err) {
        db.run("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    })();
  });
});

router.delete('/teachers/:siape', verifyToken, requireAdmin, (req, res) => {
  db.run("DELETE FROM users WHERE siape = ?", [req.params.siape], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    io.emit('schedule_updated');
    res.json({ success: true });
  });
});

router.put('/teachers/:siape/admin-status', verifyToken, requireAdmin, (req, res) => {
  let payload;
  try {
    payload = adminStatusSchema.parse(req.body);
  } catch (error) {
    return res.status(400).json({ error: error.issues?.[0]?.message || 'Dados inválidos.' });
  }

  const { is_admin } = payload;
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

// --- AUDITORIA E LOGS (Para Dashboard) ---
router.get('/audit-logs', verifyToken, requireAdmin, (req, res) => {
  db.all("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 20", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

router.get('/conflict-logs', verifyToken, requireManager, (req, res) => {
  db.all("SELECT * FROM conflict_logs ORDER BY id DESC LIMIT 20", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// ==========================================
// ROTAS DE BACKUP / RESTORE DO BANCO (DAPE)
// ==========================================

router.get('/export-db', verifyToken, requireAdmin, (req, res) => {
  try {
      const dbPath = path.join(__dirname, '../horarios.db');
      if (fs.existsSync(dbPath)) {
          // Força o checkpoint do WAL para garantir que todos os dados fluem para o DB principal antes do download
          db.run("PRAGMA wal_checkpoint(TRUNCATE)", (err) => {
              if (err) console.error("Erro ao fazer checkpoint do WAL:", err);
              res.download(dbPath, `horarios_backup_${Date.now()}.db`);
          });
      } else {
          res.status(404).json({ error: "Banco de dados não encontrado." });
      }
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});

router.post('/import-db', verifyToken, requireAdmin, express.raw({ type: 'application/octet-stream', limit: '100mb' }), (req, res) => {
  try {
      if (!req.body || req.body.length === 0) {
          return res.status(400).json({ error: "Arquivo vazio ou formato inválido." });
      }
      // Valida magic bytes do SQLite ("SQLite format 3\0")
      const SQLITE_MAGIC = Buffer.from('53514c69746520666f726d6174203300', 'hex');
      if (req.body.length < 16 || !req.body.slice(0, 16).equals(SQLITE_MAGIC)) {
          return res.status(400).json({ error: "Arquivo inválido: não é um banco SQLite." });
      }
      
      const dbPath = path.join(__dirname, '../horarios.db');
      const backupDir = path.join(__dirname, '../backups');
      
      // Cria backup de segurança antes de sobrescrever
      if (fs.existsSync(dbPath)) {
          if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
          fs.copyFileSync(dbPath, path.join(backupDir, `horarios_pre_import_${Date.now()}.db`));
      }
      
      // Sobrescreve o arquivo físico
      fs.writeFileSync(dbPath, req.body);
      
      // Apaga os arquivos temporários do SQLite (WAL e SHM) para forçar leitura limpa
      const walPath = dbPath + '-wal';
      const shmPath = dbPath + '-shm';
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

      io.emit('schedule_updated');
      res.json({ success: true, message: "Banco importado com sucesso! A grade já foi atualizada." });
  } catch (error) {
      console.error("Erro na importação:", error);
      res.status(500).json({ error: "Erro na restauração: " + error.message });
  }
});


  return router;
};
