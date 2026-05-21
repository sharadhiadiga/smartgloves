const express = require('express');
const router = express.Router();
const SmartGlove = require('../models/SmartGlove');
const Doctor = require('../models/Doctor');
const { predictHealth } = require('../services/mlService');
const { handlePatientStatusUpdate } = require('../services/patientMonitor');
const { sendPushNotification } = require('../services/pushService');
const {
  tempCondition,
  hrCondition,
  spo2Condition,
  gsrCondition,
  computeVitalConditions,
} = require('../services/vitalConditions');

const DOCTOR_USER_ID = process.env.DOCTOR_USER_ID || 'doctor1';
/** Set FORCE_CRITICAL_FOR_TESTING=false to use real ML severity */
const FORCE_CRITICAL_FOR_TESTING = process.env.FORCE_CRITICAL_FOR_TESTING !== 'false';

function normalizeStatusUpper(status) {
  return String(status || '').trim().toUpperCase();
}

function isCriticalStatus(status) {
  return normalizeStatusUpper(status) === 'CRITICAL';
}

const SEVERITY_RANK = { Critical: 4, High: 3, Moderate: 2, Low: 1, Unknown: 0 };

function severityFromConditionLabel(condition) {
  const c = String(condition || '').trim().toLowerCase();
  if (c === 'critical') return 'Critical';
  if (c === 'high') return 'High';
  if (c === 'moderate') return 'Moderate';
  if (c === 'low' || c === 'normal') return 'Low';
  if (c === 'invalid') return 'Unknown';
  return null;
}

function worstSeverity(...labels) {
  let best = 'Low';
  let bestRank = SEVERITY_RANK.Low;
  for (const label of labels) {
    if (!label) continue;
    const rank = SEVERITY_RANK[label] ?? 0;
    if (rank > bestRank) {
      bestRank = rank;
      best = label;
    }
  }
  return best;
}

function isAnyEsp32ConditionCritical(conditions) {
  return conditions.some((c) => String(c || '').trim().toLowerCase() === 'critical');
}

let history = [];

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function stressFromSeverity(severity) {
  switch (severity) {
    case 'Critical':
      return 90;
    case 'High':
      return 70;
    case 'Moderate':
      return 50;
    case 'Unknown':
      return 0;
    default:
      return 20;
  }
}

function issuesAndMeasuresFromConditions(conditions, vitals) {
  const issues = [];
  const measures = [];
  const { temperature, heartRate, spo2, gsr } = vitals;
  const { temperatureCondition, heartRateCondition, spo2Condition, gsrCondition } = conditions;

  if (temperatureCondition === 'Critical') {
    issues.push(`Temperature is critical at ${temperature}°C.`);
    measures.push('Seek urgent medical evaluation and monitor temperature every 5 minutes.');
  } else if (temperatureCondition === 'High' || temperatureCondition === 'Moderate') {
    issues.push(`Temperature is out of normal range at ${temperature}°C (${temperatureCondition}).`);
    measures.push('Hydrate, rest, and recheck temperature soon.');
  }

  if (heartRateCondition === 'Critical') {
    issues.push(`Heart rate is critical at ${heartRate} bpm.`);
    measures.push('Stop activity immediately and seek emergency guidance if symptoms persist.');
  } else if (heartRateCondition === 'High' || heartRateCondition === 'Moderate') {
    issues.push(`Heart rate is abnormal at ${heartRate} bpm (${heartRateCondition}).`);
    measures.push('Sit down, breathe slowly, and continue close pulse monitoring.');
  }

  if (spo2Condition === 'Critical') {
    issues.push(`SpO2 is critically low at ${spo2}%.`);
    measures.push('Check sensor placement and seek immediate respiratory support.');
  } else if (spo2Condition === 'High' || spo2Condition === 'Moderate') {
    issues.push(`SpO2 is below ideal at ${spo2}% (${spo2Condition}).`);
    measures.push('Perform deep breathing and retest oxygen saturation.');
  }

  if (gsrCondition === 'Critical' || gsrCondition === 'High') {
    issues.push(`GSR suggests elevated stress at ${gsr} (${gsrCondition}).`);
    measures.push('Start guided calming exercises and reduce physical load.');
  } else if (gsrCondition === 'Moderate') {
    issues.push(`GSR suggests moderate stress at ${gsr}.`);
    measures.push('Take a short recovery break and hydrate.');
  }

  return {
    issues: issues.length > 0 ? issues : ['Vitals currently within expected range.'],
    measures: measures.length > 0 ? measures : ['Continue periodic monitoring.'],
  };
}

function severityFromVitals(vitals) {
  const conditions = computeVitalConditions(vitals);
  const severity = worstSeverity(
    severityFromConditionLabel(conditions.temperatureCondition),
    severityFromConditionLabel(conditions.heartRateCondition),
    severityFromConditionLabel(conditions.spo2Condition),
    severityFromConditionLabel(conditions.gsrCondition),
    'Low'
  );
  return { conditions, severity };
}

