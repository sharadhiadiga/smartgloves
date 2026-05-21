const SmartGlove = require('../models/SmartGlove');
const { predictHealth } = require('./mlService');
const { runRiskPipeline } = require('./riskPipeline');
const { normalizeVitalsRecord } = require('./vitalConditions');
const { broadcastVitalsUpdate, broadcastAlert } = require('./socketHub');
const { handlePatientStatusUpdate } = require('./patientMonitor');
const { sendPushNotification } = require('./pushService');
const Doctor = require('../models/Doctor');

const DOCTOR_USER_ID = process.env.DOCTOR_USER_ID || 'doctor1';
const FORCE_CRITICAL = process.env.FORCE_CRITICAL_FOR_TESTING === 'true';

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function validateVitalsPayload(body) {
  const errors = [];
  const patientId = String(body.patientId || body.id || '').trim();
  if (!patientId) errors.push('patientId is required');

  const temperature = toFiniteNumber(body.temperature);
  const heartRate = toFiniteNumber(body.heartRate);
  const spo2 = toFiniteNumber(body.spo2);
  const gsr = toFiniteNumber(body.gsr);

  if (temperature === null) errors.push('temperature must be a number');
  if (heartRate === null) errors.push('heartRate must be a number');
  if (spo2 === null) errors.push('spo2 must be a number');
  if (gsr === null) errors.push('gsr must be a number');

  return {
    valid: errors.length === 0,
    errors,
    parsed: {
      patientId,
      deviceId: String(body.deviceId || 'ESP32_001').trim(),
      temperature,
      heartRate,
      spo2,
      gsr,
      temperatureCondition: body.temperatureCondition,
      heartRateCondition: body.heartRateCondition,
      spo2Condition: body.spo2Condition,
      gsrCondition: body.gsrCondition,
      name: typeof body.name === 'string' ? body.name.trim() : undefined,
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
    },
  };
}

async function ingestVitals(body) {
  console.log('[Vitals] Ingest:', JSON.stringify(body));

  const { valid, errors, parsed } = validateVitalsPayload(body);
  if (!valid) {
    const err = new Error('Validation failed');
    err.status = 400;
    err.details = errors;
    throw err;
  }

  let mlPrediction = null;
  try {
    mlPrediction = await predictHealth({
      temperature: parsed.temperature,
      heartRate: parsed.heartRate,
      spo2: parsed.spo2,
      gsr: parsed.gsr,
    });
  } catch (mlErr) {
    console.error('[Vitals] ML error:', mlErr?.message || mlErr);
  }

  const risk = runRiskPipeline(
    {
      temperature: parsed.temperature,
      heartRate: parsed.heartRate,
      spo2: parsed.spo2,
      gsr: parsed.gsr,
      temperatureCondition: parsed.temperatureCondition,
      heartRateCondition: parsed.heartRateCondition,
      spo2Condition: parsed.spo2Condition,
      gsrCondition: parsed.gsrCondition,
    },
    mlPrediction
  );

  let overallRiskLevel = risk.overallRiskLevel;
  if (FORCE_CRITICAL) {
    overallRiskLevel = 'Critical';
    console.log('[Vitals] FORCE_CRITICAL_FOR_TESTING=true');
  }

  const record = normalizeVitalsRecord({
    patientId: parsed.patientId,
    name: parsed.name || parsed.patientId,
    deviceId: parsed.deviceId,
    temperature: parsed.temperature,
    heartRate: parsed.heartRate,
    spo2: parsed.spo2,
    gsr: parsed.gsr,
    temperatureCondition: risk.temperatureCondition,
    heartRateCondition: risk.heartRateCondition,
    spo2Condition: risk.spo2Condition,
    gsrCondition: risk.gsrCondition,
    overallRiskLevel,
    status: overallRiskLevel,
    severity: overallRiskLevel,
    stress: risk.stress,
    issues: risk.issues,
    measures: risk.measures,
    recommendation: risk.recommendation,
    predictionLevel: mlPrediction?.predictionLevel || overallRiskLevel,
    timestamp: parsed.timestamp,
  });

  let saved;
  try {
    saved = await SmartGlove.create(record);
    console.log('[Vitals] Saved MongoDB id:', saved._id);
  } catch (dbErr) {
    console.error('[Vitals] MongoDB save failed:', dbErr?.message);
    saved = { ...record, _id: `mem-${Date.now()}` };
  }

  const payload = normalizeVitalsRecord({
    ...record,
    id: String(saved._id),
    timestamp: saved.timestamp || record.timestamp,
  });

  broadcastVitalsUpdate(payload);

  if (overallRiskLevel === 'Critical' || overallRiskLevel === 'High') {
    broadcastAlert({
      patientId: payload.patientId,
      name: payload.name,
      overallRiskLevel,
      message: `${payload.name} (${payload.patientId}) — ${overallRiskLevel} risk`,
      timestamp: payload.timestamp,
      vitals: {
        temperature: payload.temperature,
        heartRate: payload.heartRate,
        spo2: payload.spo2,
        gsr: payload.gsr,
      },
    });

    if (overallRiskLevel === 'Critical') {
      try {
        const user = await Doctor.findOne({ userId: DOCTOR_USER_ID });
        if (user?.pushToken) {
          await sendPushNotification(
            { patientId: payload.patientId, name: payload.name },
            user.pushToken
          );
        }
      } catch (pushErr) {
        console.error('[Vitals] Push failed:', pushErr?.message);
      }
    }
  }

  try {
    await handlePatientStatusUpdate({
      patientId: payload.patientId,
      name: payload.name,
      currentStatus: overallRiskLevel,
    });
  } catch (monErr) {
    console.error('[Vitals] Monitor hook:', monErr?.message);
  }

  return { success: true, data: payload };
}

async function getLatestByPatientId(patientId) {
  const doc = await SmartGlove.findOne({ patientId: String(patientId) })
    .sort({ timestamp: -1 })
    .lean();
  return doc ? normalizeVitalsRecord(doc) : doc;
}

async function getDashboardData() {
  const records = await SmartGlove.find().sort({ timestamp: -1 }).limit(500).lean();
  const latestByPatient = new Map();

  for (const r of records) {
    const key = `${r.patientId}:${r.deviceId || 'default'}`;
    if (!latestByPatient.has(key)) {
      latestByPatient.set(key, r);
    }
  }

  const patients = Array.from(latestByPatient.values())
    .map(normalizeVitalsRecord)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const alerts = patients.filter(
    (p) => p.overallRiskLevel === 'Critical' || p.overallRiskLevel === 'High' || p.severity === 'Critical' || p.severity === 'High'
  );

  return {
    updatedAt: new Date().toISOString(),
    patientCount: patients.length,
    alertCount: alerts.length,
    patients,
    alerts,
  };
}

async function getAlerts() {
  const dashboard = await getDashboardData();
  return {
    updatedAt: dashboard.updatedAt,
    count: dashboard.alerts.length,
    alerts: dashboard.alerts,
  };
}

module.exports = {
  ingestVitals,
  validateVitalsPayload,
  getLatestByPatientId,
  getDashboardData,
  getAlerts,
};
