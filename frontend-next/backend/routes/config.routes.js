const express = require('express');
const db = require('../db');
const { verifyToken, requireManager } = require('../middlewares/auth.middleware');

module.exports = function(io) {
  const router = express.Router();
// ==========================================
// ROTAS DE SEMANAS ACADÊMICAS
// ==========================================
router.get('/', (req, res) => {
  db.all("SELECT * FROM academic_weeks ORDER BY start_date ASC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

router.post('/', verifyToken, requireManager, (req, res) => {
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

router.put('/:id', verifyToken, requireManager, (req, res) => {
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

router.delete('/:id', verifyToken, requireManager, (req, res) => {
  db.run("DELETE FROM academic_weeks WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    io.emit('schedule_updated');
    res.json({ success: true });
  });
});


  return router;
};
