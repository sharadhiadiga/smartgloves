import type { Patient } from '@/components/PatientCard';
import type { RiskLevel, VitalReading } from '@/types/vitals';

const LOW_LABEL = /^low$/i;

/** Never show "Low" in the UI — map to Normal. */
export function normalizeRisk(raw: unknown): RiskLevel {
  if (raw == null) return 'Unknown';
  const v = String(raw).trim().toLowerCase();
  if (LOW_LABEL.test(v) || v === 'normal') return 'Normal';
  if (v === 'critical') return 'Critical';
  if (v === 'high') return 'High';
  if (v === 'moderate') return 'Moderate';
  return 'Unknown';
}

/** Final label for any <Text> — use this at render time so "Low" never appears. */
export function formatUiLabel(raw: unknown): string {
  if (raw == null) return '—';
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === '—') return '—';
  if (LOW_LABEL.test(trimmed)) return 'Normal';
  const risk = normalizeRisk(trimmed);
  if (risk !== 'Unknown') return risk;
  const condition = normalizeConditionLabel(trimmed);
  return LOW_LABEL.test(condition) ? 'Normal' : condition;
}

/** Per-vital labels: legacy "Low" → Normal. */
export function normalizeConditionLabel(raw: unknown): string {
  if (raw == null || String(raw).trim() === '' || String(raw).trim() === '—') return '—';
  const v = String(raw).trim().toLowerCase();
  if (LOW_LABEL.test(v) || v === 'normal') return 'Normal';
  if (v === 'critical') return 'Critical';
  if (v === 'high') return 'High';
  if (v === 'moderate') return 'Moderate';
  if (v === 'invalid') return 'Invalid';
  return String(raw).trim();
}

/** Normalize all risk/condition fields on a vitals record (API + socket). */
export function normalizeVitalReading(v: VitalReading): VitalReading {
  const risk = normalizeRisk(v.overallRiskLevel || v.status || v.severity);
  return {
    ...v,
    overallRiskLevel: risk,
    status: risk,
    severity: risk,
    temperatureCondition: normalizeConditionLabel(v.temperatureCondition),
    heartRateCondition: normalizeConditionLabel(v.heartRateCondition),
    spo2Condition: normalizeConditionLabel(v.spo2Condition),
    gsrCondition: normalizeConditionLabel(v.gsrCondition),
  };
}

export function formatTimestamp(ts: unknown): string {
  if (ts == null) return '--';
  const d = new Date(String(ts));
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleString();
}

export function vitalToPatient(v: VitalReading): Patient {
  const n = normalizeVitalReading(v);
  const id = n.patientId || n.id || String(n._id || 'unknown');
  const risk = normalizeRisk(n.overallRiskLevel || n.status || n.severity);
  return {
    id,
    name: n.name?.trim() || id,
    temperature: typeof n.temperature === 'number' ? n.temperature : null,
    heartRate: typeof n.heartRate === 'number' ? n.heartRate : null,
    spo2: typeof n.spo2 === 'number' ? n.spo2 : null,
    gsr: typeof n.gsr === 'number' ? n.gsr : null,
    temperatureCondition: n.temperatureCondition,
    heartRateCondition: n.heartRateCondition,
    spo2Condition: n.spo2Condition,
    gsrCondition: n.gsrCondition,
    stress: typeof n.stress === 'number' ? n.stress : null,
    status: risk,
    issues: Array.isArray(n.issues) ? n.issues : [],
    measures: Array.isArray(n.measures) ? n.measures : [],
    recommendation: n.recommendation || '--',
    timestamp: formatTimestamp(n.timestamp),
    overallRiskLevel: risk,
  };
}
