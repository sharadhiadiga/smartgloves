const http = require('http');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();
console.log('[ENV] MONGO_URI set:', Boolean(process.env.MONGO_URI));
console.log('[ENV] ML_API_URL:', process.env.ML_API_URL || '(optional)');
console.log('[ENV] PORT:', process.env.PORT || 5000);

const connectDB = require('./config/db');
const vitalsRouter = require('./routes/vitals');
const tokenRouter = require('./routes/token');
const { initSocketIO } = require('./services/socketHub');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '256kb' }));

app.use((req, res, next) => {
  const startedAt = Date.now();
  console.log(`[API][REQUEST] ${req.method} ${req.originalUrl}`);
  res.on('finish', () => {
    console.log(`[API][RESPONSE] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt}ms)`);
  });
  next();
});

app.get('/', (req, res) => {
  res.send('Smart Gloves API — WiFi IoT');
});

app.get('/health', (req, res) => {
  const ready = mongoose.connection.readyState;
  const dbLabel = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' }[ready] || `state_${ready}`;
  res.json({
    status: 'online',
    database: dbLabel,
    uptimeSec: Math.round(process.uptime()),
    time: new Date().toISOString(),
    endpoints: [
      'POST /api/vitals',
      'GET /api/dashboard',
      'GET /api/alerts',
      'GET /api/patients',
      'Socket.IO realtime',
    ],
  });
});

app.use('/api', vitalsRouter);
app.use('/api', tokenRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl });
});

app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  const statusCode = err.status && Number.isInteger(err.status) ? err.status : 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

const httpServer = http.createServer(app);
initSocketIO(httpServer);

const startServer = async () => {
  try {
    await connectDB();
  } catch (error) {
    console.warn('[DB] MongoDB connection failed — continuing with limited persistence.');
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] HTTP + Socket.IO on 0.0.0.0:${PORT}`);
  });
};

startServer();
