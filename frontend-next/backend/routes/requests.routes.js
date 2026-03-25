const express = require('express');
const db = require('../db');
const { verifyToken } = require('../middlewares/auth.middleware');
const { z } = require('zod');

const requestStatusSchema = z.object({
  status: z.string().trim().min(1),
  admin_feedback: z.string().optional().nullable(),
  system_message: z.string().optional().nullable(),
});

module.exports = function(io) {
  const router = express.Router();
// ==========================================
// ROTAS DE SOLICITAÇÕES DE TROCA E VAGA
// ==========================================
router.get('/', verifyToken, (req, res) => {
  try {
    let query = 'SELECT * FROM exchange_requests ORDER BY created_at DESC';
    let params = [];
    const requestedSiape = String(req.query.siape || '').trim();

    if (!req.user.isAdmin && !req.user.isManager) {
        query = 'SELECT * FROM exchange_requests WHERE requester_id = ? OR substitute_id = ? ORDER BY id DESC';
        params = [req.user.siape, req.user.siape];
    } else if (requestedSiape) {
        query = 'SELECT * FROM exchange_requests WHERE requester_id LIKE ? OR substitute_id LIKE ? ORDER BY id DESC';
        const likeSiape = `%${requestedSiape}%`;
        params = [likeSiape, likeSiape];
    }
    db.all(query, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    });
  } catch(e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.issues[0]?.message || 'Dados inválidos.' });
    }
    res.status(500).json({error: e.message});
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const data = req.body;
    let action = data.action || 'vaga';

    // O fallback de ação protege o endpoint
    if (!['vaga', 'troca', 'oferta_vaga', 'lancamento_extra'].includes(action)) {
        return res.status(400).json({ error: "Ação não especificada ou inválida." });
    }

    const requester = req.user.siape;
    let targetClass = data.targetClass || data.original_slot?.className || '';
    let returnWeekId = data.returnWeekId || data.week_id;
    let reason = data.reason || data.description;
    let substituteId = data.substitute_id || '';

    // Extração robusta de Dia/Hora
    const dayMap = { 'Domingo': '0', 'Segunda-feira': '1', 'Terça-feira': '2', 'Quarta-feira': '3', 'Quinta-feira': '4', 'Sexta-feira': '5', 'Sábado': '6' };
    
    // BLINDAGEM DE SEGURANÇA: Verificar se o professor realmente leciona na turma
    const authCheckQ = `SELECT COUNT(*) as count FROM schedules WHERE (classId = ? OR classId = (SELECT id FROM curriculum_data WHERE dataType='class' AND (id=? OR payload LIKE '%"name":"' || ? || '"%'))) AND teacherId LIKE ?`;
    const checkRes = await new Promise(r => db.get(authCheckQ, [targetClass, targetClass, targetClass, `%${requester}%`], (e, row) => r(row?.count || 0)));
    
    if (checkRes === 0 && action !== 'lancamento_extra' && !req.user.isAdmin && !req.user.isManager) {
         // Se for Admin/Gestao, permitimos (ou se for lancamento extra em nova turma)
         // Mas para permutas regulares do professor, bloqueamos.
         return res.status(403).json({ error: "Permissão Negada: Você só pode solicitar permutas em turmas onde você já leciona." });
    }

    const pS = data.proposed_slot || data.proposedSlot || {};
    const oS = data.original_slot || data.originalSlot || {};
    let originalDay = oS.day || pS.day || data.proposed_day || '';
    let originalTime = oS.time || pS.time || data.proposed_time || '';
    let subject = oS.subject || pS.subject || '';

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

        const dayOfWeekToUpdate = proposedDay;

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
        const slotsObj = pS; // Usar a extração robusta definida acima
        const targets = slotsObj.slots || (slotsObj.day ? [slotsObj] : []);
        const dayNum = dayMap[slotsObj.day] || slotsObj.day;

    db.all("SELECT payload FROM curriculum_data WHERE dataType = 'class'", [], (err, rows) => {
        const classMapping = {};
        if (!err && rows) {
            rows.forEach(r => {
                try {
                    const obj = JSON.parse(r.payload);
                    if (obj.name) classMapping[obj.name] = obj.id;
                } catch(e){}
            });
        }

        const cid = classMapping[slotsObj.classId || targetClass] || slotsObj.classId || targetClass;
        const targetLabel = slotsObj.subject || 'Livre';

        const promises = targets.map((s) => {
           return new Promise((resolve) => {
               const uQ = `UPDATE schedules SET teacherId = 'A Definir', records = json_patch(COALESCE(records, '{}'), ?) WHERE (classId = ? OR classId = (SELECT id FROM curriculum_data WHERE dataType='class' AND (id=? OR payload LIKE '%"name":"' || ? || '"%'))) AND (dayOfWeek = ? OR dayOfWeek = ?) AND slotId = ? AND ( (week_id = ? AND type IN ('previa', 'atual', 'oficial')) OR (? IS NULL AND type = 'padrao' AND (week_id IS NULL OR week_id = '')) )`;
               const meta = JSON.stringify({ isSubstituted: true, isPending: true, originalSubject: (s.subject || subject), isDisponibilizada: true, offeredTo: targetLabel });
               db.run(uQ, [meta, cid, cid, cid, slotsObj.day, dayNum, s.time, returnWeekId || null, returnWeekId || null], () => resolve());
           });
        });

        Promise.all(promises).then(() => {
            db.run('INSERT INTO exchange_requests (action_type, requester_id, substitute_id, target_class, original_day, original_time, subject, return_week, reason, obs, status, original_slot, proposed_slot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [action, requester, (targetLabel === 'Livre' ? '' : targetLabel), targetClass, originalDay, originalTime, 'Aulas Agrupadas', returnWeekId || '', reason || '', obs || '', 'pendente', JSON.stringify(oS), JSON.stringify(pS)],
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    const insertedId = this.lastID;
                    const now = new Date().toISOString();
                    const nMsg = `Professor(a) SIApE: ${requester} disponibilizou aula(s) vaga(s) na turma ${targetClass} em ${originalDay} (${originalTime}). Alvo: ${targetLabel}`;
                    db.run("INSERT INTO notifications (type, target, title, message, createdAt) VALUES ('SYSTEM', 'ALL_ADMIN', 'Aula(s) Disponibilizada(s)', ?, ?)", [nMsg, now], function(){});
                    io.emit('schedule_updated');
                    res.json({ success: true, id: insertedId, automatic: true });
                }
            );
        });
    });

    } else if (action === 'lancamento_extra') {
        const propClassType = data.proposed_slot?.classType || '';
        const isAtendimento = propClassType.toLowerCase().includes('atendimento');
        
        const initialStatus = isAtendimento ? 'aprovada' : 'pronto_para_homologacao';
        const finalFeedback = isAtendimento ? 'Auto-homologado pelo sistema (Atendimento ao Aluno)' : null;

                 // Verifica redundância
                 db.get("SELECT id FROM exchange_requests WHERE action_type = 'lancamento_extra' AND target_class = ? AND original_day = ? AND original_time = ? AND status IN ('pendente', 'pronto_para_homologacao', 'approved', 'aprovada', 'aguardando_colega')", 
                    [targetClass, originalDay, originalTime], (checkErr, checkRow) => {
                     
                     if (!checkErr && checkRow) {
                         // Já há uma solicitação desse tipo na mesma banda horária, evitar clone
                         return res.status(400).json({ error: "Já existe uma solicitação de Lançamento Extra ou Permuta em andamento ou aprovada para este horário." });
                     }

                     db.run(
                         'INSERT INTO exchange_requests (action_type, requester_id, substitute_id, target_class, original_day, original_time, subject, return_week, reason, obs, status, admin_feedback, original_slot, proposed_slot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                         [action, requester, '', targetClass, originalDay, originalTime, subject, returnWeekId || '', reason || '', obs || '', initialStatus, finalFeedback, JSON.stringify(data.original_slot || {}), JSON.stringify(data.proposed_slot || {})],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                const insertedId = this.lastID;
                
                // === BLOQUEIO IMEDIATO NA GRADE ===
                if (!isAtendimento) {
                    const propData = data.proposed_slot || {};
                    let timesToProcess = [];
                    if (propData.slots && Array.isArray(propData.slots)) timesToProcess = propData.slots.map(s => s.time || s.slotId);
                    else if (propData.time) timesToProcess = [propData.time];

                    const weekIdFilter = returnWeekId || null;
                    const dayStr = propData.day || originalDay;
                    const targetClassStr = propData.classId || propData.className || targetClass;

                    db.all("SELECT payload FROM curriculum_data WHERE dataType = 'class'", [], (cErr, cRows) => {
                         let realClassId = targetClassStr;
                         let realCourseId = 'DESCONHECIDO';
                         let realYear = new Date().getFullYear().toString();

                         if (!cErr && cRows) {
                             const cleanTarget = targetClassStr.toLowerCase().replace(/[^a-z0-9]/g, '');
                             cRows.forEach(r => {
                                 try {
                                     const obj = JSON.parse(r.payload);
                                     const cleanName = (obj.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                                     if (cleanName === cleanTarget || obj.id === targetClassStr) {
                                         realClassId = obj.id;
                                         realCourseId = obj.matrixId || obj.courseId || realCourseId;
                                         realYear = obj.academicYear || realYear;
                                     }
                                 } catch(e){}
                             });
                         }

                         if (realCourseId !== 'DESCONHECIDO') {
                             timesToProcess.forEach(timeStr => {
                                 const cleanSubject = subject.replace(/\[Aguardando\]\s*/g, '').trim();
                                 const patchData = JSON.stringify({ classType: propClassType, isExtra: true, isPending: true, requestId: insertedId, subject: cleanSubject });
                                 const pendingDiscipline = `[Aguardando] ${cleanSubject}`;

                                 const updateQ = `UPDATE schedules SET teacherId = ?, disciplineId = ?, records = json_patch(COALESCE(records, '{}'), ?) WHERE classId = ? AND dayOfWeek = ? AND slotId = ? AND ( (week_id = ? AND type IN ('previa', 'atual', 'oficial')) OR (? IS NULL AND type = 'padrao' AND (week_id IS NULL OR week_id = '')) )`;

                                 db.run(updateQ, [requester, pendingDiscipline, patchData, realClassId, dayStr, timeStr, weekIdFilter, weekIdFilter], function(upErr) {
                                     if (upErr) console.error("Update Block Error: ", upErr);
                                     if (this.changes === 0 && !upErr) {
                                         const sid = 's_ext_pend_' + Date.now() + Math.random().toString(36).substring(2,6);
                                         db.run(`INSERT INTO schedules (id, courseId, academic_year, classId, dayOfWeek, slotId, teacherId, disciplineId, type, week_id, records) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                                         [sid, realCourseId, realYear, realClassId, dayStr, timeStr, requester, pendingDiscipline, propData.type || 'previa', weekIdFilter, patchData], function(insErr) {
                                            if (insErr) console.error("Insert Block Error: ", insErr);
                                         });
                                     }
                                 });
                             });
                             io.emit('schedule_updated');
                         }
                    });
                }
                res.json({ success: true, id: insertedId, autoApproved: isAtendimento });
            }
        );
        }); // Fim do check callback
    } else if (action === 'troca' || !action) {
        // Se action_type estiver estritamente vazio (modal antigo/incompleto), forçamos 'troca_aberta' ou assumimos o fluxo base para evitar nulls
        const finalAction = action || 'vaga';
        const status = finalAction === 'troca' ? 'aguardando_colega' : 'pendente'; 

        db.get("SELECT id FROM exchange_requests WHERE target_class = ? AND original_day = ? AND original_time = ? AND status IN ('pendente', 'pronto_para_homologacao', 'approved', 'aprovada', 'aguardando_colega')", 
           [targetClass, originalDay, originalTime], (checkErrTroca, checkRowTroca) => {
            
            if (!checkErrTroca && checkRowTroca) {
                return res.status(400).json({ error: "Já existe uma solicitação em andamento ou aprovada para este horário." });
            }

            db.run(
              // Na tabela, usaremos a query com "obs" espelhando o formato stricto.
              'INSERT INTO exchange_requests (action_type, requester_id, substitute_id, target_class, original_day, original_time, subject, return_week, reason, obs, status, original_slot, proposed_slot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [finalAction, requester, substituteId || '', targetClass, originalDay, originalTime, subject, returnWeekId || '', reason || '', obs, status, JSON.stringify(data.original_slot || {}), JSON.stringify(data.proposed_slot || {})],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
          }
        );
        }); // Fim check clone
    }
  } catch(e) { res.status(500).json({error: e.message}); }
});

router.put('/:id/status', verifyToken, (req, res) => {
  try {
    const { status, admin_feedback, system_message } = requestStatusSchema.parse(req.body);

    db.get("SELECT * FROM exchange_requests WHERE id = ?", [req.params.id], (loadErr, targetRequest) => {
      if (loadErr) return res.status(500).json({ error: loadErr.message });
      if (!targetRequest) return res.status(404).json({ error: 'Solicitação não encontrada.' });

      const normalizedStatus = String(status).toLowerCase();
      const isSubstituteApproval = normalizedStatus === 'pronto_para_homologacao';
      const isManagementDecision = ['aprovada', 'aprovado', 'rejeitado', 'homologado'].includes(normalizedStatus);

      if (isSubstituteApproval) {
        const canAcceptAsColleague = String(targetRequest.substitute_id || '') === String(req.user.siape);
        if (!canAcceptAsColleague && !req.user.isAdmin && !req.user.isManager) {
          return res.status(403).json({ error: 'Sem permissão para aceitar esta solicitação.' });
        }
      } else if (isManagementDecision) {
        if (!req.user.isAdmin && !req.user.isManager) {
          return res.status(403).json({ error: 'Sem permissão para homologar esta solicitação.' });
        }
      } else if (!req.user.isAdmin && !req.user.isManager) {
        return res.status(403).json({ error: 'Sem permissão para alterar o status desta solicitação.' });
      }

      let approved_by = null;
      if (isManagementDecision) {
          approved_by = req.userId;
      }
      
      db.run('UPDATE exchange_requests SET status = ?, admin_feedback = COALESCE(?, admin_feedback), system_message = COALESCE(?, system_message), approved_by = COALESCE(?, approved_by) WHERE id = ?', 
      [status, admin_feedback || null, system_message || null, approved_by, req.params.id], function(err) {
      if (err) {
         console.error("ERRO_PUT_STATUS_DB_RUN:", err);
         return res.status(500).json({ error: err.message });
      }
      
      const now = new Date().toISOString();

      if (status === 'pronto_para_homologacao') {
        db.run("INSERT INTO notifications (type, target, title, message, createdAt) VALUES ('SYSTEM', 'ALL_ADMIN', 'Permuta Aceita pelo Colega', 'Um pedido de mudança acaba de receber o aceite do professor substituto. Aguardando sua homologação.', ?)", [now], function(){});
        io.emit('schedule_updated');
        res.json({ success: true });

      } else if (status === 'rejeitado') {
         return db.get("SELECT requester_id, action_type FROM exchange_requests WHERE id = ?", [req.params.id], (err2, row) => {
            if (!err2 && row && row.requester_id) {
               const notifyRejection = () => {
                   const now = new Date().toISOString();
                   db.run("INSERT INTO notifications (type, target, title, message, createdAt) VALUES ('SYSTEM', ?, 'Solicitação Recusada', 'A sua solicitação foi recusada pela gestão. O horário foi libertado.', ?)", [row.requester_id, now], function(){
                       io.emit('schedule_updated');
                       return res.json({ success: true });
                   });
               };

               if (row.action_type === 'lancamento_extra') {
                   // Rollback Blindado 1: Apaga APENAS as linhas que o sistema inseriu temporariamente (identificadas pelo ID s_ext_pend_)
                   const deleteQ = `DELETE FROM schedules WHERE id LIKE 's_ext_pend_%' AND records LIKE '%"requestId":${req.params.id}%'`;
                   db.run(deleteQ, [], () => {
                       
                       // Rollback Blindado 2: Para linhas da matriz que apenas sofreram UPDATE, limpamos os campos e mantemos a estrutura intacta
                       const clearPatch = JSON.stringify({ isPending: false, requestId: null, isExtra: false });
                       const updateQ = `UPDATE schedules SET teacherId = 'A Definir', disciplineId = '', records = json_patch(records, ?) WHERE records LIKE '%"requestId":${req.params.id}%'`;
                       
                       db.run(updateQ, [clearPatch], () => notifyRejection());
                   });
               } else {
                   notifyRejection();
               }
            } else {
              return res.json({ success: true });
            }
         });

      } else if (/aprovad[oa]|homologado/i.test(status)) {
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
                     
                     const origDay = orig.day;
                     const propDay = prop.day;
                     
                     const weekIdFilter = row.return_week || null;

                     const origClassStr = orig.classId || orig.className || row.target_class;
                     const propClassStr = prop.classId || prop.className || row.target_class;

                     db.all("SELECT payload FROM curriculum_data WHERE dataType = 'class'", [], (cErr, rows) => {
                         const classMapping = {};
                         if (!cErr && rows) {
                             rows.forEach(r => {
                                 try {
                                     const obj = JSON.parse(r.payload);
                                     if (obj.name) classMapping[obj.name] = obj.id;
                                 } catch(e){}
                             });
                         }

                         const origTargetClass = classMapping[origClassStr] || origClassStr;
                         const propTargetClass = classMapping[propClassStr] || propClassStr;

                         db.serialize(() => {
                             db.run("BEGIN TRANSACTION;");

                             // AULA 1 (A passa para B) -> Update Original Node
                             const updateOrig = `UPDATE schedules SET teacherId = ?, disciplineId = ?, records = json_patch(COALESCE(records, '{}'), ?) WHERE classId = ? AND dayOfWeek = ? AND slotId = ? AND ( (week_id = ? AND type IN ('previa', 'atual', 'oficial')) OR (? IS NULL AND type = 'padrao' AND (week_id IS NULL OR week_id = '')) )`;
                             const patchOrig = JSON.stringify({ isSubstituted: true, isPermuted: true, originalSubject: (orig.originalSubject || orig.subject) });
                             
                             db.run(updateOrig, [row.substitute_id, prop.subject, patchOrig, origTargetClass, origDay, orig.time, weekIdFilter, weekIdFilter]);

                             // AULA 2 (B passa para A) -> Update Proposed Node
                             const updateProp = `UPDATE schedules SET teacherId = ?, disciplineId = ?, records = json_patch(COALESCE(records, '{}'), ?) WHERE classId = ? AND dayOfWeek = ? AND slotId = ? AND ( (week_id = ? AND type IN ('previa', 'atual', 'oficial')) OR (? IS NULL AND type = 'padrao' AND (week_id IS NULL OR week_id = '')) )`;
                             const patchProp = JSON.stringify({ isSubstituted: true, isPermuted: true, originalSubject: (prop.originalSubject || prop.subject) });
                             
                             db.run(updateProp, [row.requester_id, orig.subject, patchProp, propTargetClass, propDay, prop.time, weekIdFilter, weekIdFilter]);

                             db.run("COMMIT;", (commitErr) => {
                                 if (commitErr) {
                                     console.error("[SWAP_ENGINE] [ERRO CRÍTICO] Falha no COMMIT:", commitErr);
                                     db.run("ROLLBACK;");
                                     res.status(500).json({ error: "Erro na integridade da Transação" });
                                 } else {
                                     const notifyTitle = 'Sua Permuta de Aulas foi Efetivada na Grade';
                                     const notifyMsg = `A troca envolvendo suas aulas de ${orig.subject} (${orig.day}) e ${prop.subject} (${prop.day}) acaba de ser homologada oficialmente.`;
                                     db.run("INSERT INTO notifications (type, target, title, message, createdAt) VALUES ('SYSTEM', ?, ?, ?, ?)", [row.requester_id, notifyTitle, notifyMsg, now], function(){});
                                     db.run("INSERT INTO notifications (type, target, title, message, createdAt) VALUES ('SYSTEM', ?, ?, ?, ?)", [row.substitute_id, notifyTitle, notifyMsg, now], function(){});

                                     io.emit('schedule_updated'); 
                                     res.json({ success: true, homologacaoStatus: 'EXECUTADA' });
                                 }
                             });
                         });
                     }); // End db.all

                 } catch(jsonErr) {
                     console.warn("[SWAP_ENGINE] Falha ao parsear JSON payload. Requisição Legada. Pulando motor.", jsonErr);
                     io.emit('schedule_updated');
                     res.json({ success: true, homologacaoStatus: 'MANUAL_LEGADO' });
                  }
              } else if (!err3 && row && (row.action_type === 'vaga' || row.action_type === 'oferta_vaga')) {
                  const dayMap = { 'Domingo': '0', 'Segunda-feira': '1', 'Terça-feira': '2', 'Quarta-feira': '3', 'Quinta-feira': '4', 'Sexta-feira': '5', 'Sábado': '6' };
                  try {
                      const propData = JSON.parse(row.proposed_slot || '{}');
                      const weekId = row.return_week || null;
                      const now = new Date().toISOString();
                      let slotsToProcess = [];
                      if (propData.slots && Array.isArray(propData.slots)) { slotsToProcess = propData.slots; } else { slotsToProcess = [propData]; }
                      db.serialize(() => {
                          db.run('BEGIN TRANSACTION;');
                          let hasError = false;
                          slotsToProcess.forEach(slot => {
                              const day = slot.day || propData.day || row.original_day;
                              const time = slot.time || propData.time || row.original_time;
                              const classId = slot.classId || propData.className || row.target_class;
                              const dNum = dayMap[day] || day;
                              let newTeacher = null;
                              let newDiscipline = null;
                              let patchData = {};
                              if (row.action_type === 'vaga') {
                                  newTeacher = row.requester_id;
                                  newDiscipline = slot.subject || propData.subject;
                                  patchData = { isExtra: true, isPending: false, isVacant: false, subject: newDiscipline };
                              } else {
                                  newTeacher = '0000001';
                                  newDiscipline = slot.subject || propData.subject || row.subject;
                                  patchData = { isVacant: true, isPending: false, originalTeacher: row.requester_id, subject: newDiscipline };
                              }
                              const patchStr = JSON.stringify(patchData);
                              const updateQ = "UPDATE schedules SET teacherId = ?, disciplineId = ?, records = json_patch(COALESCE(records, '{} '), ?) WHERE (classId = ? OR classId = (SELECT id FROM curriculum_data WHERE dataType='class' AND (id=? OR payload LIKE '%\"name\":\"' || ? || '\"%'))) AND (dayOfWeek = ? OR dayOfWeek = ?) AND slotId = ? AND ( (week_id = ? AND type IN ('previa', 'atual', 'oficial')) OR (? IS NULL AND type = 'padrao' AND (week_id IS NULL OR week_id = '')) )";
                              db.run(updateQ, [newTeacher, newDiscipline, patchStr, classId, classId, classId, day, dNum, time, weekId, weekId], function(upErr) {
                                  if (upErr || this.changes === 0) { console.error('[OFFER_ENGINE] Falha no slot', day, time); if (upErr) hasError = true; }
                              });
                          });
                          db.run('COMMIT;', (commitErr) => {
                              if (commitErr || hasError) { db.run('ROLLBACK;'); res.status(500).json({ error: 'Erro Transacional' }); }
                              else { io.emit('schedule_updated'); res.json({ success: true, homologacaoStatus: 'EXECUTADA_VAGA_OFERTA' }); }
                          });
                      });
                  } catch(errExtract) { console.error('[VAGA_ENGINE] Erro:', errExtract); res.json({ success: true, homologacaoStatus: 'FALHA_PARSE' }); }

             } else if (!err3 && row && row.action_type === 'lancamento_extra') {
                 // HOMOLOGAÇÃO DE LANÇAMENTO DE AULA EXTRA
                 try {
                     const propData = JSON.parse(row.proposed_slot || '{}');
                     
                     // Suporta o formato de array (times) ou string única (time/original_time)
                     let timesToProcess = [];
                     if (propData.slots && Array.isArray(propData.slots)) {
                         timesToProcess = propData.slots.map(s => s.time || s.slotId);
                     } else if (propData.times && Array.isArray(propData.times)) {
                         timesToProcess = propData.times;
                     } else if (propData.time) {
                         timesToProcess = [propData.time];
                     } else if (row.original_time) {
                         timesToProcess = [row.original_time];
                     }

                     const weekId = row.return_week || null;
                     const targetType = propData.type || 'previa';
                     const classType = propData.classType || 'Regular';
                     const targetSubject = (propData.subject || row.subject || '').replace(/\[Aguardando\]\s*/g, '').trim();

                     const dayStr = propData.day || row.original_day; // Usando a string literal
                     const targetClassStr = propData.classId || propData.className || row.target_class;

                     db.all("SELECT payload FROM curriculum_data WHERE dataType = 'class'", [], (cErr, cRows) => {
                         let realClassId = targetClassStr;
                         let realCourseId = 'DESCONHECIDO';
                         let realYear = new Date().getFullYear().toString();

                         if (!cErr && cRows) {
                             // Limpeza agressiva para garantir o match absoluto (ex: "3ºA INF" vira "3ainf")
                             const cleanTarget = targetClassStr.toLowerCase().replace(/[^a-z0-9]/g, '');
                             
                             cRows.forEach(r => {
                                 try {
                                     const obj = JSON.parse(r.payload);
                                     const cleanName = (obj.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                                     
                                     // Se bater o nome limpo OU se o frontend já enviou o UUID correto
                                     if (cleanName === cleanTarget || obj.id === targetClassStr) {
                                         realClassId = obj.id; // AQUI GARANTIMOS O UUID DA TURMA
                                         realCourseId = obj.matrixId || obj.courseId || realCourseId; // GARANTIMOS O CURSO PAI
                                         realYear = obj.academicYear || realYear;
                                     }
                                 } catch(e){}
                             });
                         }

                         // Trava de Segurança: Se não achou o Curso PAI, aborta para não sujar a grade!
                         if (realCourseId === 'DESCONHECIDO') {
                             console.error("[EXTRA_ENGINE] ALERTA CRÍTICO: Falha ao resolver o UUID da Turma. Inserção abortada para proteger a integridade da grade.");
                             return res.status(400).json({ success: false, error: "Turma não encontrada no banco. Abortado." });
                         }

                         db.serialize(() => {
                             db.run("BEGIN TRANSACTION;");
                             let hasError = false;

                             timesToProcess.forEach(timeStr => {
                                 const patchData = JSON.stringify({ classType: classType, isExtra: true, isPending: false, subject: targetSubject });
                                 
                                 // Tenta UPDATE usando a string exata (dayStr)
                                 const updateQ = `UPDATE schedules SET teacherId = ?, disciplineId = ?, records = json_patch(COALESCE(records, '{}'), ?) WHERE classId = ? AND dayOfWeek = ? AND slotId = ? AND ( (week_id = ? AND type IN ('previa', 'atual', 'oficial')) OR (? IS NULL AND type = 'padrao' AND (week_id IS NULL OR week_id = '')) )`;
                                 
                                 db.run(updateQ, [row.requester_id, targetSubject, patchData, realClassId, dayStr, timeStr, weekId, weekId], function(upErr) {
                                     if (upErr) hasError = true;
                                     if (this.changes === 0 && !upErr) {
                                         // Força INSERT com a hierarquia completa e validada
                                         const sid = 's_ext_' + Date.now() + Math.random().toString(36).substring(2,6);
                                         db.run(`INSERT INTO schedules (id, courseId, academic_year, classId, dayOfWeek, slotId, teacherId, disciplineId, type, week_id, records) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                                         [sid, realCourseId, realYear, realClassId, dayStr, timeStr, row.requester_id, targetSubject, targetType, weekId, patchData]);
                                     }
                                 });
                             });

                             db.run("COMMIT;", (commitErr) => {
                                 if (commitErr || hasError) {
                                     db.run("ROLLBACK;");
                                     res.status(500).json({ error: "Erro na integridade da Transação" });
                                 } else {
                                     const notifyTitle = 'Lançamento Extra Homologado';
                                     const notifyMsg = `Sua solicitação para inserir aula de ${classType} (${targetSubject}) em ${dayStr} foi homologada e está na grade.`;
                                     const now = new Date().toISOString();
                                     db.run("INSERT INTO notifications (type, target, title, message, createdAt) VALUES ('SYSTEM', ?, ?, ?, ?)", [row.requester_id, notifyTitle, notifyMsg, now], function(){});
                                     io.emit('schedule_updated');
                                     res.json({ success: true, homologacaoStatus: 'EXECUTADA_EXTRA' });
                                 }
                             });
                         });
                     });
                 } catch(errExtract) {
                     console.error("[EXTRA_ENGINE] Falha Processando JSON da Aula Extra:", errExtract);
                     res.json({ success: true, homologacaoStatus: 'FALHA_PARSE' });
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
    });
  } catch(e) { res.status(500).json({error: e.message}); }
});


  return router;
};
