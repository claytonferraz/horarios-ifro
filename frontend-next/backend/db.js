const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = path.join(__dirname, process.env.DB_FILENAME || 'horarios.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar no banco de dados:', err.message);
    } else {
        console.log('Banco de dados conectado em:', dbPath);
        // Habilitar modo WAL e tempo de timeout para alta escalabilidade horizontal de writes
        db.run('PRAGMA journal_mode = WAL;');
        db.run('PRAGMA synchronous = NORMAL;');
        db.run('PRAGMA busy_timeout = 5000;');
        db.run('PRAGMA cache_size = -20000;');
        db.run('PRAGMA temp_store = MEMORY;');
    }
});

module.exports = db;
