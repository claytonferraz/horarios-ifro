const express = require('express');
const db = require('../db');
const { verifyToken } = require('../middlewares/auth.middleware');
const bcrypt = require('bcryptjs');

module.exports = function(io) {
  const router = express.Router();
// ==========================================
// ROTAS DE SOLICITAÇÕES DE TROCA E VAGA
// ==========================================
router.get('/', (req, res) => {
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

router.post('/', (req, res) => {
  try {
    const data = req.body;
    let action = data.action || 'vaga';

    // O fallback de ação protege o endpoint
    if (!['vaga', 'troca', 'oferta_vaga', 'lancamento_extra'].includes(action)) {
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
        const slotsObj = data.proposed_slot || {};
        const targets = slotsObj.slots || [];
        const dayNum = slotsObj.day;
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

            const promises = targets.map((s) => {
               return new Promise((resolve) => {
                   const uQ = `UPDATE schedules SET teacherId = 'A Definir', records = json_patch(COALESCE(records, '{}'), ?) WHERE classId = ? AND dayOfWeek = ? AND slotId = ? AND ( (week_id = ? AND type IN ('previa', 'atual', 'oficial')) OR (? IS NULL AND type = 'padrao' AND (week_id IS NULL OR week_id = '')) )`;
                   const meta = JSON.stringify({ isSubstituted: true, originalSubject: (s.subject || subject), isDisponibilizada: true, offeredTo: slotsObj.targetSubject });
                   db.run(uQ, [meta, cid, dayNum, s.time, returnWeekId || null, returnWeekId || null], () => resolve());
               });
            });

            Promise.all(promises).then(() => {
                db.run('INSERT INTO exchange_requests (action_type, requester_id, substitute_id, target_class, original_day, original_time, subject, return_week, reason, obs, status, original_slot, proposed_slot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [action, requester, (slotsObj.targetSubject === 'ALL' ? '' : slotsObj.targetSubject), targetClass, slotsObj.day, slotsObj.time, 'Aulas Agrupadas', returnWeekId || '', reason || '', obs || '', 'pendente', JSON.stringify(data.original_slot || {}), JSON.stringify(data.proposed_slot || {})],
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
        });

    } else if (action === 'lancamento_extra') {
        // Regra de Negócio: Atendimento ao Aluno não precisa de homologação da Gestão (DAPE).
        const propClassType = data.proposed_slot?.classType || '';
        const isAtendimento = propClassType.toLowerCase().includes('atendimento');
        
        const initialStatus = isAtendimento ? 'aprovada' : 'pronto_para_homologacao';
        const finalFeedback = isAtendimento ? 'Auto-homologado pelo sistema (Atendimento ao Aluno)' : null;

        db.run(
            'INSERT INTO exchange_requests (action_type, requester_id, substitute_id, target_class, original_day, original_time, subject, return_week, reason, obs, status, admin_feedback, original_slot, proposed_slot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [action, requester, '', targetClass, originalDay, originalTime, subject, returnWeekId || '', reason || '', obs || '', initialStatus, finalFeedback, JSON.stringify(data.original_slot || {}), JSON.stringify(data.proposed_slot || {})],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                const insertedId = this.lastID;
                
                // Se for Atendimento, enviamos um sinal ao Frontend informando 'autoApproved: true'
                // O frontend cuidará de disparar o PUT /status internamente para acionar o motor de inserção na grade.
                res.json({ success: true, id: insertedId, autoApproved: isAtendimento });
            }
        );
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

router.put('/:id/status', verifyToken, (req, res) => {
  try {
    const { status, admin_feedback, system_message } = req.body;
    let approved_by = null;
    if (status === 'aprovada' || status === 'aprovado' || status === 'rejeitado') {
        approved_by = req.userId; // O SIAPE de quem clicou
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

                         console.log("\n[SWAP_ENGINE] ==============================================");
                         console.log("[SWAP_ENGINE] INICIANDO HOMOLOGAÇÃO / SWAP CRUZADO IDREQ:", req.params.id);
                         console.log(`[SWAP_ENGINE] NÓ ORIGEM  -> SIApE (A): ${row.requester_id} entregando ${orig.subject} [${orig.day} ${orig.time}] - T: ${origTargetClass}`);
                         console.log(`[SWAP_ENGINE] NÓ OBJETIVO-> SIApE (B): ${row.substitute_id} receiving ${prop.subject} [${prop.day} ${prop.time}] - T: ${propTargetClass}`);

                         db.serialize(() => {
                             console.log("[SWAP_ENGINE] > BEGIN TRANSACTION");
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
                     }); // End db.all

                 } catch(jsonErr) {
                     console.warn("[SWAP_ENGINE] Falha ao parsear JSON payload. Requisição Legada. Pulando motor.", jsonErr);
                     io.emit('schedule_updated');
                     res.json({ success: true, homologacaoStatus: 'MANUAL_LEGADO' });
                 }
             } else if (!err3 && row && row.action_type === 'lancamento_extra') {
                 // HOMOLOGAÇÃO DE LANÇAMENTO DE AULA EXTRA
                 try {
                     const propData = JSON.parse(row.proposed_slot || '{}');
                     
                     // Suporta o formato de array (times) ou string única (time/original_time)
                     let timesToProcess = [];
                     if (propData.times && Array.isArray(propData.times)) timesToProcess = propData.times;
                     else if (propData.time) timesToProcess = [propData.time];
                     else if (row.original_time) timesToProcess = [row.original_time];

                     const weekId = row.return_week || null;
                     const targetType = propData.type || 'previa';
                     const classType = propData.classType || 'Regular';
                     const targetSubject = propData.subject || row.subject;

                     const dayStr = propData.day || row.original_day; // Usando a string literal
                     const targetClassStr = propData.classId || propData.className || row.target_class;

                     console.log(`[EXTRA_ENGINE] HOMOLOGANDO ${classType} PARA SIAPE: ${row.requester_id} na turma ${targetClassStr}`);

                     // 1. Auto-Healing Total (O Exterminador de Fantasmas)
                     // Deleta qualquer aula corrompida que esteja sem curso ou com dia numerico.
                     db.run("DELETE FROM schedules WHERE courseId = 'DESCONHECIDO' OR dayOfWeek IN ('1', '2', '3', '4', '5', '6', 1, 2, 3, 4, 5, 6)");

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

                         console.log(`[EXTRA_ENGINE] Resolução: [${targetClassStr}] -> UUID: ${realClassId} | Curso: ${realCourseId}`);

                         // Trava de Segurança: Se não achou o Curso PAI, aborta para não sujar a grade!
                         if (realCourseId === 'DESCONHECIDO') {
                             console.error("[EXTRA_ENGINE] ALERTA CRÍTICO: Falha ao resolver o UUID da Turma. Inserção abortada para proteger a integridade da grade.");
                             return res.json({ success: false, error: "Turma não encontrada no banco. Abortado." });
                         }

                         db.serialize(() => {
                             db.run("BEGIN TRANSACTION;");
                             let hasError = false;

                             timesToProcess.forEach(timeStr => {
                                 const patchData = JSON.stringify({ classType: classType, isExtra: true });
                                 
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
  } catch(e) { res.status(500).json({error: e.message}); }
});


  return router;
};
