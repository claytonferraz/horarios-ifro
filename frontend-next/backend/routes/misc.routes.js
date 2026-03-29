const express = require('express');
const db = require('../db');
const { attachUserIfPresent, requirePublicScheduleAccess } = require('../middlewares/auth.middleware');

module.exports = function(io) {
  const router = express.Router();

  // ==========================================
  // ROTA PÚBLICA DE STATUS
  // ==========================================
  router.get('/status', (req, res) => {
    try {
      res.json({ lastUpdate: new Date().toISOString() }); // Idealmente buscar do orquestrador global
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==========================================
  // ROTA PÚBLICA DE LISTA DE PROFESSORES
  // ==========================================
  router.get('/teachers', attachUserIfPresent, requirePublicScheduleAccess, (req, res) => {
    db.all(
      "SELECT siape, nome_exibicao, nome_completo FROM users WHERE status = 'ativo' AND atua_como_docente = 1 ORDER BY COALESCE(NULLIF(nome_exibicao,''), nome_completo) ASC",
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
      }
    );
  });

  // ==========================================
  // ROTA PÚBLICA DE DICIONÁRIO DE CURRÍCULO
  // ==========================================
  router.get('/curriculum/:type', (req, res) => {
    const { type } = req.params;
    if (!['matrix', 'class'].includes(type)) return res.status(400).json({ error: 'Tipo inválido' });
    db.all("SELECT id, payload FROM curriculum_data WHERE dataType = ?", [type], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const records = (rows || []).map(r => {
        try { return JSON.parse(r.payload); } catch (e) { return null; }
      }).filter(Boolean);
      res.json(records);
    });
  });

  return router;
};
