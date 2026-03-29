const express = require('express');
const db = require('../db');
const { verifyToken } = require('../middlewares/auth.middleware');

module.exports = function(io) {
  const router = express.Router();

  // ==========================================
  // ROTA DE NOTIFICAÇÕES (Chat/Alert Widget)
  // ==========================================
  router.get('/', verifyToken, (req, res) => {
    const limit = 30;
    const siape = req.user.siape || '';

    const targets = ["ALL", "ALL_PROF"];
    if (req.user.isAdmin || req.user.isManager) targets.push('ALL_ADMIN');
    if (siape) targets.push(siape);

    const inStr = targets.map(() => '?').join(',');
    const query = `
      SELECT n.*, (CASE WHEN r.siape IS NOT NULL THEN 1 ELSE 0 END) as isRead
      FROM notifications n
      LEFT JOIN notification_read_status r ON n.id = r.notification_id AND r.siape = ?
      WHERE n.target IN (${inStr}) 
      ORDER BY n.id DESC LIMIT ?
    `;

    db.all(query, [siape, ...targets, limit], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    });
  });

  router.post('/read', verifyToken, (req, res) => {
    const { ids } = req.body;
    const siape = req.user.siape;
    if (!siape) return res.status(401).json({ error: "SIAPE não identificado." });
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: "Lista de IDs inválida." });

    const stmt = db.prepare("INSERT OR IGNORE INTO notification_read_status (notification_id, siape) VALUES (?, ?)");
    db.serialize(() => {
      db.run("BEGIN");
      ids.forEach(id => stmt.run(id, siape));
      db.run("COMMIT", (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      });
    });
  });

  return router;
};
