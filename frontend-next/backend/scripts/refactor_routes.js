const fs = require('fs');

const code = fs.readFileSync('server.js', 'utf8');
const startMarker = "// ==========================================\n// ROTAS DE SEMANAS ACADÊMICAS";
const endMarker = "const PORT = process.env.PORT || 3012;";

const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.error("Markers not found!");
    process.exit(1);
}

const extractedCode = code.substring(startIndex, endIndex);

// Splitting extracted code into 3 parts conceptually for 3 files: 
// 1. config.routes.js (academic weeks)
// 2. admin.routes.js (gestão acadêmica, curriculum, teachers)
// 3. requests.routes.js (solicitações)

const adminMarker = "// ==========================================\n// ROTAS GESTÃO ACADÊMICA (ADMIN & ESTATÍSTICAS)";
const reqMarker = "// ==========================================\n// ROTAS DE SOLICITAÇÕES DE TROCA E VAGA";

const p1End = extractedCode.indexOf(adminMarker);
const p2End = extractedCode.indexOf(reqMarker);

const configStr = extractedCode.substring(0, p1End);
const adminStr = extractedCode.substring(p1End, p2End);
const reqStr = extractedCode.substring(p2End);

const buildRouter = (content) => `const express = require('express');
const db = require('../db');
const { verifyToken } = require('../middlewares/auth.middleware');
const bcrypt = require('bcryptjs');

module.exports = function(io) {
  const router = express.Router();
${content.replace(/app\./g, 'router.').replace(/\/api\/academic-weeks/g, '').replace(/\/api\/admin/g, '').replace(/\/api\/requests/g, '').replace(/\/api\/teachers/g, '/teachers')}
  return router;
};
`;

const configOut = buildRouter(configStr).replace(/router\.get\('',/g, "router.get('/',").replace(/router\.post\('',/g, "router.post('/',");
const adminOut = buildRouter(adminStr).replace(/router\.get\('',/g, "router.get('/',").replace(/router\.post\('',/g, "router.post('/',");
const reqOut = buildRouter(reqStr).replace(/router\.get\('',/g, "router.get('/',").replace(/router\.post\('',/g, "router.post('/',");

fs.writeFileSync('routes/config.routes.js', configOut);
fs.writeFileSync('routes/admin.routes.js', adminOut);
fs.writeFileSync('routes/requests.routes.js', reqOut);

const injections = `
const configRoutes = require('./routes/config.routes')(io);
const adminRoutes = require('./routes/admin.routes')(io);
const requestsRoutes = require('./routes/requests.routes')(io);

app.use('/api/academic-weeks', configRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/teachers', adminRoutes); // fallback for /api/teachers/:siape/admin-status
`;

const newServerCode = code.substring(0, startIndex) + injections + "\n" + code.substring(endIndex);
fs.writeFileSync('server.js', newServerCode);

console.log("Refactoring complete");
