const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const http = require('http');
const { Server } = require('socket.io');

const defaultAllowedOrigins = [
  'http://localhost:3001', 'http://localhost:3000',
  'http://127.0.0.1:3001', 'http://127.0.0.1:3000',
  'https://10.60.5.67:3001', 'http://10.60.5.67:3001'
];
const envAllowedOrigins = String(process.env.CORS_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envAllowedOrigins]));

const localNetworkOriginPattern = /^https?:\/\/((localhost|127\.0\.0\.1|\[::1\])(:\d+)?|(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?)$/;

function isAllowedOrigin(origin) {
  if (!origin || allowedOrigins.includes(origin) || localNetworkOriginPattern.test(origin) || process.env.NODE_ENV !== 'production') return true;
  return false;
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
};

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV !== 'production' ? true : allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// 1. Segurança e Middlewares Core
app.use(helmet());
app.options(/.*/, cors(corsOptions));
app.use(cors(corsOptions));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 1000,
  message: { error: 'Muitas requisições deste IP, por favor aguarde 15 minutos.' }
});
app.use(generalLimiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Middlewares Customizados
const { attachUserIfPresent, requirePublicScheduleAccess } = require('./middlewares/auth.middleware');

// 2. Importação de Rotas
const authRoutes = require('./routes/auth.routes');
const schedulesRoutes = require('./routes/schedules.routes')(io);
const configRoutes = require('./routes/config.routes')(io);
const adminRoutes = require('./routes/admin.routes')(io);
const requestsRoutes = require('./routes/requests.routes')(io);
const notificationsRoutes = require('./routes/notifications.routes')(io);
const miscRoutes = require('./routes/misc.routes')(io);

// 3. Mapeamento de Endpoints (Compatibilidade API v1)
app.use('/api', miscRoutes);          // /api/status, /api/teachers, /api/curriculum
app.use('/api', configRoutes);        // /api/config, /api/academic-weeks
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/schedules', attachUserIfPresent, requirePublicScheduleAccess, schedulesRoutes);
app.use('/api/admin', attachUserIfPresent, requirePublicScheduleAccess, adminRoutes);
app.use('/api/requests', requestsRoutes);

// Servidor
const PORT = process.env.PORT || 3012;
server.listen(PORT, () => console.log(`Backend modularizado rodando na porta ${PORT}`));
