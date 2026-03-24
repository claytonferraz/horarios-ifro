const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./horarios.db');

db.serialize(() => {
  // Clear curriculum_data to avoid duplicates
  db.run("DELETE FROM curriculum_data");

  db.get("SELECT records FROM schedules WHERE id = 'Grade Padrão Anual-padrao'", (err, row) => {
    if (err || !row) {
      console.error("Erro ao buscar a Grade Padrão Anual.");
      db.close();
      return;
    }

    const records = JSON.parse(row.records);

    // map: course -> { classNames: { className: { subjects: { subjectName: count } } } }
    const coursesMap = {};

    records.forEach(r => {
      const course = r.course || 'OUTROS';
      const className = r.className;
      const subject = r.subject || 'Atividade';

      if (!coursesMap[course]) coursesMap[course] = {};
      if (!coursesMap[course][className]) coursesMap[course][className] = {};
      if (!coursesMap[course][className][subject]) coursesMap[course][className][subject] = 0;

      coursesMap[course][className][subject]++;
    });

    const stmt = db.prepare("INSERT INTO curriculum_data (id, dataType, payload) VALUES (?, ?, ?)");
    
    let count = 0;
    for (const [courseName, classesMap] of Object.entries(coursesMap)) {
      const matrixId = 'mx_' + Math.random().toString(36).substring(2, 9);
      
      const seriesArr = [];
      
      for (const [className, subjectsMap] of Object.entries(classesMap)) {
        const seriesId = 'sr_' + Math.random().toString(36).substring(2, 9);
        const disciplinesArr = [];
        
        for (const [subjectName, classCount] of Object.entries(subjectsMap)) {
          const discId = 'ds_' + Math.random().toString(36).substring(2, 9);
          disciplinesArr.push({
            id: discId,
            name: subjectName,
            hours: classCount * 40,
            environments: []
          });
        }
        
        seriesArr.push({
          id: seriesId,
          name: className,
          disciplines: disciplinesArr
        });
      }
      
      const acronym = courseName.substring(0, 3).toUpperCase();

      const payload = {
        id: matrixId,
        name: `Matriz - ${courseName}`,
        course: courseName,
        courseAcronym: acronym,
        academicYear: "2026", // Forced academic year linking
        series: seriesArr
      };

      stmt.run(matrixId, 'matrix', JSON.stringify(payload));
      count++;
    }

    stmt.finalize();

    console.log(`Auditoria completa: Reconstrução executada. ${count} matrizes criadas a partir do arquivo padrão.`);
    db.close();
  });
});
