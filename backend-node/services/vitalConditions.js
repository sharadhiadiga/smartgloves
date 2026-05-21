/**
 * Single source of truth for per-vital condition labels (matches ESP32 / clinical thresholds).
 */

function tempCondition(temp) {
  if (temp == null || !Number.isFinite(Number(temp)) || Number(temp) <= 0) return 'Invalid';
  if (Number(temp) >= 39.0) return 'Critical';
  if (Number(temp) >= 38.0) return 'High';
  if (Number(temp) >= 37.5) return 'Moderate';
  return 'Normal';
}

function hrCondition(hr) {
  if (hr == null || !Number.isFinite(Number(hr)) || Number(hr) === 0) return 'Invalid';
  const n = Number(hr);
  if (n >= 140) return 'Critical';
  if (n >= 120) return 'High';
  if (n >= 100) return 'Moderate';
  if (n >= 60) return 'Normal';
  return 'Moderate';
}

function spo2Condition(spo2) {
  if (spo2 == null || !Number.isFinite(Number(spo2)) || Number(spo2) === 0) return 'Invalid';
  const n = Number(spo2);
  if (n < 90) return 'Critical';
  if (n <= 93) return 'High';
  if (n <= 95) return 'Moderate';
  return 'Normal';
}

function gsrCondition(gsr) {
  if (gsr == null || !Number.isFinite(Number(gsr)) || Number(gsr) <= 10) return 'Invalid';
  const n = Number(gsr);
  if (n >= 3000) return 'Critical';
  if (n >= 2500) return 'High';
  if (n >= 2000) return 'Moderate';
  return 'Normal';
}

function computeVitalConditions({ temperature, heartRate, spo2, gsr }) {
  return {
    temperatureCondition: tempCondition(temperature),
    heartRateCondition: hrCondition(heartRate),
    spo2Condition: spo2Condition(spo2),
    gsrCondition: gsrCondition(gsr),
  };
}

module.exports = {
  tempCondition,
  hrCondition,
  spo2Condition,
  gsrCondition,
  computeVitalConditions,
};
