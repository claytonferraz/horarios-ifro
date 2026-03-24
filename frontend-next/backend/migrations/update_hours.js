const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./horarios.db');

db.serialize(() => {
  db.all("SELECT * FROM curriculum_data WHERE dataType = 'matrix'", (err, rows) => {
    const updateStmt = db.prepare("UPDATE curriculum_data SET payload = ? WHERE id = ?");
    rows.forEach(r => {
      try {
        const matrix = JSON.parse(r.payload);
        if (matrix.series) {
          matrix.series.forEach(serie => {
            if (serie.disciplines) {
              serie.disciplines.forEach(disc => {
                const h = parseInt(disc.hours) || 0;
                // Aplica 1 aula para cada 40h
                disc.aulas_semanais = Math.floor(h / 40);
              });
            }
          });
        }
        updateStmt.run([JSON.stringify(matrix), r.id]);
      } catch (e) {}
    });
    updateStmt.finalize();
    console.log("Updated aulas_semanais for all matrices.");
  });
});
