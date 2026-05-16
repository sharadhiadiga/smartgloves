const Patient = require('../models/Patient');
const {
  notifyDoctors,
  normalizeStatusKey,
  isWithinCooldown,
} = require('./notificationService');

/**
 * Track status transitions and fire push alerts when entering CRITICAL.
 */
async function handlePatientStatusUpdate({ patientId, name, currentStatus }) {
  const normalizedCurrent = normalizeStatusKey(currentStatus);
  const key = String(patientId).trim();

  if (!key) {
    console.warn('[MONITOR] Missing patientId — skipping status update');
    return { alerted: false };
  }

  let patientDoc = await Patient.findOne({ patientId: key });

  const previousStatus = patientDoc
    ? normalizeStatusKey(patientDoc.lastStatus)
    : '';

  if (!patientDoc) {
    console.log('[MONITOR] New patient record', key, 'status=', normalizedCurrent);
  }
  const shouldAlert =
    previousStatus !== 'CRITICAL' && normalizedCurrent === 'CRITICAL';

  console.log('[MONITOR] Status check', {
    patientId: key,
    previousStatus,
    currentStatus: normalizedCurrent,
    shouldAlert,
  });

  let alerted = false;
  const isNewPatient = !patientDoc;

  if (shouldAlert) {
    if (patientDoc && isWithinCooldown(patientDoc.lastAlertTime)) {
      console.log('[MONITOR] Cooldown active — alert suppressed for', key);
    } else {
      const alertPatient = {
        patientId: key,
        name: name || patientDoc?.name || key,
        _id: key,
      };

      const notifyResults = await notifyDoctors(alertPatient);
      alerted = notifyResults.some((r) => r.sent);

      if (alerted) {
        console.log('[MONITOR] Critical alert sent for', key);
      } else {
        console.log('[MONITOR] Critical transition detected but no push delivered', key);
      }
    }
  }

  if (!patientDoc) {
    patientDoc = new Patient({
      patientId: key,
      name: name || key,
      lastStatus: normalizedCurrent,
      lastAlertTime: alerted ? new Date() : null,
    });
  } else {
    patientDoc.lastStatus = normalizedCurrent;
    if (alerted) {
      patientDoc.lastAlertTime = new Date();
    }
    if (name && name.trim().length > 0) {
      patientDoc.name = name.trim();
    }
  }

  await patientDoc.save();

  return { alerted, previousStatus, currentStatus: normalizedCurrent, created: isNewPatient };
}

module.exports = { handlePatientStatusUpdate };
