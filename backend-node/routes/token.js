const express = require('express');
const mongoose = require('mongoose');
const Doctor = require('../models/Doctor');
const pushTokenStore = require('../services/pushTokenStore');

const router = express.Router();

// POST /api/save-token
router.post('/save-token', async (req, res) => {
  try {
    const { userId, token } = req.body;

    console.log('📥 Incoming token request:', req.body);

    if (!userId || !token) {
      return res.status(400).json({ error: 'userId and token required' });
    }

    const trimmedUserId = String(userId).trim();
    const trimmedToken = String(token).trim();

    // Always cache in memory (works even if MongoDB is down)
    pushTokenStore.setToken(trimmedUserId, trimmedToken);

    let user = null;
    const mongoConnected = mongoose.connection.readyState === 1;

    if (mongoConnected) {
      user = await Doctor.findOneAndUpdate(
        { userId: trimmedUserId },
        { pushToken: trimmedToken, userId: trimmedUserId },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log('✅ Token saved in DB:', user);
      console.log('✅ Token saved:', trimmedUserId, trimmedToken.slice(0, 40) + '...');
    } else {
      console.warn('⚠️ MongoDB not connected — token saved in memory only');
      console.log('✅ Token saved (memory only):', trimmedUserId);
    }

    res.json({
      success: true,
      mongoConnected,
      user,
      memorySaved: true,
    });
  } catch (err) {
    console.error('❌ Save-token error:', err);
    res.status(500).json({ error: 'Failed to save token' });
  }
});

// GET /api/push-status — debug token registration
router.get('/push-status', async (req, res) => {
  try {
    const mongoConnected = mongoose.connection.readyState === 1;
    let doctors = [];

    if (mongoConnected) {
      doctors = await Doctor.find({}, { userId: 1, pushToken: 1 }).lean();
    }

    const memory = pushTokenStore.getAllTokens();

    res.json({
      mongoConnected,
      memoryTokenUsers: Object.keys(memory),
      memoryTokenCount: Object.keys(memory).length,
      doctors: doctors.map((d) => ({
        userId: d.userId,
        hasToken: Boolean(d.pushToken),
        tokenPreview: d.pushToken ? `${d.pushToken.slice(0, 28)}...` : null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
