// config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/health-monitor';

  if (!process.env.MONGO_URI) {
    console.warn('MONGO_URI not defined, using fallback local MongoDB URI');
  }

  console.log(`[DB] Attempting MongoDB connection to ${mongoUri}`);

  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    throw error;
  }
};

module.exports = connectDB;
