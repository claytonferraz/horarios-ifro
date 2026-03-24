const fs = require('fs');
const code = fs.readFileSync('server.js', 'utf8');

const startMarker = "// ==========================================\n// ROTAS DE HORÁRIOS\n// ==========================================";
const endMarker = "app.put('/api/config', verifyToken, (req, res) => {";

const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.log("Markers not found");
  process.exit(1);
}

const newCode = code.substring(0, startIndex) + 
startMarker + 
"\nconst schedulesRoutes = require('./routes/schedules.routes')(io);\napp.use('/api/schedules', schedulesRoutes);\n\n" + 
code.substring(endIndex);

fs.writeFileSync('server.js', newCode);
console.log("Patched server.js for schedules successfully");
