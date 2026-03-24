const express = require('express');
const db = require('../db');
const { verifyToken } = require('../middlewares/auth.middleware');
const bcrypt = require('bcryptjs');

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

router.put('/disciplines', verifyToken, (req, res) => {
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

router.put('/subject-hours', verifyToken, (req, res) => {
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

router.put('/academic-years', verifyToken, (req, res) => {
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

router.put('/curriculum/:type', verifyToken, (req, res) => {
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

router.delete('/curriculum/:type/:id', verifyToken, (req, res) => {
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
router.get('/teachers', (req, res) => {
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

router.put('/teachers', verifyToken, async (req, res) => {
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

router.post('/teachers/batch', verifyToken, async (req, res) => {
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

router.delete('/teachers/:siape', verifyToken, (req, res) => {
  db.run("DELETE FROM users WHERE siape = ?", [req.params.siape], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    io.emit('schedule_updated');
    res.json({ success: true });
  });
});

router.put('/teachers/:siape/admin-status', verifyToken, (req, res) => {
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


  return router;
};
