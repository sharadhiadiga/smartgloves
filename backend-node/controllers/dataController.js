// controllers/dataController.js
const Health = require('../models/Health');
const { getPredictionStatus } = require('../services/mlService');

const validateEntry = (data) => {
  const errors = [];

  if (data.temperature === undefined || typeof data.temperature !== 'number') {
    errors.push('temperature must be a number');
  } else if (data.temperature < 30 || data.temperature > 45) {
    errors.push('temperature must be between 30 and 45');
  }

  if (data.heartRate === undefined || typeof data.heartRate !== 'number') {
    errors.push('heartRate must be a number');
  } else if (data.heartRate < 40 || data.heartRate > 150) {
    errors.push('heartRate must be between 40 and 150');
  }

  if (data.spo2 === undefined || typeof data.spo2 !== 'number') {
    errors.push('spo2 must be a number');
  } else if (data.spo2 < 80 || data.spo2 > 100) {
    errors.push('spo2 must be between 80 and 100');
  }

  if (data.gsr === undefined || typeof data.gsr !== 'number') {
    errors.push('gsr must be a number');
  } else if (data.gsr < 0 || data.gsr > 5000) {
    errors.push('gsr must be between 0 and 5000');
  }

  return errors;
};

const createDataEntry = async (req, res, next) => {
  try {
    const { temperature, heartRate, spo2, gsr } = req.body;
    const payload = { temperature, heartRate, spo2, gsr };

    const validationErrors = validateEntry(payload);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors,
      });
    }

    const status = await getPredictionStatus(payload);
    const healthRecord = new Health({
      temperature,
      heartRate,
      spo2,
      gsr,
      status,
    });

    const savedRecord = await healthRecord.save();
    return res.status(201).json({
      success: true,
      data: savedRecord,
    });
  } catch (error) {
    next(error);
  }
};

const getLatestEntry = async (req, res, next) => {
  try {
    const latestRecord = await Health.findOne().sort({ timestamp: -1 }).lean();

    if (!latestRecord) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'No records found',
      });
    }

    return res.status(200).json({
      success: true,
      data: latestRecord,
    });
  } catch (error) {
    next(error);
  }
};

const getHistoryEntries = async (req, res, next) => {
  try {
    const entries = await Health.find()
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    if (entries.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
        message: 'No history records found',
      });
    }

    return res.status(200).json({
      success: true,
      count: entries.length,
      data: entries,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDataEntry,
  getLatestEntry,
  getHistoryEntries,
};
