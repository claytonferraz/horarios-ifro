const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../horarios.db');
const db = new sqlite3.Database(dbPath);

console.log('--- Migrando tabela schedule_rules para suporte a Ano Letivo ---');

db.serialize(() => {
    // 1. Criar a nova tabela com a estrutura correta (Incluindo academic_year)
    db.run(`
        CREATE TABLE IF NOT EXISTS schedule_rules_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code_name TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            severity TEXT DEFAULT 'WARNING',
            is_active INTEGER DEFAULT 1,
            exceptions TEXT,
            academic_year TEXT NOT NULL,
            UNIQUE(code_name, academic_year)
        )
    `, (err) => {
        if (err) {
            console.error('Erro ao criar tabela schedule_rules_new:', err);
            return;
        }
        console.log('Tabela temporária schedule_rules_new criada.');

        // 2. Copiar as regras existentes da regra "Global" para 2024 e 2025 (ou anos detectados)
        // Como o original não tinha ano, vamos assumir que as atuais vão para 2024 e 2025
        const currentYear = new Date().getFullYear().toString();
        const nextYear = (new Date().getFullYear() + 1).toString();
        const yearsToSeed = [currentYear, nextYear];

        db.all('SELECT * FROM schedule_rules', [], (err, rows) => {
            if (err || !rows || rows.length === 0) {
                console.log('Nenhuma regra antiga para migrar ou tabela antiga inexistente. Usando padrões.');
                seedDefaultRules(yearsToSeed);
                return;
            }

            console.log(`Migrando ${rows.length} regras antigas para os anos: ${yearsToSeed.join(', ')}`);
            
            const stmt = db.prepare(`
                INSERT INTO schedule_rules_new (code_name, title, description, severity, is_active, exceptions, academic_year)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            yearsToSeed.forEach(year => {
                rows.forEach(row => {
                    stmt.run(row.code_name, row.title, row.description, row.severity, row.is_active, row.exceptions, year);
                });
            });

            stmt.finalize(() => {
                finalizeMigration();
            });
        });
    });
});

function seedDefaultRules(years) {
    const defaultRules = [
        { code: 'no_simultaneous_classes', title: 'Professor em aulas simultâneas', sev: 'MANDATORY' },
        { code: 'no_night_morning_clash', title: 'Interjornada Noturno/Matutino', sev: 'WARNING' },
        { code: 'no_triple_shift', title: 'Três turnos no mesmo dia', sev: 'WARNING' },
        { code: 'no_turn_transition_clash', title: 'Transição entre Turnos Adjacentes', sev: 'WARNING' },
        { code: 'no_room_overlap', title: 'Conflito de Espaço/Sala', sev: 'MANDATORY' }
    ];

    const stmt = db.prepare(`
        INSERT OR IGNORE INTO schedule_rules_new (code_name, title, description, severity, is_active, exceptions, academic_year)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    years.forEach(year => {
        defaultRules.forEach(r => {
            stmt.run(r.code, r.title, 'Descrição automática', r.sev, 1, '{}', year);
        });
    });

    stmt.finalize(() => {
        finalizeMigration();
    });
}

function finalizeMigration() {
    db.serialize(() => {
        // Drop old table (ou renomeia)
        db.run('DROP TABLE IF EXISTS schedule_rules');
        // Rename new to final
        db.run('ALTER TABLE schedule_rules_new RENAME TO schedule_rules');
        console.log('Migração de Banco de Dados Concluída!');
        db.close();
    });
}
