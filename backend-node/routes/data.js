const express = require('express');
const router = express.Router();

const { predictHealth } = require('../services/mlService');

let history = [];

// POST /api/data
router.post('/data', async (req, res) => {
  try {
    const data = req.body;

    let status = "Unknown";

    try {
      status = await predictHealth(data);
    } catch {}

    const result = {
      ...data,
      status,
      timestamp: new Date()
    };

    history.push(result);

    res.json(result);

  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/latest
router.get('/latest', (req, res) => {
  if (history.length === 0) {
    return res.json({ message: "No data yet" });
  }

  res.json(history[history.length - 1]);
});

// GET /api/history
router.get('/history', (req, res) => {
  res.json(history.slice(-50));
});

module.exports = router;