const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./horarios.db');
db.get("SELECT json_extract('{\"a\":1}', '$.a') as val", (err, row) => {
  if(err) console.error("ERR:", err.message);
  else console.log("OK:", row.val);
});
