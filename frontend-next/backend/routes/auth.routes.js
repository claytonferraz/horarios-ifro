const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const db = require('../db');
const { verifyToken, JWT_SECRET, buildAccessContext } = require('../middlewares/auth.middleware');
const { authenticateLDAP } = require('../services/ldap.service');

const authSchema = z.object({
  username: z.string().trim().min(1, 'Usuário é obrigatório.'),
  password: z.string().min(4, 'Credenciais inválidas.'),
});

function isLocalBootstrapRequest(req) {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').trim();
  const ip = forwardedFor || req.ip || req.socket?.remoteAddress || '';
  const host = req.hostname || forwardedHost || '';
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1'
  );
}

router.get('/setup', (req, res) => {
  if (!isLocalBootstrapRequest(req)) {
    return res.status(403).json({ error: 'Bootstrap disponível apenas localmente.' });
  }

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
    if (!isLocalBootstrapRequest(req)) {
      return res.status(403).json({ error: 'Bootstrap disponível apenas localmente.' });
    }

    const { username, password } = authSchema.parse(req.body);
    
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
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.issues[0]?.message || 'Credenciais inválidas.' });
    }
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', (req, res) => {
  try {
    const { username, password } = authSchema.parse(req.body);
    console.log("Tentativa de login para:", username);
    
    db.get("SELECT * FROM users WHERE email = ? OR siape = ?", [username, username], async (err, user) => {
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
          if (user.senha_hash && /^\$2[aby]\$/.test(user.senha_hash)) {
            isValid = await bcrypt.compare(password, user.senha_hash);
          } else {
            console.warn(`[AUTH] Senha local legada bloqueada para: ${username}`);
            isValid = false;
          }
        }

        if (!isValid) return res.status(401).json({ error: "Usuário ou senha incorretos." });

        const accessContext = buildAccessContext(user);
        const token = jwt.sign({ id: user.siape, role: accessContext.role }, JWT_SECRET, { expiresIn: '12h' });
        
        console.log("Login bem sucedido:", user.siape);
        res.json({
          token,
          role: accessContext.role,
          siape: user.siape,
          nome_exibicao: user.nome_exibicao,
          perfis: accessContext.perfis,
          isAdmin: accessContext.isAdmin
        });
      } catch(authErr) {
        console.error("ERRO NA VERIFICACAO:", authErr);
        res.status(500).json({ error: "Erro na verificacao das credenciais." });
      }
    });
  } catch(e) {
    console.error("ERRO FATAL NO LOGIN:", e);
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.issues[0]?.message || 'Credenciais inválidas.' });
    }
    res.status(500).json({ error: e.message });
  }
});

router.get('/me', verifyToken, (req, res) => {
  res.json({
    id: req.user.siape,
    username: req.user.email || req.user.siape,
    role: req.user.role,
    nome_exibicao: req.user.nome_exibicao,
    perfis: req.user.perfis,
    isAdmin: req.user.isAdmin
  });
});

module.exports = router;
