const axios = require('axios');
const mongoose = require('mongoose');
const Doctor = require('../models/Doctor');
const pushTokenStore = require('./pushTokenStore');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const ANDROID_CHANNEL_ID = 'default';
const DOCTOR_USER_ID = process.env.DOCTOR_USER_ID || 'doctor1';

/**
 * Resolve Expo push token: MongoDB (doctor1) → any doctor → in-memory cache.
 */
async function resolvePushToken() {
  if (mongoose.connection.readyState === 1) {
    const primary = await Doctor.findOne({ userId: DOCTOR_USER_ID }).lean();
    if (primary?.pushToken) {
      return { token: primary.pushToken, source: `mongodb:${DOCTOR_USER_ID}` };
    }

    const anyDoctor = await Doctor.findOne({
      pushToken: { $exists: true, $nin: [null, ''] },
    }).lean();
    if (anyDoctor?.pushToken) {
      return {
        token: anyDoctor.pushToken,
        source: `mongodb:${anyDoctor.userId}`,
      };
    }
  }

  const fromMemory = pushTokenStore.getToken(DOCTOR_USER_ID) || pushTokenStore.getAnyToken();
  if (fromMemory) {
    return { token: fromMemory, source: 'memory' };
  }

  return { token: null, source: null };
}

/**
 * Send remote push via Expo Push API.
 */
async function sendPushNotification(patient, token) {
  const patientId = String(patient.patientId || patient.id || '');
  const patientName = patient.name || patientId;

  const message = {
    to: token,
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

  console.log('🚨 SENDING PUSH:', JSON.stringify({ to: token.slice(0, 40) + '...', patientId }));

  const response = await axios.post(EXPO_PUSH_URL, message, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

  console.log('✅ EXPO RESPONSE:', JSON.stringify(response.data));

  const ticket = response.data?.data?.[0];
  if (ticket?.status === 'error') {
    throw new Error(ticket.message || 'Expo push ticket error');
  }

  return response.data;
}

/**
 * Full critical alert flow with token lookup + Expo send.
 */
async function sendCriticalPush(patient, effectiveStatus) {
  const statusUpper = String(effectiveStatus || '').trim().toUpperCase();
  if (statusUpper !== 'CRITICAL') {
    return { status: 'skipped', reason: 'not_critical', effectiveStatus: statusUpper };
  }

  console.log('🚨 CRITICAL DETECTED');

  const { token, source } = await resolvePushToken();

  if (!token) {
    console.log('❌ No push token found — open app once to register via POST /api/save-token');
    return {
      status: 'no_token',
      reason: 'Open the mobile app (EAS build) to register push token',
      doctorUserId: DOCTOR_USER_ID,
      memoryTokens: pushTokenStore.getAllTokens(),
    };
  }

  console.log('✅ Found token via', source);

  try {
    const expo = await sendPushNotification(patient, token);
    return { status: 'sent', tokenSource: source, expo };
  } catch (err) {
    console.error('❌ PUSH ERROR:', err.message);
    if (err.response?.data) {
      console.error('❌ PUSH ERROR BODY:', JSON.stringify(err.response.data));
    }
    return { status: 'error', message: err.message, tokenSource: source };
  }
}

module.exports = {
  sendPushNotification,
  sendCriticalPush,
  resolvePushToken,
  DOCTOR_USER_ID,
};
