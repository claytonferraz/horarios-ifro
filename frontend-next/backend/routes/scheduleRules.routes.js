const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireAdmin } = require('../middlewares/auth.middleware');

// GET all rules
router.get('/', (req, res) => {
    db.all('SELECT * FROM schedule_rules', [], (err, rows) => {
        if (err) {
            console.error('Erro ao buscar regras:', err);
            return res.status(500).json({ message: 'Erro ao buscar regras.' });
        }
        res.json(rows);
    });
});

// PUT update a rule
router.put('/:id', verifyToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { severity, is_active, exceptions } = req.body;
    
    // As in V1 we don't modify the logic or codename, only settings
    db.run(
        `UPDATE schedule_rules SET severity = ?, is_active = ?, exceptions = ? WHERE id = ?`,
        [severity, is_active ? 1 : 0, JSON.stringify(exceptions || {}), id],
        function(err) {
            if (err) {
                console.error('Erro ao atualizar regra:', err);
                return res.status(500).json({ message: 'Erro ao atualizar regra.' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ message: 'Regra não encontrada.' });
            }
            
            // Retorna a regra atualizada
            db.get('SELECT * FROM schedule_rules WHERE id = ?', [id], (err, row) => {
                res.json({ message: 'Regra atualizada com sucesso.', rule: row });
            });
        }
    );
});

module.exports = router;
