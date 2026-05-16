const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    default: '',
  },
  lastStatus: {
    type: String,
    default: 'LOW',
  },
  lastAlertTime: {
    type: Date,
    default: null,
  },
}, {
  collection: 'patients',
  timestamps: true,
});

const Patient = mongoose.model('Patient', patientSchema);

module.exports = Patient;
