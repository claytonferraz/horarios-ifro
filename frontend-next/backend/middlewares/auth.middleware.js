const jwt = require('jsonwebtoken');
require('dotenv').config();
const db = require('../db');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET ausente');
}

const JWT_SECRET = process.env.JWT_SECRET;

function getTokenFromCookieHeader(cookieHeader = '') {
  if (!cookieHeader) return null;
  const entries = String(cookieHeader).split(';');
  for (const entry of entries) {
    const [rawKey, ...rawValue] = entry.split('=');
    const key = String(rawKey || '').trim();
    if (key !== 'admin_token') continue;
    const value = rawValue.join('=').trim();
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch (_) {
      return value;
    }
  }
  return null;
}

function parsePerfis(perfisRaw) {
  try {
    const parsed = JSON.parse(perfisRaw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function buildAccessContext(user) {
  const perfis = parsePerfis(user?.perfis);
  const normalizedPerfis = perfis
    .map((perfil) => String(perfil || '').toLowerCase())
    .filter(Boolean);

  const isManager = normalizedPerfis.some((perfil) => ['gestor', 'gestao', 'tae'].includes(perfil));
  const isAdmin = normalizedPerfis.includes('admin') || user?.is_admin === 1;
  const role = isAdmin ? 'admin' : (isManager ? 'gestao' : (normalizedPerfis.length > 0 ? 'servidor' : 'publico'));

  return {
    id: user?.siape,
    siape: user?.siape,
    nome_exibicao: user?.nome_exibicao,
    email: user?.email,
    status: user?.status,
    perfis,
    normalizedPerfis,
    isAdmin,
    isManager,
    role,
  };
}

const verifyToken = (req, res, next) => {
  const auth = req.headers.authorization;
  const bearerToken = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const cookieToken = getTokenFromCookieHeader(req.headers.cookie);
  const token = bearerToken || cookieToken;
  if (!token) return res.status(401).json({ error: 'Token ausente.' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Sessão expirada.' });

    db.get(
      "SELECT siape, nome_exibicao, email, status, perfis, is_admin FROM users WHERE siape = ?",
      [decoded.id],
      (dbErr, user) => {
        if (dbErr) return res.status(500).json({ error: 'Erro ao validar a sessão.' });
        if (!user) return res.status(401).json({ error: 'Sessão inválida.' });
        if (user.status !== 'ativo') return res.status(403).json({ error: 'Usuário inativo.' });

        req.userId = user.siape;
        req.user = buildAccessContext(user);
        next();
      }
    );
  });
};

const requireManager = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
  if (!req.user.isManager && !req.user.isAdmin) {
    return res.status(403).json({ error: 'Sem permissão.' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Sem permissão.' });
  }
  next();
};

module.exports = {
  buildAccessContext,
  requireAdmin,
  requireManager,
  verifyToken,
  JWT_SECRET
};
