const path = require('path');
const bcrypt = require(path.join(__dirname, '../node_modules/bcryptjs'));
const sqlite3 = require(path.join(__dirname, '../node_modules/sqlite3')).verbose();

const siape = '1986393';
const newPassword = 'master@';
const dbPath = path.join(__dirname, '../horarios.db');

async function resetPassword() {
    try {
        const hash = bcrypt.hashSync(newPassword, 10);
        const db = new sqlite3.Database(dbPath);
        
        db.run('UPDATE users SET senha_hash = ?, exigir_troca_senha = 0 WHERE siape = ?', [hash, siape], function(err) {
            if (err) {
                console.error('Error updating password:', err);
            } else if (this.changes === 0) {
                console.log('User not found.');
            } else {
                console.log('Password updated successfully for SIAPE:', siape);
            }
            db.close();
        });
    } catch (err) {
        console.error('Error hashing password:', err);
    }
}

resetPassword();
