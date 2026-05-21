const mongoose = require('mongoose');

const smartGloveSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: false,
  },
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
  temperatureCondition: {
    type: String,
    required: false,
    default: 'Normal',
  },
  heartRateCondition: {
    type: String,
    required: false,
    default: 'Normal',
  },
  spo2Condition: {
    type: String,
    required: false,
    default: 'Normal',
  },
  gsrCondition: {
    type: String,
    required: false,
    default: 'Normal',
  },
  overallRiskLevel: {
    type: String,
    required: false,
    default: 'Normal',
    index: true,
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
  severity: {
    type: String,
    required: false,
    default: 'Normal',
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
  recommendation: {
    type: String,
    required: false,
    default: '',
  },
  deviceId: {
    type: String,
    required: false,
    index: true,
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
