const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./horarios.db');

const initialIntervals = [
  { id: 'inv_mat', shift: 'Matutino', position: 3, duration: 20, description: 'Intervalo/Lanche' },
  { id: 'inv_vesp', shift: 'Vespertino', position: 3, duration: 20, description: 'Intervalo/Lanche' },
  { id: 'inv_not', shift: 'Noturno', position: 2, duration: 10, description: 'Intervalo/Lanche' }
];

db.serialize(() => {
  db.run("INSERT OR REPLACE INTO config (id, intervals) VALUES ('config_2026', ?)", [JSON.stringify(initialIntervals)], function(err) {
    if (err) {
      console.error(err.message);
    } else {
      console.log(`Configuração de intervalos padrao para 2026 atualizada com sucesso. Registros inseridos.`);
    }
  });
});
db.close();
