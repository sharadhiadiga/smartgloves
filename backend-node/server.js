const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
console.log("MONGO URI:", process.env.MONGO_URI);
const connectDB = require('./config/db');
const dataRouter = require('./routes/data');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
  next();
});

app.get('/', (req, res) => {
  res.send('Server is working');
});

app.use('/api', dataRouter);

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

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();