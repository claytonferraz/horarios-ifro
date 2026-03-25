const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./horarios.db');
const updateQ = `UPDATE schedules SET teacherId = ?, disciplineId = ?, records = json_patch(COALESCE(records, '{}'), ?) WHERE classId = ? AND dayOfWeek = ? AND slotId = ? AND ( (week_id = ? AND type IN ('previa', 'atual', 'oficial')) OR (? IS NULL AND type = 'padrao' AND (week_id IS NULL OR week_id = '')) )`;

db.run(updateQ, ['2091039', '[Aguardando] B.D.II', '{"classType":"Recuperação","isExtra":true,"isPending":true,"requestId":127}', 'yzgds7xl2', 'Segunda-feira', '16:40 - 17:30', '8', '8'], function(err) {
    if(err) console.error("UPD", err);
    console.log("UPD changes", this.changes);
});