function buildDynamicAnalysis(sensorData) {
  const { conditions, severity } = severityFromVitals(sensorData);
  const { issues, measures } = issuesAndMeasuresFromConditions(conditions, sensorData);
  const stress = stressFromSeverity(severity);

  const recommendation = severity === 'Critical'
    ? 'Immediate clinical attention recommended.'
    : severity === 'High'
      ? 'Close monitoring required with rapid follow-up checks.'
      : severity === 'Moderate'
        ? 'Continue monitoring and repeat readings in short intervals.'
        : 'Vitals are stable. Continue routine monitoring.';

  return {
    level: severity,
    status: severity,
    stress,
    ...conditions,
    issues,
    measures,
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
  console.log('📥 Incoming data:', req.body);
  console.log('[API INPUT]', req.body);
  console.log('[DATA][INCOMING]', req.body);

  const {
    temperature: rawTemperature,
    heartRate: rawHeartRate,
    spo2: rawSpo2,
    gsr: rawGsr,
    temperatureCondition,
    heartRateCondition,
    spo2Condition,
    gsrCondition,
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

  const { conditions: computedConditions, severity: conditionSeverity } = severityFromVitals(sensorData);

  const level = String(mlPrediction?.level || mlPrediction?.status || 'Low');
  const mlStress = Number.isFinite(mlPrediction?.stress) ? mlPrediction.stress : 0;
  const mlSeverity = ['Critical', 'High', 'Moderate', 'Low', 'Unknown'].includes(level)
    ? level
    : mlStress >= 80
      ? 'Critical'
      : mlStress >= 60
        ? 'High'
        : mlStress >= 35
          ? 'Moderate'
          : 'Low';

  const severity = worstSeverity(conditionSeverity, mlSeverity);
  const vitalConditions = computedConditions;

  const mlStatus = normalizeStatusUpper(severity);
  console.log('🧠 ML STATUS:', mlStatus);
  console.log('[DATA][VITAL_CONDITIONS]', vitalConditions);
  console.log('[DATA][SEVERITY]', { conditionSeverity, mlSeverity, severity });

  let status = mlStatus;
  if (FORCE_CRITICAL_FOR_TESTING) {
    status = 'CRITICAL';
    console.log('⚠️ FORCE_CRITICAL_FOR_TESTING enabled — effective status:', status);
  } else if (isCriticalStatus(mlStatus) || isAnyEsp32ConditionCritical(Object.values(vitalConditions))) {
    status = 'CRITICAL';
  }

  const result = {
    patientId: resolvedPatientId,
    name: typeof name === 'string' && name.trim().length > 0 ? name.trim() : undefined,
    temperature,
    heartRate,
    spo2,
    gsr,
    temperatureCondition: vitalConditions.temperatureCondition,
    heartRateCondition: vitalConditions.heartRateCondition,
    spo2Condition: vitalConditions.spo2Condition,
    gsrCondition: vitalConditions.gsrCondition,
    status: severity,
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

  let pushResult = null;

  try {
    const savedEntry = await SmartGlove.create(result);
    console.log('[DB SAVED]', savedEntry);
    console.log('[DATA][MONGODB_SAVE]', JSON.stringify({ id: String(savedEntry._id), patientId: savedEntry.patientId }));

    if (isCriticalStatus(status)) {
      console.log('🚨 CRITICAL DETECTED');

      try {
        const user = await Doctor.findOne({ userId: DOCTOR_USER_ID });

        if (!user || !user.pushToken) {
          console.log('❌ No push token found for userId:', DOCTOR_USER_ID);
        } else {
          console.log('✅ Found token:', user.pushToken);

          pushResult = await sendPushNotification(
            {
              patientId: resolvedPatientId,
              name: result.name || resolvedPatientId,
            },
            user.pushToken
          );
        }
      } catch (pushError) {
        console.error('❌ PUSH ERROR:', pushError?.message || pushError);
        if (pushError.response) {
          console.error('❌ PUSH ERROR BODY:', JSON.stringify(pushError.response.data));
        }
      }
    } else {
      console.log('[PUSH] Skipped — status is not CRITICAL:', status);
    }

    try {
      const monitorResult = await handlePatientStatusUpdate({
        patientId: resolvedPatientId,
        name: result.name,
        currentStatus: severity,
      });
      console.log('[DATA][MONITOR]', monitorResult);
    } catch (monitorError) {
      console.error('[DATA][MONITOR_ERROR]', monitorError?.message || monitorError);
    }

    history.push(savedEntry);
    const responsePayload = {
      success: true,
      status,
      mlStatus,
      message: 'Data stored',
      prediction: mlPrediction,
      data: savedEntry,
      source: mlSource,
      push: pushResult,
    };
    console.log('[DATA][API_RESPONSE]', JSON.stringify({ success: true, status, patientId: resolvedPatientId }));
    return res.json(responsePayload);
  } catch (dbError) {
    console.error('[DATA][MONGODB_SAVE_ERROR]', dbError);

    if (isCriticalStatus(status)) {
      console.log('🚨 CRITICAL DETECTED (DB fallback path)');
      try {
        const user = await Doctor.findOne({ userId: DOCTOR_USER_ID });
        if (user?.pushToken) {
          console.log('✅ Found token:', user.pushToken);
          pushResult = await sendPushNotification(
            { patientId: resolvedPatientId, name: result.name || resolvedPatientId },
            user.pushToken
          );
        } else {
          console.log('❌ No push token found');
        }
      } catch (pushError) {
        console.error('❌ PUSH ERROR:', pushError?.message || pushError);
      }
    }

    history.push(result);
    return res.json({
      success: true,
      status,
      mlStatus,
      message: 'Data stored in fallback memory',
      prediction: mlPrediction,
      data: result,
      source: mlSource,
      push: pushResult,
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

async function getAllPatientsHandler(req, res) {
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
}

// GET /api/patients — latest record per patient (mobile app)
router.get('/patients', getAllPatientsHandler);

// GET /api/all-patients — alias
router.get('/all-patients', getAllPatientsHandler);

module.exports = router;