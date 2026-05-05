const express = require('express');
const router = express.Router();
const SmartGlove = require('../models/SmartGlove');

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

    const status = analyzeStatus({ heartRate, spo2 });

    const result = {
      temperature,
      heartRate,
      spo2,
      gsr,
      status,
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
      return res.json({ message: 'No data yet' });
    }

    res.json(latest);
  } catch (error) {
    console.error('[DATA LATEST ERROR]', error);

    if (history.length === 0) {
      return res.status(500).json({ error: 'Unable to retrieve latest entry' });
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