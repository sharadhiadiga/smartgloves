const express = require('express');
const Doctor = require('../models/Doctor');

const router = express.Router();

// POST /api/save-token
router.post('/save-token', async (req, res) => {
  try {
    console.log('Incoming token:', req.body);

    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ error: 'userId and token required' });
    }

    const user = await Doctor.findOneAndUpdate(
      { userId },
      { pushToken: token },
      { upsert: true, new: true }
    );

    console.log('✅ Token saved:', userId, token);

    res.json({ success: true, user });
  } catch (err) {
    console.error('❌ Save token error:', err);
    res.status(500).json({ error: 'Failed to save token' });
  }
});

module.exports = router;
