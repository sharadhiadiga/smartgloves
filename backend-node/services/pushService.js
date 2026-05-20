const axios = require('axios');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const ANDROID_CHANNEL_ID = 'default';

/**
 * Send remote push via Expo Push API (delivers when app is closed).
 * @param {{ patientId: string, name?: string }} patient
 * @param {string} token - ExponentPushToken[...]
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

  console.log('🚨 SENDING PUSH:', JSON.stringify(message, null, 2));

  const response = await axios.post(EXPO_PUSH_URL, message, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

  console.log('✅ EXPO RESPONSE:', JSON.stringify(response.data));
  return response.data;
}

module.exports = { sendPushNotification };
