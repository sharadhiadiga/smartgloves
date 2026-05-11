const express = require('express');
const router = express.Router();
const SmartGlove = require('../models/SmartGlove');
const { predictHealth } = require('../services/mlService');

let history = [];

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getSeverityFromStress(stress) {
  if (stress >= 80) return 'Critical';
  if (stress >= 60) return 'High';
  if (stress >= 35) return 'Moderate';
  return 'Low';
}

function buildDynamicAnalysis({ temperature, heartRate, spo2, gsr }) {
  const issues = [];
  const measures = [];
  let stress = 0;

  if (temperature >= 39.5 || temperature <= 35) {
    stress += 30;
    issues.push(`Temperature is critical at ${temperature}°C.`);
    measures.push('Seek urgent medical evaluation and monitor temperature every 5 minutes.');
  } else if (temperature >= 38 || temperature < 36) {
    stress += 18;
    issues.push(`Temperature is out of normal range at ${temperature}°C.`);
    measures.push('Hydrate, rest, and recheck temperature soon.');
  }

  if (heartRate >= 140 || heartRate <= 45) {
    stress += 30;
    issues.push(`Heart rate is critical at ${heartRate} bpm.`);
    measures.push('Stop activity immediately and seek emergency guidance if symptoms persist.');
  } else if (heartRate >= 115 || heartRate < 55) {
    stress += 18;
    issues.push(`Heart rate is abnormal at ${heartRate} bpm.`);
    measures.push('Sit down, breathe slowly, and continue close pulse monitoring.');
  }

  if (spo2 < 88) {
    stress += 35;
    issues.push(`SpO2 is critically low at ${spo2}%.`);
    measures.push('Check sensor placement and seek immediate respiratory support.');
  } else if (spo2 < 94) {
    stress += 20;
    issues.push(`SpO2 is below ideal at ${spo2}%.`);
    measures.push('Perform deep breathing and retest oxygen saturation.');
  }

  if (gsr >= 2400) {
    stress += 20;
    issues.push(`GSR suggests very high stress at ${gsr}.`);
    measures.push('Start guided calming exercises and reduce physical load.');
  } else if (gsr >= 1700) {
    stress += 10;
    issues.push(`GSR suggests elevated stress at ${gsr}.`);
    measures.push('Take a short recovery break and hydrate.');
  }

  const boundedStress = Math.max(0, Math.min(100, stress));
  const severity = getSeverityFromStress(boundedStress);
  const status = severity;

  const recommendation = severity === 'Critical'
    ? 'Immediate clinical attention recommended.'
    : severity === 'High'
      ? 'Close monitoring required with rapid follow-up checks.'
      : severity === 'Moderate'
        ? 'Continue monitoring and repeat readings in short intervals.'
        : 'Vitals are stable. Continue routine monitoring.';

  return {
    level: severity,
    status,
    stress: boundedStress,
    issues: issues.length > 0 ? issues : ['Vitals currently within expected range.'],
    measures: measures.length > 0 ? measures : ['Continue periodic monitoring.'],
    recommendation,
  };
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
  console.log('[API INPUT]', req.body);
  console.log('[DATA][INCOMING]', req.body);

  const {
    temperature: rawTemperature,
    heartRate: rawHeartRate,
    spo2: rawSpo2,
    gsr: rawGsr,
    deviceId,
    id,
    patientId,
    name,
  } = req.body;
  const temperature = toFiniteNumber(rawTemperature);
  const heartRate = toFiniteNumber(rawHeartRate);
  const spo2 = toFiniteNumber(rawSpo2);
  const gsr = toFiniteNumber(rawGsr);
  const sensorData = { temperature, heartRate, spo2, gsr };
  const resolvedPatientId = String(patientId || id || deviceId || '').trim();

  const { valid, missing } = validateSensorData(sensorData);
  if (!resolvedPatientId) {
    console.error('[DATA][VALIDATION] Missing patient identifier');
    return res.status(400).json({ error: 'patientId/id/deviceId is required' });
  }
  if (!valid || Object.values(sensorData).some((value) => value === null)) {
    console.error('[DATA][VALIDATION] Invalid input data:', missing);
    return res.status(400).json({
      error: 'Invalid sensor payload',
      missing,
      required: ['patientId/id/deviceId', 'temperature', 'heartRate', 'spo2', 'gsr'],
    });
  }

  let mlPrediction = buildDynamicAnalysis(sensorData);
  let mlSource = 'dynamic-fallback';

  try {
    const prediction = await predictHealth(sensorData);
    if (prediction && typeof prediction === 'object') {
      mlPrediction = {
        ...mlPrediction,
        ...prediction,
        stress: Number.isFinite(prediction?.stress) ? Number(prediction.stress) : mlPrediction.stress,
        issues:
          Array.isArray(prediction?.issues) && prediction.issues.length > 0
            ? prediction.issues
            : mlPrediction.issues,
        measures:
          Array.isArray(prediction?.measures) && prediction.measures.length > 0
            ? prediction.measures
            : mlPrediction.measures,
        recommendation:
          typeof prediction?.recommendation === 'string' && prediction.recommendation.trim().length > 0
            ? prediction.recommendation.trim()
            : mlPrediction.recommendation,
      };
      mlSource = 'ml-service';
    } else {
      console.warn('[DATA][ML] Using dynamic heuristic — ML service unavailable or invalid response');
    }
  } catch (mlError) {
    console.error('[DATA][ML_ERROR]', mlError?.message || mlError);
  }

  const level = String(mlPrediction?.level || mlPrediction?.status || 'Low');
  const status = level;
  const severity = ['Critical', 'High', 'Moderate', 'Low'].includes(level)
    ? level
    : getSeverityFromStress(mlPrediction.stress || 0);

  const result = {
    patientId: resolvedPatientId,
    name: typeof name === 'string' && name.trim().length > 0 ? name.trim() : undefined,
    temperature,
    heartRate,
    spo2,
    gsr,
    status,
    severity,
    predictionLevel: level,
    stress: Number.isFinite(mlPrediction?.stress) ? mlPrediction.stress : 0,
    issues: Array.isArray(mlPrediction?.issues) ? mlPrediction.issues : [],
    measures: Array.isArray(mlPrediction?.measures) ? mlPrediction.measures : [],
    recommendation: typeof mlPrediction?.recommendation === 'string' ? mlPrediction.recommendation : 'ML unavailable',
    deviceId,
    timestamp: new Date(),
  };

  console.log('[DATA][ML_RESULT]', { mlSource, prediction: mlPrediction });
  console.log('[ML RESPONSE]', mlPrediction);

  try {
    const savedEntry = await SmartGlove.create(result);
    console.log('[DB SAVED]', savedEntry);
    console.log('[DATA][MONGODB_SAVE]', JSON.stringify({ id: String(savedEntry._id), patientId: savedEntry.patientId }));
    history.push(savedEntry);
    const responsePayload = { message: 'Data stored', prediction: mlPrediction, data: savedEntry, source: mlSource };
    console.log('[DATA][API_RESPONSE]', JSON.stringify({ source: mlSource, patientId: resolvedPatientId, severity }));
    return res.json(responsePayload);
  } catch (dbError) {
    console.error('[DATA][MONGODB_SAVE_ERROR]', dbError);

    history.push(result);
    return res.json({
      message: 'Data stored in fallback memory',
      prediction: mlPrediction,
      data: result,
      source: mlSource,
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
    console.log('[DATA][HISTORY] records:', records.length);
    res.json(records);
  } catch (error) {
    console.error('[DATA HISTORY ERROR]', error);
    res.json(history.slice(-50));
  }
});

// GET /api/all-patients
router.get('/all-patients', async (req, res) => {
  console.log('[DATA][ALL_PATIENTS][REQUEST]', req.ip, req.headers['user-agent'] || '');
  try {
    const records = await SmartGlove.find().sort({ timestamp: -1 }).limit(500).lean();
    const latestByPatient = new Map();

    for (const record of records) {
      const key = String(record.patientId || record.deviceId || record._id);
      if (!latestByPatient.has(key)) {
        latestByPatient.set(key, record);
      }
    }

    const patients = Array.from(latestByPatient.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    console.log('[DATA][ALL_PATIENTS][RESPONSE] count=', patients.length);
    return res.json({ patients });
  } catch (error) {
    console.error('[DATA][ALL_PATIENTS_ERROR]', error);
    const fallback = [...history]
      .reverse()
      .reduce((acc, item, index) => {
        const key = String(item.patientId || item.deviceId || item._id || `fallback-${index}`);
        if (!acc.some((entry) => String(entry.patientId || entry.deviceId || entry._id) === key)) {
          acc.push(item);
        }
        return acc;
      }, [])
      .slice(0, 100);
    return res.json({ patients: fallback });
  }
});

module.exports = router;