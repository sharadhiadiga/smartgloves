/**
 * Healthcare risk pipeline — vitals → per-metric risk → overallRiskLevel
 */

const {
  tempCondition,
  hrCondition,
  spo2Condition,
  gsrCondition,
} = require('./vitalConditions');

const SEVERITY_RANK = {
  Invalid: 0,
  Normal: 1,
  Moderate: 2,
  High: 3,
  Critical: 4,
};

function normalizeConditionLabel(raw) {
  const c = String(raw || '').trim().toLowerCase();
  if (c === 'critical') return 'Critical';
  if (c === 'high') return 'High';
  if (c === 'moderate') return 'Moderate';
  if (c === 'invalid') return 'Invalid';
  if (c === 'low' || c === 'normal') return 'Normal'; // legacy "low" → Normal
  return 'Normal';
}

function assessTemperatureRisk(celsius) {
  return tempCondition(celsius);
}

function assessHeartRateRisk(bpm) {
  return hrCondition(bpm);
}

function assessSpo2Risk(spo2) {
  return spo2Condition(spo2);
}

function assessGsrStress(gsr) {
  const risk = gsrCondition(gsr);
  const stress =
    risk === 'Critical' ? 85 : risk === 'High' ? 65 : risk === 'Moderate' ? 45 : risk === 'Invalid' ? 0 : 20;
  return { stress, risk };
}

function worstRisk(...levels) {
  let winner = 'Normal';
  let rank = SEVERITY_RANK.Normal;
  for (const level of levels) {
    const normalized = normalizeConditionLabel(level);
    const r = SEVERITY_RANK[normalized] ?? SEVERITY_RANK.Normal;
    if (r > rank) {
      rank = r;
      winner =
        normalized === 'Critical'
          ? 'Critical'
          : normalized === 'High'
            ? 'High'
            : normalized === 'Moderate'
              ? 'Moderate'
              : normalized === 'Invalid'
                ? 'Invalid'
                : 'Normal';
    }
  }
  return winner;
}

/**
 * @param {object} vitals
 * @param {object} [mlPrediction]
 */
function runRiskPipeline(vitals, mlPrediction = null) {
  const temperature = Number(vitals.temperature);
  const heartRate = Number(vitals.heartRate);
  const spo2 = Number(vitals.spo2);
  const gsr = Number(vitals.gsr);

  const temperatureCondition = assessTemperatureRisk(temperature);
  const heartRateCondition = assessHeartRateRisk(heartRate);
  const spo2Condition = assessSpo2Risk(spo2);
  const gsrResult = assessGsrStress(gsr);
  const gsrCondition = gsrResult.risk;

  let stress = gsrResult.stress;
  const issues = [];
  const measures = [];

  if (temperatureCondition !== 'Normal' && temperatureCondition !== 'Invalid') {
    issues.push(`Temperature ${temperature}°C (${temperatureCondition})`);
    measures.push('Monitor temperature every 5–15 minutes.');
  }
  if (heartRateCondition !== 'Normal' && heartRateCondition !== 'Invalid') {
    issues.push(`Heart rate ${heartRate} bpm (${heartRateCondition})`);
    measures.push('Reduce exertion; recheck pulse frequently.');
  }
  if (spo2Condition !== 'Normal' && spo2Condition !== 'Invalid') {
    issues.push(`SpO₂ ${spo2}% (${spo2Condition})`);
    measures.push('Verify sensor placement; consider supplemental O₂ per protocol.');
  }
  if (gsrCondition !== 'Normal' && gsrCondition !== 'Invalid') {
    issues.push(`GSR ${gsr} indicates elevated stress (${gsrCondition})`);
    measures.push('Encourage rest and stress-reduction techniques.');
  }

  let mlSeverity = null;
  if (mlPrediction && typeof mlPrediction === 'object') {
    mlSeverity = normalizeConditionLabel(mlPrediction.level || mlPrediction.status);
    if (Number.isFinite(mlPrediction.stress)) {
      stress = Math.max(stress, Number(mlPrediction.stress));
    }
    if (Array.isArray(mlPrediction.issues) && mlPrediction.issues.length) {
      issues.push(...mlPrediction.issues);
    }
    if (Array.isArray(mlPrediction.measures) && mlPrediction.measures.length) {
      measures.push(...mlPrediction.measures);
    }
  }

  const overallRiskLevel = worstRisk(
    temperatureCondition,
    heartRateCondition,
    spo2Condition,
    gsrCondition,
    mlSeverity
  );

  const recommendation =
    overallRiskLevel === 'Critical'
      ? 'Immediate clinical attention recommended.'
      : overallRiskLevel === 'High'
        ? 'Close monitoring required; notify care team.'
        : overallRiskLevel === 'Moderate'
          ? 'Continue monitoring; repeat vitals shortly.'
          : 'Vitals within expected range. Continue routine monitoring.';

  return {
    temperatureCondition,
    heartRateCondition,
    spo2Condition,
    gsrCondition,
    overallRiskLevel,
    stress: Math.min(100, Math.max(0, Math.round(stress))),
    status: overallRiskLevel,
    severity: overallRiskLevel,
    issues: issues.length ? issues : ['No acute issues detected.'],
    measures: measures.length ? measures : ['Continue periodic monitoring.'],
    recommendation,
  };
}

module.exports = {
  runRiskPipeline,
  assessTemperatureRisk,
  assessHeartRateRisk,
  assessSpo2Risk,
  assessGsrStress,
  worstRisk,
  normalizeConditionLabel,
};
