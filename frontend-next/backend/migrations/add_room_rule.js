const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../horarios.db');
const db = new sqlite3.Database(dbPath);

const newRule = {
    code_name: 'no_room_overlap',
    title: 'Conflito de Espaço/Sala',
    description: 'Impede que duas turmas diferentes usem a mesma sala no mesmo horário.',
    severity: 'MANDATORY',
    is_active: 1,
    exceptions: JSON.stringify({ ignoredTeachers: [], ignoredWeeks: [] })
};

db.serialize(() => {
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO schedule_rules (code_name, title, description, severity, is_active, exceptions)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
        newRule.code_name, 
        newRule.title, 
        newRule.description, 
        newRule.severity, 
        newRule.is_active, 
        newRule.exceptions,
        (err) => {
            if (err) {
                console.error('Erro ao inserir regra de sala:', err);
            } else {
                console.log('Regra de sala inserida/verificada com sucesso.');
            }
        }
    );
    
    stmt.finalize(() => {
        db.close();
    });
});
