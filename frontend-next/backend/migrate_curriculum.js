const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'horarios.db');
const db = new sqlite3.Database(dbPath);

console.log('Migrating curriculum_data table...');

db.serialize(() => {
  // Add columns if they do not exist
  const alterQueries = [
    "ALTER TABLE curriculum_data ADD COLUMN academic_year TEXT",
    "ALTER TABLE curriculum_data ADD COLUMN course_id TEXT",
    "ALTER TABLE curriculum_data ADD COLUMN matrix_id TEXT"
  ];

  alterQueries.forEach(query => {
    db.run(query, (err) => {
      if (err) {
        // Ignorar erro de "duplicate column"
        if (!err.message.includes('duplicate column')) {
          console.warn('Alerta na migração da coluna:', err.message);
        }
      }
    });
  });

  // Extract from json and migrate
  db.all("SELECT id, dataType, payload FROM curriculum_data", (err, rows) => {
    if (err) throw err;
    console.log(`Found ${rows.length} elements to migrate.`);
    let stmt = db.prepare("UPDATE curriculum_data SET academic_year = ?, course_id = ?, matrix_id = ? WHERE id = ?");
    
    rows.forEach(row => {
      try {
        const payload = JSON.parse(row.payload);
        let academic_year = payload.academicYear || null;
        let course_id = payload.course || payload.courseAcronym || null;
        let matrix_id = payload.matrixId || (row.dataType === 'matrix' ? row.id : null);
        
        stmt.run(academic_year, course_id, matrix_id, row.id);
      } catch(e) {
        console.error('Failed to parse payload for id', row.id);
      }
    });

    stmt.finalize(() => {
      console.log('Migration complete.');
    });
  });
});
