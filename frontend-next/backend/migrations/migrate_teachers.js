const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./horarios.db');

db.all("SELECT siape, nome_exibicao, nome_completo FROM users", (err, users) => {
  if (err) throw err;
  
  const findSiape = (name) => {
    if (!name || name === 'SEM PROFESSOR' || name === 'SUBSTITUTO') return name; 
    
    let target = name.toString().trim().toLowerCase();
    
    let u = users.find(user => 
      (user.nome_exibicao && user.nome_exibicao.toLowerCase() === target) || 
      (user.nome_completo && user.nome_completo.toLowerCase() === target)
    );
    if (u) return u.siape;
    
    u = users.find(user => 
      (user.nome_exibicao && user.nome_exibicao.toLowerCase().includes(target)) || 
      (user.nome_completo && user.nome_completo.toLowerCase().includes(target))
    );
    if (u) return u.siape;
    
    return name;
  };

  db.all("SELECT id, payload FROM curriculum_data WHERE dataType = 'class'", (err, classes) => {
     let classesUpdated = 0;
     classes.forEach(clsRow => {
        let payload = JSON.parse(clsRow.payload);
        let changed = false;
        
        if (payload.professorAssignments) {
           for (let dsId in payload.professorAssignments) {
              payload.professorAssignments[dsId] = payload.professorAssignments[dsId].map(tName => {
                 const siape = findSiape(tName);
                 if (siape !== tName) changed = true;
                 return siape;
              });
           }
        }
        
        if (changed) {
           db.run("UPDATE curriculum_data SET payload = ? WHERE id = ?", [JSON.stringify(payload), clsRow.id], (err) => {
             if(err) console.error("Erro update class", err);
           });
           classesUpdated++;
        }
     });
     console.log(`Migrados professores em ${classesUpdated} turmas (curriculum_data).`);
  });

  db.all("SELECT id, records FROM schedules", (err, schedules) => {
     let schedulesUpdated = 0;
     schedules.forEach(schedRow => {
        let records = JSON.parse(schedRow.records);
        let changed = false;
        
        records = records.map(r => {
           if (r.teacher && r.teacher !== 'SEM PROFESSOR' && r.teacher !== 'SUBSTITUTO') {
               const siape = findSiape(r.teacher);
               if (siape !== r.teacher) {
                  r.teacher = siape;
                  changed = true;
               }
           }
           return r;
        });
        
        if (changed) {
           db.run("UPDATE schedules SET records = ? WHERE id = ?", [JSON.stringify(records), schedRow.id], (err) => {
               if(err) console.error("Erro update schedule", err);
           });
           schedulesUpdated++;
        }
     });
     console.log(`Migrados professores em ${schedulesUpdated} grades (schedules).`);
  });
});
