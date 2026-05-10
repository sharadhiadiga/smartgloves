const mongoose = require('mongoose');

const smartGloveSchema = new mongoose.Schema({
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
  predictionLevel: {
    type: String,
    required: false,
    default: 'Unknown',
  },
  stress: {
    type: Number,
    required: false,
    default: 0,
  },
  issues: {
    type: [String],
    required: false,
    default: [],
  },
  measures: {
    type: [String],
    required: false,
    default: [],
  },
  deviceId: {
    type: String,
    required: false,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, {
  collection: 'smartgloves',
});

const SmartGlove = mongoose.model('SmartGlove', smartGloveSchema);

module.exports = SmartGlove;
