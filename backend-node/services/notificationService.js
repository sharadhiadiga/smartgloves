const axios = require('axios');
const Doctor = require('../models/Doctor');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;
const ANDROID_CHANNEL_ID = 'default';

function normalizeStatusKey(status) {
  return String(status || '').trim().toUpperCase();
}

function isWithinCooldown(lastAlertTime) {
  if (!lastAlertTime) return false;
  const elapsed = Date.now() - new Date(lastAlertTime).getTime();
  return elapsed < ALERT_COOLDOWN_MS;
}

/**
 * Send remote push via Expo Push API (delivers when app is closed/background).
 */
async function sendPushNotification(patient, doctor) {
  if (!doctor?.pushToken) {
    console.log('[PUSH] Skipped — no pushToken for doctor', doctor?.userId);
    return { sent: false, reason: 'no_push_token' };
  }

  const patientId = String(patient.patientId || patient.id || patient._id || '');
  const patientName = patient.name || patientId;

  const message = {
    to: doctor.pushToken,
    sound: 'default',
    title: '🚨 Critical Alert',
    body: `Patient ${patientName} (ID: ${patientId}) is CRITICAL`,
    priority: 'high',
    channelId: ANDROID_CHANNEL_ID,
    data: {
      screen: 'Dashboard',
      patientId,
      status: 'CRITICAL',
    },
  };

  console.log('[PUSH] Sending to Expo API for doctor', doctor.userId);

  try {
    const response = await axios.post(EXPO_PUSH_URL, message, {
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    console.log('Push response:', JSON.stringify(response.data));

    const ticket = response.data?.data?.[0];
    if (ticket?.status === 'error') {
      console.error('[PUSH] Expo ticket error:', ticket.message, ticket.details);
      return { sent: false, reason: 'expo_ticket_error', error: ticket.message };
    }

    return { sent: true, data: response.data };
  } catch (error) {
    console.error('[PUSH] Expo push failed:', error?.message || error);
    if (error.response) {
      console.error('[PUSH] Expo error body:', JSON.stringify(error.response.data));
    }
    return { sent: false, reason: 'expo_error', error: error?.message };
  }
}

/** Notify every doctor that registered an Expo push token. */
async function notifyDoctors(patient) {
  const doctors = await Doctor.find({
    pushToken: { $exists: true, $nin: [null, ''] },
  }).lean();

  if (doctors.length === 0) {
    console.log('[PUSH] No doctors with push tokens — open app on device to register');
    return [];
  }

  const results = [];
  for (const doctor of doctors) {
    const result = await sendPushNotification(patient, doctor);
    results.push({ doctorId: doctor.userId, ...result });
  }
  return results;
}

module.exports = {
  sendPushNotification,
  sendNotification: sendPushNotification,
  notifyDoctors,
  normalizeStatusKey,
  isWithinCooldown,
  ALERT_COOLDOWN_MS,
};
