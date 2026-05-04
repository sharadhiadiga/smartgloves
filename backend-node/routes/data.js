const express = require('express');
const router = express.Router();

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
router.post('/data', (req, res) => {
  try {
    const { temperature, heartRate, spo2, gsr } = req.body;

    const status = analyzeStatus({ heartRate, spo2 });

    const result = {
      temperature,
      heartRate,
      spo2,
      gsr,
      status,
      timestamp: new Date(),
    };

    history.push(result);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/latest
router.get('/latest', (req, res) => {
  if (history.length === 0) {
    return res.json({ message: 'No data yet' });
  }

  res.json(history[history.length - 1]);
});

// GET /api/history
router.get('/history', (req, res) => {
  res.json(history.slice(-50));
});

module.exports = router;