const axios = require('axios');

const ML_TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS) || 8000;

/**
 * Maps ML API payload to dashboard severity labels and consistent fields.
 * Python Flask returns lowercase level strings (normal, high, critical).
 */
function normalizeMlResponse(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  if (raw.error) {
    return null;
  }

  const stressRaw = raw.stress;
  const stress = Number.isFinite(Number(stressRaw)) ? Number(stressRaw) : null;

  const levelRaw = raw.level ?? raw.prediction ?? raw.status ?? '';
  const levelStr = String(levelRaw).toLowerCase().trim();

  let severity = 'Low';
  if (levelStr === 'critical') severity = 'Critical';
  else if (levelStr === 'high') severity = 'High';
  else if (levelStr === 'moderate') severity = 'Moderate';
  else if (levelStr === 'normal' || levelStr === 'low') severity = 'Low';
  else if (stress !== null) {
    if (stress >= 80) severity = 'Critical';
    else if (stress >= 60) severity = 'High';
    else if (stress >= 35) severity = 'Moderate';
    else severity = 'Low';
  }

  const issues = Array.isArray(raw.issues) ? raw.issues.filter((x) => typeof x === 'string') : [];
  const measures = Array.isArray(raw.measures) ? raw.measures.filter((x) => typeof x === 'string') : [];

  const recommendation =
    typeof raw.recommendation === 'string' && raw.recommendation.trim().length > 0
      ? raw.recommendation.trim()
      : null;

  return {
    level: severity,
    status: severity,
    stress: stress ?? 0,
    issues,
    measures,
    recommendation: recommendation || 'Continue monitoring based on latest readings.',
    predictionLevel: String(levelRaw || severity),
  };
}

/**
 * Calls ML service. Returns normalized prediction object on success, null if ML is unavailable
 * or response is invalid (caller should keep heuristic / dynamic fallback).
 */
const predictHealth = async (data) => {
  console.log('[ML REQUEST]', JSON.stringify(data));

  const required = ['temperature', 'heartRate', 'spo2', 'gsr'];
  const missingFields = required.filter(
    (field) => data[field] === undefined || data[field] === null || data[field] === ''
  );
  if (missingFields.length > 0) {
    console.error('[ML REQUEST] Skipped — missing fields:', missingFields);
    return null;
  }

  const mlUrl = process.env.ML_API_URL || 'http://127.0.0.1:5001/predict';

  try {
    const response = await axios.post(mlUrl, data, {
      timeout: ML_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
    });

    console.log('[ML RESPONSE] status=', response.status, 'body=', JSON.stringify(response.data));

    if (response.status < 200 || response.status >= 300) {
      console.error('[ML RESPONSE] Non-OK status', response.status, response.data);
      return null;
    }

    if (!response.data || typeof response.data !== 'object') {
      console.error('[ML RESPONSE] Invalid payload type');
      return null;
    }

    if (response.data.error) {
      console.error('[ML RESPONSE] API error field:', response.data);
      return null;
    }

    const normalized = normalizeMlResponse(response.data);
    if (!normalized) {
      console.error('[ML RESPONSE] Could not normalize payload');
      return null;
    }

    console.log('[ML RESPONSE] normalized=', JSON.stringify(normalized));
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
