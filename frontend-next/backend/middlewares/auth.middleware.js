const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'SUA_CHAVE_SECRETA_AQUI_MUITO_SEGURA_2026';

const verifyToken = (req, res, next) => {
  const bearerHeader = req.headers['authorization'];
  if (!bearerHeader) return res.status(403).json({ error: 'Acesso negado.' });
  
  const token = bearerHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Sessão expirada.' });
    req.userId = decoded.id;
    next();
  });
};

module.exports = {
  verifyToken,
  JWT_SECRET
};
