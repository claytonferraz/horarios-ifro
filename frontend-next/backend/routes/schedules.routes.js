const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { verifyToken } = require('../middlewares/auth.middleware');

module.exports = function(io) {
  const router = express.Router();

  const scheduleMemCache = new Map();
  const SCHEDULE_CACHE_TTL_MS = 5000; // 5 segundos de cache

  router.get('/', (req, res) => {
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
                         suapH = parseInt(f.hours) || 0; 
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
      isPermuted: z.boolean().optional(),
      originalSubject: z.string().optional().nullable(),
      isDisponibilizada: z.boolean().optional(),
      classType: z.string().optional().nullable(),
      isExtra: z.boolean().optional().nullable()
    }))
  });

  router.post('/bulk-course', verifyToken, (req, res) => {
    try {
      const now = new Date().toISOString();
      const { courseIds, courseId, type, weekId, academicYear, schedules } = bulkScheduleSchema.parse(req.body);
      const coursesToClear = (courseIds && courseIds.length > 0) ? courseIds : (courseId ? [courseId] : []);
      if (coursesToClear.length === 0) return res.status(400).json({ error: "Nenhum curso especificado para gravação." });

      const placeholders = coursesToClear.map(() => '?').join(',');
      const cond = coursesToClear.length > 0 ? `courseId NOT IN (${placeholders})` : `1=1`;

      db.all(`SELECT * FROM schedules WHERE (${cond} OR courseId IS NULL) AND type = ?`, [...coursesToClear, type], (err, existingRows) => {
        if (err) return res.status(500).json({ error: err.message });

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
              
              const oR = (oldRows || []).find(old => old.classId === slot.classId && String(old.dayOfWeek) === String(slot.dayOfWeek) && String(old.slotId) === String(slot.slotId));
              let oldRecordsObj = {};
              if (oR && oR.records) {
                 try {
                     const parsed = JSON.parse(oR.records);
                     oldRecordsObj = Array.isArray(parsed) ? (parsed[0] || {}) : parsed;
                 } catch(e){}
              }

              let recordsJSON = null;
              if (type !== 'padrao' && type !== 'oficial' && (slot.isSubstituted || slot.isPermuted || slot.isDisponibilizada || slot.classType || slot.isExtra || Object.keys(oldRecordsObj).length > 0)) {
                 recordsJSON = JSON.stringify({
                    ...oldRecordsObj,
                    isSubstituted: slot.isSubstituted !== undefined ? slot.isSubstituted : (oldRecordsObj.isSubstituted || false),
                    isPermuted: slot.isPermuted !== undefined ? slot.isPermuted : (oldRecordsObj.isPermuted || false),
                    originalSubject: slot.originalSubject !== undefined ? slot.originalSubject : (oldRecordsObj.originalSubject || null),
                    isDisponibilizada: slot.isDisponibilizada !== undefined ? slot.isDisponibilizada : (oldRecordsObj.isDisponibilizada || false),
                    classType: slot.classType !== undefined ? slot.classType : (oldRecordsObj.classType || null),
                    isExtra: slot.isExtra !== undefined ? slot.isExtra : (oldRecordsObj.isExtra || false)
                 });
              }
              stmt.run([id, targetCourse, academicYear || null, slot.classId, slot.dayOfWeek, slot.slotId, slot.teacherId, slot.disciplineId || null, slot.room || null, type, weekId || null, now, recordsJSON]);
            }
            stmt.finalize();

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

  router.post('/single', verifyToken, (req, res) => {
    try {
      const now = new Date().toISOString();
      const { type, weekId, academicYear, schedules } = req.body;
      
      const classNamesToLookup = Array.from(new Set(schedules.map(s => s.classId || '')));
      
      // Busca todas as classes possíveis no Payload (na prática virá o mesmo className pra todos)
      db.all("SELECT payload FROM curriculum_data WHERE dataType = 'class'", [], (err, rows) => {
         const classMapping = {};
         if (!err && rows) {
             rows.forEach(r => {
                 try {
                    const obj = JSON.parse(r.payload);
                    if (obj.name) classMapping[obj.name] = { mx: obj.matrixId, id: obj.id, ay: obj.academicYear };
                 } catch(e){}
             });
         }

         db.serialize(() => {
           db.run("BEGIN TRANSACTION");
           const stmt = db.prepare("INSERT OR REPLACE INTO schedules (id, courseId, academic_year, classId, dayOfWeek, slotId, teacherId, disciplineId, room, type, week_id, updatedAt, records) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
           
           for (const slot of schedules) {
             const id = slot.id || `s_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
             
             let recordsJSON = null;
             if (slot.classType || slot.isSubstituted || slot.isDisponibilizada) {
                recordsJSON = JSON.stringify({
                   classType: slot.classType || null,
                   isSubstituted: slot.isSubstituted || false,
                   originalSubject: slot.originalSubject || null,
                   isDisponibilizada: slot.isDisponibilizada || false
                });
             }
             
             let realCourse = slot.courseId;
             let realClass = slot.classId;
             let realYr = academicYear || null;

             if (classMapping[slot.classId]) {
                 realCourse = classMapping[slot.classId].mx || slot.courseId;
                 realClass = classMapping[slot.classId].id || slot.classId;
                 realYr = classMapping[slot.classId].ay || academicYear || null;
             }

             stmt.run([id, realCourse, realYr, realClass, slot.dayOfWeek, slot.slotId, slot.teacherId, slot.disciplineId || null, slot.room || null, type, weekId || null, now, recordsJSON]);
           }
           stmt.finalize();

           db.run("COMMIT", (errCommit) => {
             if (errCommit) return res.status(500).json({ error: errCommit.message });
             io.emit('schedule_updated');
             res.json({ success: true, message: 'Lançamentos individuais gravados com sucesso!' });
           });
         }); // serialize
      }); // all
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  });

  router.delete('/bulk-course', verifyToken, (req, res) => {
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

  const schedulePayloadSchema = z.object({
    id: z.string().min(1, "ID é obrigatório"),
    week: z.string().min(1, "Semana é obrigatória"),
    type: z.enum(['oficial', 'previa', 'padrao', 'atual']),
    fileName: z.string().optional(),
    records: z.string().min(2, "Records deve ser uma string JSON válida")
  });

  router.post('/', verifyToken, (req, res) => {
    try {
      const validatedData = schedulePayloadSchema.parse(req.body);
      const { id, week, type, fileName, records: recordsStr } = validatedData;
      
      let parsedRecords;
      try { parsedRecords = JSON.parse(recordsStr); } catch (e) { throw new Error("JSON Records inválido."); }
      
      const valid = Array.isArray(parsedRecords) ? parsedRecords : [];
      const teacherMap = new Map();
      const classMap = new Map();

      for (const r of valid) {
        const skipNames = ['A Definir', 'Todos'];
        const isSet = (val) => val && !skipNames.includes(val);

        if (isSet(r.day) && isSet(r.time)) {
          const slotKey = `${r.day}_${r.time}`;
          if (isSet(r.teacher)) {
            const key = `${r.teacher}_${slotKey}`;
            // Permitindo override no front-end em vez de bloquear na API
            teacherMap.set(key, r.id);
          }
          if (isSet(r.className)) {
            const key = `${r.className}_${slotKey}`;
            // Permitir permissividade para resolver conflitos de laboratórios
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
          involvedTeachers.add('ALL_PROF');
          involvedTeachers.add('ALL_STUDENT');
        } else {
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
            
            involvedTeachers.forEach(t => {
              const targetWeekDesc = req.body.weekLabel || `da Semana ${week}`;
              let title = type === 'previa' ? "Nova Prévia Publicada" : "Horário Alterado";
              let msg = type === 'previa' ? `A prévia das aulas ${targetWeekDesc} já está publicada.` : `Sua aula nas datas ${targetWeekDesc} sofreu uma alteração de professor/sala.`;
              db.run("INSERT INTO notifications (target, type, title, message, createdAt) VALUES (?, ?, ?, ?, ?)", [t, type, title, msg, now]);
            });

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
        const errList = e.errors || e.issues || [];
        return res.status(400).json({ error: "Dados inválidos: " + errList.map(err => err.message).join(', ') });
      }
      return res.status(400).json({ error: e.message });
    }
  });

  router.delete('/:id', verifyToken, (req, res) => {
    const id = req.params.id; 
    db.run("DELETE FROM schedules WHERE id = ?", [id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      io.emit('schedule_updated');
      res.json({ success: true });
    });
  });

  return router;
};
