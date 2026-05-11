const axios = require('axios');

const ML_TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS) || 8000;

/**
 * Normalize ML response so backend can always use it
 * Works with your Flask output: prediction / condition / level
 */
function normalizeMlResponse(raw) {
  if (!raw || typeof raw !== 'object') return null;

  if (raw.error) return null;

  const stress = Number(raw.stress) || 0;

  // Accept multiple possible fields from ML
  const levelRaw =
    raw.level ||
    raw.prediction ||
    raw.condition ||
    raw.status ||
    'low';

  const levelStr = String(levelRaw).toLowerCase().trim();

  let severity = 'Low';

  if (levelStr.includes('critical')) severity = 'Critical';
  else if (levelStr.includes('high')) severity = 'High';
  else if (levelStr.includes('moderate')) severity = 'Moderate';
  else severity = 'Low';

  return {
    level: severity,
    status: severity,
    stress,
    issues: Array.isArray(raw.issues)
      ? raw.issues
      : ['Derived from ML prediction'],
    measures: Array.isArray(raw.measures)
      ? raw.measures
      : ['Follow recommended precautions'],
    recommendation:
      raw.recommendation ||
      raw.condition ||
      'Monitor patient condition closely',
    predictionLevel: levelStr,
  };
}

/**
 * Calls ML API
 */
const predictHealth = async (data) => {
  console.log('[ML REQUEST]', JSON.stringify(data));

  const required = ['temperature', 'heartRate', 'spo2', 'gsr'];
  const missingFields = required.filter(
    (field) =>
      data[field] === undefined ||
      data[field] === null ||
      data[field] === ''
  );

  if (missingFields.length > 0) {
    console.error('[ML REQUEST] Missing fields:', missingFields);
    return null;
  }

  const mlUrl =
    process.env.ML_API_URL ||
    'http://127.0.0.1:5001/predict';

  try {
    const response = await axios.post(mlUrl, data, {
      timeout: ML_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
    });

    console.log('[ML RESPONSE RAW]', JSON.stringify(response.data));

    if (!response.data || typeof response.data !== 'object') {
      console.error('[ML RESPONSE] Invalid payload');
      return null;
    }

    const normalized = normalizeMlResponse(response.data);

    if (!normalized) {
      console.error('[ML RESPONSE] Normalization failed');
      return null;
    }

    console.log('[ML RESPONSE NORMALIZED]', JSON.stringify(normalized));

    return normalized;
  } catch (error) {
    console.error(
      '[ML ERROR]',
      error?.message || error,
      error.response ? JSON.stringify(error.response.data) : ''
    );
    return null;
  }
};

module.exports = { predictHealth, normalizeMlResponse };