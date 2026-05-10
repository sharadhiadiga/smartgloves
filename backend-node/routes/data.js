const express = require('express');
const router = express.Router();
const SmartGlove = require('../models/SmartGlove');
const { predictHealth } = require('../services/mlService');

let history = [];

function analyzeStatus({ heartRate, spo2 }) {
  // Start with a safe default
  let status = 'Normal';

  // Critical is the most severe alert
  if ((typeof heartRate === 'number' && heartRate > 120) || (typeof spo2 === 'number' && spo2 < 90)) {
    status = 'Critical';
  } else if ((typeof heartRate === 'number' && heartRate > 100) || (typeof spo2 === 'number' && spo2 < 95)) {
    status = 'Abnormal';
  }

  return status;
}

// POST /api/data
router.post('/data', async (req, res) => {
  try {
    const { temperature, heartRate, spo2, gsr, deviceId } = req.body;
    const mlPrediction = await predictHealth({ temperature, heartRate, spo2, gsr });
    const level = mlPrediction?.level || mlPrediction?.class || 'Unknown';

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
      deviceId,
      timestamp: new Date(),
    };

    const savedEntry = await SmartGlove.create(result);
    history.push(savedEntry);

    res.json(savedEntry);
  } catch (error) {
    console.error('[DATA POST ERROR]', error);

    const fallbackEntry = {
      ...req.body,
      status: analyzeStatus(req.body),
      predictionLevel: 'Unknown',
      stress: 0,
      issues: ['Saved in memory fallback'],
      measures: ['Verify MongoDB and ML service connectivity'],
      timestamp: new Date(),
    };

    history.push(fallbackEntry);
    res.status(500).json({
      error: 'Unable to save to MongoDB, data stored in memory fallback',
      fallback: fallbackEntry,
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