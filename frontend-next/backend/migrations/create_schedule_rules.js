const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../horarios.db');
const db = new sqlite3.Database(dbPath);

const defaultRules = [
    {
        code_name: 'no_simultaneous_classes',
        title: 'Professor em aulas simultâneas',
        description: 'Um professor não pode ser alocado em duas ou mais turmas diferentes no exato mesmo horário/dia.',
        severity: 'MANDATORY',
        is_active: 1,
        exceptions: JSON.stringify({})
    },
    {
        code_name: 'no_night_morning_clash',
        title: 'Interjornada Noturno/Matutino',
        description: 'Um professor que lecionar nos dois últimos horários do turno da noite não deve lecionar nos dois primeiros horários do turno matutino no dia seguinte.',
        severity: 'WARNING',
        is_active: 1,
        exceptions: JSON.stringify({ ignoredTeachers: [], ignoredWeeks: [] })
    },
    {
        code_name: 'no_triple_shift',
        title: 'Três turnos no mesmo dia',
        description: 'Um professor não deve ser alocado nos três turnos (Matutino, Vespertino e Noturno) no mesmo dia útil.',
        severity: 'WARNING',
        is_active: 1,
        exceptions: JSON.stringify({ ignoredTeachers: [], ignoredWeeks: [] })
    },
    {
        code_name: 'no_turn_transition_clash',
        title: 'Transição entre Turnos Adjacentes',
        description: 'O professor que der a última aula de um turno não deve começar com a primeira do turno seguinte no mesmo dia (ex: Tarde/Noite).',
        severity: 'WARNING',
        is_active: 1,
        exceptions: JSON.stringify({ ignoredTeachers: [], ignoredWeeks: [] })
    }
];

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS schedule_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code_name TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            severity TEXT DEFAULT 'WARNING', /* MANDATORY, WARNING, MANDATORY_WITH_EXCEPTION */
            is_active INTEGER DEFAULT 1,
            exceptions TEXT
        )
    `, (err) => {
        if (err) {
            console.error('Erro ao criar tabela schedule_rules:', err);
            process.exit(1);
        } else {
            console.log('Tabela schedule_rules criada com sucesso.');
            const stmt = db.prepare(`
                INSERT OR IGNORE INTO schedule_rules (code_name, title, description, severity, is_active, exceptions)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            defaultRules.forEach(rule => {
                stmt.run(rule.code_name, rule.title, rule.description, rule.severity, rule.is_active, rule.exceptions);
            });
            stmt.finalize(() => {
                console.log('Regras iniciais inseridas com sucesso.');
                db.close();
            });
        }
    });
});
