const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();
console.log('[ENV] MONGO_URI set:', Boolean(process.env.MONGO_URI));
console.log('[ENV] ML_API_URL:', process.env.ML_API_URL || '(default http://127.0.0.1:5001/predict)');
const connectDB = require('./config/db');
const dataRouter = require('./routes/data');
const tokenRouter = require('./routes/token');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

app.use((req, res, next) => {
  const startedAt = Date.now();
  console.log(`[API][REQUEST] ${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
  res.on('finish', () => {
    console.log(`[API][RESPONSE] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt}ms)`);
  });
  next();
});

app.get('/', (req, res) => {
  res.send('Server is working');
});

app.get('/health', (req, res) => {
  const ready = mongoose.connection.readyState;
  const dbLabel = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' }[ready] || `state_${ready}`;
  res.json({
    status: 'online',
    database: dbLabel,
    uptimeSec: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
});

app.use('/api', dataRouter);
app.use('/api', tokenRouter);

app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
  });
});

app.use((err, req, res, next) => {
  console.error('[ERROR]', err);

  const statusCode = err.status && Number.isInteger(err.status) ? err.status : 500;
  const errorMessage = err.message || 'Internal server error';

  res.status(statusCode).json({
    error: errorMessage,
  });
});

const startServer = async () => {
  try {
    await connectDB();
  } catch (error) {
    console.warn('MongoDB connection failed. Server will continue without database access.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on 0.0.0.0:${PORT}`);
  });
};

startServer();