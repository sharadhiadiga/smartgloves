const express = require('express');
const Doctor = require('../models/Doctor');

const router = express.Router();

// POST /api/save-token
router.post('/save-token', async (req, res) => {
  const { userId, token } = req.body;

  console.log('[TOKEN] save-token request', { userId: userId ? String(userId) : null, hasToken: Boolean(token) });

  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    return res.status(400).json({ error: 'userId is required' });
  }
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return res.status(400).json({ error: 'token is required' });
  }

  try {
    const doctor = await Doctor.findOneAndUpdate(
      { userId: userId.trim() },
      { pushToken: token.trim() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('[TOKEN] Saved push token for doctor', doctor.userId);
    return res.json({
      message: 'Push token saved',
      userId: doctor.userId,
    });
  } catch (error) {
    console.error('[TOKEN] save-token error', error);
    return res.status(500).json({ error: 'Failed to save push token' });
  }
});

module.exports = router;
