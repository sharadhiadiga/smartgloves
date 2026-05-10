const express = require('express');
const router = express.Router();
const SmartGlove = require('../models/SmartGlove');
const { predictHealth } = require('../services/mlService');

let history = [];

function analyzeStatus({ heartRate, spo2 }) {
  let status = 'Normal';

  if ((typeof heartRate === 'number' && heartRate > 120) || (typeof spo2 === 'number' && spo2 < 90)) {
    status = 'Critical';
  } else if ((typeof heartRate === 'number' && heartRate > 100) || (typeof spo2 === 'number' && spo2 < 95)) {
    status = 'Abnormal';
  }

  return status;
}

function validateSensorData(data) {
  const required = ['temperature', 'heartRate', 'spo2', 'gsr'];
  const missing = required.filter((field) => data[field] === undefined || data[field] === null || data[field] === '');
  return {
    valid: missing.length === 0,
    missing,
  };
}

// POST /api/data
router.post('/data', async (req, res) => {
  console.log('Incoming Data:', req.body);

  const { temperature, heartRate, spo2, gsr, deviceId } = req.body;
  const sensorData = { temperature, heartRate, spo2, gsr };

  const { valid, missing } = validateSensorData(sensorData);
  if (!valid) {
    console.error('Invalid input data:', missing);
  }

  let mlPrediction = {
    level: 'Unknown',
    status: 'Unknown',
    stress: 0,
    issues: ['Invalid or incomplete ML input data'],
    measures: ['Provide temperature, heartRate, spo2, and gsr values'],
    recommendation: 'ML unavailable',
  };

  try {
    if (valid) {
      mlPrediction = await predictHealth(sensorData);
    }
  } catch (mlError) {
    console.error('ML Error:', mlError?.message || mlError);
  }

  const level = mlPrediction?.level || mlPrediction?.status || 'Unknown';
  const status = level !== 'Unknown' ? level : analyzeStatus({ heartRate, spo2 });

  const result = {
    temperature,
    heartRate,
    spo2,
    gsr,
    status,
    predictionLevel: level,
    stress: Number.isFinite(mlPrediction?.stress) ? mlPrediction.stress : 0,
    issues: Array.isArray(mlPrediction?.issues) ? mlPrediction.issues : [],
    measures: Array.isArray(mlPrediction?.measures) ? mlPrediction.measures : [],
    recommendation: typeof mlPrediction?.recommendation === 'string' ? mlPrediction.recommendation : 'ML unavailable',
    deviceId,
    timestamp: new Date(),
  };

  console.log('Prediction:', mlPrediction);

  try {
    const savedEntry = await SmartGlove.create(result);
    history.push(savedEntry);
    return res.json({ message: 'Data stored', prediction: mlPrediction, data: savedEntry });
  } catch (dbError) {
    console.error('[DATA SAVE ERROR]', dbError);

    history.push(result);
    return res.json({
      message: 'Data stored in fallback memory',
      prediction: mlPrediction,
      data: result,
    });
  }
});

// GET /api/latest
router.get('/latest', async (req, res) => {
  try {
    const latest = await SmartGlove.findOne().sort({ timestamp: -1 }).lean();
    if (!latest) {
      return res.json({ message: 'No data yet', status: 'Waiting...' });
    }

    res.json(latest);
  } catch (error) {
    console.error('[DATA LATEST ERROR]', error);

    if (history.length === 0) {
      return res.json({ message: 'No data yet', status: 'Waiting...' });
    }

    res.json(history[history.length - 1]);
  }
});

// GET /api/history
router.get('/history', async (req, res) => {
  try {
    const records = await SmartGlove.find().sort({ timestamp: -1 }).limit(50).lean();
    res.json(records);
  } catch (error) {
    console.error('[DATA HISTORY ERROR]', error);
    res.json(history.slice(-50));
  }
});

module.exports = router;