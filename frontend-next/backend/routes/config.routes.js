const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { verifyToken, requireManager, attachUserIfPresent, requirePublicScheduleAccess } = require('../middlewares/auth.middleware');

function isPublicSchedulesEnabled(rawValue) {
  if (rawValue === undefined || rawValue === null) return true;
  return Number(rawValue) !== 0;
}

module.exports = function(io) {
  const router = express.Router();

  // ==========================================
  // SEMANAS ACADÊMICAS (/api/academic-weeks)
  // ==========================================
  router.get('/academic-weeks', attachUserIfPresent, requirePublicScheduleAccess, (req, res) => {
    db.all("SELECT * FROM academic_weeks ORDER BY start_date ASC", (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    });
  });

  router.post('/academic-weeks', verifyToken, requireManager, (req, res) => {
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

  router.put('/academic-weeks/:id', verifyToken, requireManager, (req, res) => {
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

  router.delete('/academic-weeks/:id', verifyToken, requireManager, (req, res) => {
    db.run("DELETE FROM academic_weeks WHERE id = ?", [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      io.emit('schedule_updated');
      res.json({ success: true });
    });
  });

  // ==========================================
  // CONFIGURAÇÃO GLOBAL (/api/config)
  // ==========================================
  router.get('/config', attachUserIfPresent, requirePublicScheduleAccess, (req, res) => {
    const year = req.query.year || new Date().getFullYear().toString();
    const configId = `config_${year}`;

    db.get("SELECT disabledWeeks, activeDays, classTimes, bimesters, intervals, activeDefaultScheduleId, publicSchedulesEnabled FROM config WHERE id = ?", [configId], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (row) {
        let dWeeks = [], aDays = null, cTimes = null, bimesters = null, intervals = [];
        try { dWeeks = row.disabledWeeks ? JSON.parse(row.disabledWeeks) : []; } catch(e) {}
        try { aDays = row.activeDays ? JSON.parse(row.activeDays) : null; } catch(e) {}
        try { cTimes = row.classTimes ? JSON.parse(row.classTimes) : null; } catch(e) {}
        try { bimesters = row.bimesters ? JSON.parse(row.bimesters) : null; } catch(e) {}
        try { intervals = row.intervals ? JSON.parse(row.intervals) : []; } catch(e) {}
        res.json({
          disabledWeeks: dWeeks,
          activeDays: aDays,
          classTimes: cTimes,
          bimesters: bimesters,
          intervals,
          activeDefaultScheduleId: row.activeDefaultScheduleId || null,
          publicSchedulesEnabled: isPublicSchedulesEnabled(row.publicSchedulesEnabled)
        });
      } else {
        res.json({ disabledWeeks: [], activeDays: null, classTimes: null, bimesters: null, intervals: [], activeDefaultScheduleId: null, publicSchedulesEnabled: true });
      }
    });
  });

  router.put('/config', verifyToken, requireManager, (req, res) => {
    const { disabledWeeks, activeDays, classTimes, bimesters, activeDefaultScheduleId, intervals, year, publicSchedulesEnabled } = req.body;
    const targetYear = year || new Date().getFullYear().toString();
    const configId = `config_${targetYear}`;

    db.get("SELECT publicSchedulesEnabled FROM config WHERE id = ?", [configId], (readErr, existing) => {
      if (readErr) return res.status(500).json({ error: readErr.message });

      const resolvedPublicFlag = typeof publicSchedulesEnabled === 'boolean'
        ? (publicSchedulesEnabled ? 1 : 0)
        : (existing?.publicSchedulesEnabled ?? 1);

      db.run(
        `INSERT OR REPLACE INTO config (id, disabledWeeks, activeDays, classTimes, bimesters, activeDefaultScheduleId, intervals, publicSchedulesEnabled) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
        [
          configId,
          disabledWeeks ? JSON.stringify(disabledWeeks) : '[]',
          activeDays ? JSON.stringify(activeDays) : null,
          classTimes ? JSON.stringify(classTimes) : null,
          bimesters ? JSON.stringify(bimesters) : null,
          activeDefaultScheduleId || null,
          intervals ? JSON.stringify(intervals) : '[]',
          resolvedPublicFlag
        ], 
        (err) => {
          if (err) return res.status(500).json({ error: err.message });
          io.emit('schedule_updated');
          res.json({ success: true });
        }
      );
    });
  });

  router.post('/config/import', verifyToken, requireManager, (req, res) => {
    const { fromYear, toYear, options } = req.body;
    if (!fromYear || !toYear) return res.status(400).json({ error: "Anos de origem e destino são obrigatórios." });

    const ops = options || { days: true, times: true, bimesters: true, default: true };
    const fromId = `config_${fromYear}`;
    const toId = `config_${toYear}`;

    db.get("SELECT * FROM config WHERE id = ?", [toId], (err, targetRow) => {
      if (err) return res.status(500).json({ error: err.message });
      const existing = targetRow || {};
      
      db.get("SELECT * FROM config WHERE id = ?", [fromId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Nenhuma configuração encontrada no ano de origem." });

        const finalDays     = ops.days      !== false ? row.activeDays : existing.activeDays;
        const finalTimes    = ops.times     !== false ? row.classTimes : existing.classTimes;
        const finalBimester = ops.bimesters !== false ? row.bimesters  : existing.bimesters;
        const finalDefault  = ops.default   !== false ? row.activeDefaultScheduleId : existing.activeDefaultScheduleId;
        const finalIntervals = ops.times !== false ? row.intervals : existing.intervals;
        const finalPublicFlag = existing.publicSchedulesEnabled ?? row.publicSchedulesEnabled ?? 1;

        db.run(
          `INSERT OR REPLACE INTO config (id, disabledWeeks, activeDays, classTimes, bimesters, activeDefaultScheduleId, intervals, publicSchedulesEnabled) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
          [toId, '[]', finalDays, finalTimes, finalBimester, finalDefault, finalIntervals || '[]', finalPublicFlag], 
          (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            io.emit('schedule_updated');
            res.json({ success: true, message: 'Configuração importada com sucesso!' });
          }
        );
      });
    });
  });

  return router;
};
