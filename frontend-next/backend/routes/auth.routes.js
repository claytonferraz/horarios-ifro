const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { verifyToken, JWT_SECRET } = require('../middlewares/auth.middleware');
const { authenticateLDAP } = require('../services/ldap.service');

router.get('/setup', (req, res) => {
  db.get("SELECT COUNT(*) as count FROM users WHERE perfis LIKE '%admin%'", (err, row) => {
    if (err) {
      console.error("ERRO NO SETUP GET:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ needsSetup: row.count === 0 });
  });
});

router.post('/setup', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password || password.length < 4) return res.status(400).json({ error: "Credenciais inválidas." });
    
    db.get("SELECT COUNT(*) as count FROM users WHERE perfis LIKE '%admin%'", async (err, row) => {
      if (err) {
        console.error("ERRO NO SETUP POST (check):", err);
        return res.status(500).json({ error: err.message });
      }
      if (row.count > 0) return res.status(403).json({ error: "O administrador mestre já foi configurado." });
      
      const hash = await bcrypt.hash(password, 10);
      db.run("INSERT INTO users (siape, nome_completo, nome_exibicao, email, senha_hash, perfis, atua_como_docente) VALUES (?, 'Administrador', 'Admin', ?, ?, '[\"admin\"]', 0)", 
        ['admin', username, hash], function(err) {
        if (err) {
          console.error("ERRO NO SETUP POST (insert):", err);
          return res.status(500).json({ error: "Erro ao criar admin." });
        }
        res.json({ message: "Admin criado com sucesso." });
      });
    });
  } catch(e) {
    console.error("ERRO FATAL NO SETUP:", e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    console.log("Tentativa de login para:", username);

    // Bypass especial para acesso administrativo de emergencia:
    if (username === '1986393' && password === 'dape@26') {
      const token = jwt.sign({ id: '1986393', role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
      return res.json({ token, role: 'admin', siape: '1986393', nome_exibicao: 'Super Admin', perfis: ['admin'], isAdmin: true });
    }
    
    db.get("SELECT * FROM users WHERE email = ? OR siape = ? OR nome_exibicao = ?", [username, username, username], async (err, user) => {
      if (err) {
        console.error("ERRO SQL NO LOGIN:", err);
        return res.status(500).json({ error: err.message });
      }

      // BLOQUEIO DE AUTORIZACAO: O utilizador tem de estar pre-registado na BD local
      if (!user) {
        console.log("Usuario nao encontrado na BD local:", username);
        return res.status(401).json({ error: "Acesso Negado: O seu SIAPE nao esta registado no sistema de horarios." });
      }

      if (user.status !== 'ativo') return res.status(401).json({ error: "Usuário inativo." });
      
      try {
        let isValid = false;

        // 1. TENTA AUTENTICAR VIA LDAP (REDE INSTITUCIONAL)
        isValid = await authenticateLDAP(username, password);

        // 2. FALLBACK PARA BASE DE DADOS LOCAL
        if (!isValid) {
          console.log(`[AUTH] LDAP falhou ou nao configurado. Tentando fallback local para: ${username}`);
          if (user.senha_hash && user.senha_hash.startsWith('$2')) {
            isValid = await bcrypt.compare(password, user.senha_hash);
          } else {
            isValid = (password === user.senha_hash);
          }
        }

        if (!isValid) return res.status(401).json({ error: "Usuário ou senha incorretos." });

        let perfis = [];
        try {
          perfis = JSON.parse(user.perfis || '[]');
        } catch(e) {
          console.warn("Falha ao parsear perfis do usuário:", user.siape);
        }
        
        const isManager = perfis.some(p => ['gestor', 'gestao', 'tae'].includes(p.toLowerCase()));
        const isUserAdmin = perfis.includes('admin') || user.is_admin === 1;
        const role = isUserAdmin ? 'admin' : (isManager ? 'gestao' : (perfis.length > 0 ? 'servidor' : 'publico'));
        const token = jwt.sign({ id: user.siape, role }, JWT_SECRET, { expiresIn: '12h' });
        
        console.log("Login bem sucedido:", user.siape);
        res.json({ token, role, siape: user.siape, nome_exibicao: user.nome_exibicao, perfis, isAdmin: isUserAdmin });
      } catch(authErr) {
        console.error("ERRO NA VERIFICACAO:", authErr);
        res.status(500).json({ error: "Erro na verificacao das credenciais." });
      }
    });
  } catch(e) {
    console.error("ERRO FATAL NO LOGIN:", e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/me', verifyToken, (req, res) => {
  db.get("SELECT siape, nome_exibicao, email, perfis, is_admin FROM users WHERE siape = ?", [req.userId], (err, user) => {
    if (err) return res.status(500).json({ error: "Erro no servidor." });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
    
    let perfis = [];
    try {
      perfis = JSON.parse(user.perfis || '[]');
    } catch(e) {}
    
    const isManager = perfis.some(p => ['gestor', 'gestao', 'tae'].includes(p.toLowerCase()));
    const isUserAdmin = perfis.includes('admin') || user.is_admin === 1;
    const role = isUserAdmin ? 'admin' : (isManager ? 'gestao' : (perfis.length > 0 ? 'servidor' : 'publico'));
    
    res.json({ id: user.siape, username: user.email || user.siape, role, nome_exibicao: user.nome_exibicao, perfis, isAdmin: isUserAdmin });
  });
});

module.exports = router;
