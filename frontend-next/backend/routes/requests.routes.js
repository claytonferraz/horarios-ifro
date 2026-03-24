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

router.put('/:id/status', (req, res) => {
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


  return router;
};
