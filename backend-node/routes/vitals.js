const express = require('express');
const router = express.Router();
const vitalsService = require('../services/vitalsService');

/** POST /api/vitals — ESP32 HTTPS ingestion */
router.post('/vitals', async (req, res, next) => {
  try {
    const result = await vitalsService.ingestVitals(req.body);
    return res.status(201).json(result);
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ success: false, error: err.message, details: err.details });
    }
    next(err);
  }
});

/** Legacy ESP32/mobile path — same pipeline */
router.post('/data', async (req, res, next) => {
  try {
    const result = await vitalsService.ingestVitals(req.body);
    return res.status(201).json(result);
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ success: false, error: err.message, details: err.details });
    }
    next(err);
  }
});

/** GET /api/patient/latest/:patientId */
router.get('/patient/latest/:patientId', async (req, res, next) => {
  try {
    const doc = await vitalsService.getLatestByPatientId(req.params.patientId);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'No vitals for patient' });
    }
    return res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
});

/** GET /api/dashboard */
router.get('/dashboard', async (req, res, next) => {
  try {
    const data = await vitalsService.getDashboardData();
    return res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
});

/** GET /api/alerts */
router.get('/alerts', async (req, res, next) => {
  try {
    const data = await vitalsService.getAlerts();
    return res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
});

/** GET /api/patients — mobile compatibility */
router.get('/patients', async (req, res, next) => {
  try {
    const data = await vitalsService.getDashboardData();
    return res.json({ patients: data.patients });
  } catch (err) {
    next(err);
  }
});

router.get('/all-patients', async (req, res, next) => {
  try {
    const data = await vitalsService.getDashboardData();
    return res.json({ patients: data.patients });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
