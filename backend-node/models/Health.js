// models/Health.js
const mongoose = require('mongoose');

const healthSchema = new mongoose.Schema({
  temperature: {
    type: Number,
    required: true,
  },
  heartRate: {
    type: Number,
    required: true,
  },
  spo2: {
    type: Number,
    required: true,
  },
  gsr: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    required: true,
    default: 'Unknown',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const Health = mongoose.model('Health', healthSchema);

module.exports = Health;
