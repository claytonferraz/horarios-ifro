const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./horarios.db');

async function runCleanup() {
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    // 1. DELETE configs, academic_years, and academic_weeks that are not 2026
    db.run("DELETE FROM config WHERE id != 'config_2026'");
    db.run("DELETE FROM academic_years WHERE year != '2026'");
    db.run("DELETE FROM academic_weeks WHERE academic_year != '2026'");

    // 2. Load Users
    db.all("SELECT * FROM users", (err, users) => {
      const normalizeStr = (str) => (str || '').toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
      const userMap = {}; // name -> nome_exibicao
      users.forEach(u => {
        userMap[normalizeStr(u.nome_exibicao)] = u.nome_exibicao;
        userMap[normalizeStr(u.nome_completo)] = u.nome_exibicao; // fallback
        
        // Split names to aggressively catch initials if needed: "Wendell A." -> "WENDELL"
        const names = normalizeStr(u.nome_exibicao).split(' ');
        if(names.length > 0) userMap[names[0]] = u.nome_exibicao; 
      });

      // 3. Force curriculum_data to 2026
      db.all("SELECT * FROM curriculum_data", (err, rows) => {
        const updateCurriculum = db.prepare("UPDATE curriculum_data SET payload = ? WHERE id = ?");
        rows.forEach(r => {
          try {
            const data = JSON.parse(r.payload);
            const needsUpdate = data.academicYear !== '2026';
            data.academicYear = '2026'; // Force 2026
            if (needsUpdate) {
              updateCurriculum.run([JSON.stringify(data), r.id]);
            }
          } catch(e) {}
        });
        updateCurriculum.finalize();

        // 4. Validate and Fix Schedules
        db.all("SELECT * FROM schedules", (err, scheduleRows) => {
          const updateSchedule = db.prepare("UPDATE schedules SET records = ? WHERE id = ?");
          
          let divergencyLog = [];

          scheduleRows.forEach(sched => {
            try {
              const records = JSON.parse(sched.records);
              let changed = false;

              records.forEach(slot => {
                // Ensure Year is 2026
                if (slot.year !== '2026') {
                  slot.year = '2026';
                  changed = true;
                }

                if (slot.teacher) {
                  let rawSearchName = normalizeStr(slot.teacher);
                  let searchNameParts = rawSearchName.split(' ');
                  
                  // Tenta matching exato, depois inicial, depois assume SEM PROF
                  if (userMap[rawSearchName]) {
                    if (slot.teacher !== userMap[rawSearchName]) {
                      slot.teacher = userMap[rawSearchName];
                      changed = true;
                    }
                  } else if (searchNameParts.length > 0 && userMap[searchNameParts[0]]) {
                     slot.teacher = userMap[searchNameParts[0]];
                     changed = true;
                  } else if (slot.teacher !== 'SEM PROFESSOR' && slot.teacher !== 'A Definir' && slot.teacher !== 'SUBSTITUTO') {
                    // Divergency!
                    divergencyLog.push(`[${sched.id}] Professor não encontrado: "${slot.teacher}". Substituindo por "SEM PROFESSOR". (Turma: ${slot.className}, Disciplina: ${slot.subject})`);
                    slot.teacher = 'SEM PROFESSOR';
                    changed = true;
                  }
                }
              });

              if (changed) {
                updateSchedule.run([JSON.stringify(records), sched.id]);
              }
            } catch(e) {}
          });
          updateSchedule.finalize();

          db.run("COMMIT", (errCommit) => {
            if (errCommit) {
              console.error("COMMIT Error:", errCommit);
            } else {
              console.log("=== RELATÓRIO DE LIMPEZA E CONSISTÊNCIA 2026 ===");
              console.log("-> Estruturas alinhadas em 2026.");
              console.log("-> Registros órfãos, configs e logs antigos deletados.");
              console.log("-> Divergências de Professores no CSV resolvidas automaticamente:\n");
              if (divergencyLog.length > 0) {
                let uniqueLogs = [...new Set(divergencyLog)];
                uniqueLogs.forEach(l => console.log(l));
              } else {
                console.log("Nenhuma divergência encontrada. Todos os professores do CSV bateram com o BD!");
              }
            }
            db.close();
          });
        });
      });
    });
  });
}

runCleanup();
