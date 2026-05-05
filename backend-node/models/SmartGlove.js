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
