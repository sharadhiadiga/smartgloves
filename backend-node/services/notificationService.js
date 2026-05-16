const axios = require('axios');
const Doctor = require('../models/Doctor');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

function normalizeStatusKey(status) {
  return String(status || '')
    .trim()
    .toUpperCase();
}

function isWithinCooldown(lastAlertTime) {
  if (!lastAlertTime) {
    return false;
  }
  const elapsed = Date.now() - new Date(lastAlertTime).getTime();
  return elapsed < ALERT_COOLDOWN_MS;
}

/**
 * Send Expo push notification to a doctor when a patient is critical.
 */
async function sendNotification(patient, doctor) {
  if (!doctor?.pushToken) {
    console.log('[NOTIFY] Skipped — doctor has no pushToken', doctor?.userId || doctor?._id);
    return { sent: false, reason: 'no_push_token' };
  }

  const patientId = patient.patientId || patient._id;
  const patientName = patient.name || patientId;

  const payload = {
    to: doctor.pushToken,
    sound: 'default',
    title: '🚨 Critical Alert',
    body: `Patient ${patientName} (ID: ${patientId}) is CRITICAL`,
    data: {
      patientId: String(patientId),
      status: 'CRITICAL',
    },
  };

  console.log('[NOTIFY] Sending Expo push to doctor', doctor.userId || doctor._id, payload);

  try {
    const response = await axios.post(EXPO_PUSH_URL, payload, {
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    console.log('[NOTIFY] Expo response:', JSON.stringify(response.data));
    return { sent: true, data: response.data };
  } catch (error) {
    console.error('[NOTIFY] Expo push failed:', error?.message || error);
    if (error.response) {
      console.error('[NOTIFY] Expo error body:', JSON.stringify(error.response.data));
    }
    return { sent: false, reason: 'expo_error', error: error?.message };
  }
}

/**
 * Notify all doctors that have registered a push token.
 */
async function notifyDoctors(patient) {
  const doctors = await Doctor.find({
    pushToken: { $exists: true, $nin: [null, ''] },
  }).lean();

  if (doctors.length === 0) {
    console.log('[NOTIFY] No doctors with push tokens registered');
    return [];
  }

  const results = [];
  for (const doctor of doctors) {
    const result = await sendNotification(patient, doctor);
    results.push({ doctorId: doctor.userId, ...result });
  }
  return results;
}

module.exports = {
  sendNotification,
  notifyDoctors,
  normalizeStatusKey,
  isWithinCooldown,
  ALERT_COOLDOWN_MS,
};
