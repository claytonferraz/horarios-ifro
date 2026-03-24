const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./horarios.db');

db.serialize(() => {
  db.all("SELECT * FROM curriculum_data WHERE dataType = 'class' AND payload LIKE '%\"academicYear\":\"2026\"%'", (err, classesRows) => {
    
    db.all("SELECT * FROM curriculum_data WHERE dataType = 'matrix'", (err, matrixRows) => {
      const classesData = classesRows.map(r => JSON.parse(r.payload));
      const matrices = matrixRows.map(r => JSON.parse(r.payload));

      db.all("SELECT * FROM schedules", (err, scheduleRows) => {
         
         const report = [];

         scheduleRows.forEach(sched => {
            const records = JSON.parse(sched.records || '[]');
            
            classesData.forEach(cls => {
               const myRecords = records.filter(r => r.className === cls.name && r.year === '2026');
               if (myRecords.length === 0) return;

               const matrix = matrices.find(m => m.id === cls.matrixId);
               if (!matrix) return;
               const serie = matrix.series.find(s => s.id === cls.serieId);
               if (!serie) return;

               serie.disciplines.forEach(disc => {
                  const expectedCount = disc.aulas_semanais || 0;
                  const actualCount = myRecords.filter(r => r.subject === disc.name).length;

                  if (expectedCount > 0 && expectedCount !== actualCount) {
                     report.push(` - [${sched.id}] Turma: ${cls.name} | Disciplina: ${disc.name} | Separado: ${expectedCount}x | Alocado na Base: ${actualCount}x`);
                  }
               });
            });
         });

         console.log("=========================================");
         console.log(" RELATÓRIO DE INCONSISTÊNCIAS - ANO 2026 ");
         console.log("=========================================");
         if (report.length === 0) {
            console.log("Todas as disciplinas estão perfeitamente alocadas com sua respectiva Carga Horária e Semanas!");
         } else {
            console.log(`Encontradas ${report.length} divergências nos slots de horários:`);
            console.log(report.join('\n'));
         }
      });
    });
  });
});
