/**
 * Healthcare risk pipeline — vitals → per-metric risk → overallRiskLevel
 */

const SEVERITY_RANK = {
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
  if (c === 'low' || c === 'normal') return 'Normal';
  return 'Normal';
}

function assessTemperatureRisk(celsius) {
  if (celsius >= 39.5 || celsius <= 35) return 'Critical';
  if (celsius >= 38 || celsius < 36) return 'High';
  if (celsius >= 37.2 || celsius < 36.5) return 'Moderate';
  return 'Normal';
}

function assessHeartRateRisk(bpm) {
  if (bpm >= 140 || bpm <= 45) return 'Critical';
  if (bpm >= 115 || bpm < 55) return 'High';
  if (bpm >= 100 || bpm < 60) return 'Moderate';
  return 'Normal';
}

function assessSpo2Risk(spo2) {
  if (spo2 < 88) return 'Critical';
  if (spo2 < 94) return 'High';
  if (spo2 < 97) return 'Moderate';
  return 'Normal';
}

function assessGsrStress(gsr) {
  if (gsr >= 2400) return { stress: 85, risk: 'Critical' };
  if (gsr >= 1700) return { stress: 65, risk: 'High' };
  if (gsr >= 1200) return { stress: 45, risk: 'Moderate' };
  return { stress: 20, risk: 'Normal' };
}

function worstRisk(...levels) {
  let winner = 'Normal';
  let rank = SEVERITY_RANK.Normal;
  for (const level of levels) {
    const normalized = normalizeConditionLabel(level);
    const r = SEVERITY_RANK[normalized] ?? SEVERITY_RANK.Normal;
    if (r > rank) {
      rank = r;
      winner = normalized === 'Critical' ? 'Critical' : normalized === 'High' ? 'High' : normalized === 'Moderate' ? 'Moderate' : 'Normal';
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

  const temperatureRisk = assessTemperatureRisk(temperature);
  const heartRateRisk = assessHeartRateRisk(heartRate);
  const spo2Risk = assessSpo2Risk(spo2);
  const gsrResult = assessGsrStress(gsr);

  const esp32Temps = normalizeConditionLabel(vitals.temperatureCondition);
  const esp32Hr = normalizeConditionLabel(vitals.heartRateCondition);
  const esp32Spo2 = normalizeConditionLabel(vitals.spo2Condition);
  const esp32Gsr = normalizeConditionLabel(vitals.gsrCondition);

  const temperatureCondition = worstRisk(temperatureRisk, esp32Temps);
  const heartRateCondition = worstRisk(heartRateRisk, esp32Hr);
  const spo2Condition = worstRisk(spo2Risk, esp32Spo2);
  const gsrCondition = worstRisk(gsrResult.risk, esp32Gsr);

  let stress = gsrResult.stress;
  const issues = [];
  const measures = [];

  if (temperatureCondition !== 'Normal') {
    issues.push(`Temperature ${temperature}°C (${temperatureCondition})`);
    measures.push('Monitor temperature every 5–15 minutes.');
  }
  if (heartRateCondition !== 'Normal') {
    issues.push(`Heart rate ${heartRate} bpm (${heartRateCondition})`);
    measures.push('Reduce exertion; recheck pulse frequently.');
  }
  if (spo2Condition !== 'Normal') {
    issues.push(`SpO₂ ${spo2}% (${spo2Condition})`);
    measures.push('Verify sensor placement; consider supplemental O₂ per protocol.');
  }
  if (gsrCondition !== 'Normal') {
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
