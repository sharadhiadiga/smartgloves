import type { Patient } from '@/components/PatientCard';
import type { RiskLevel, VitalReading } from '@/types/vitals';

export function normalizeRisk(raw: unknown): RiskLevel {
  if (typeof raw !== 'string') return 'Unknown';
  const v = raw.trim().toLowerCase();
  if (v === 'critical') return 'Critical';
  if (v === 'high') return 'High';
  if (v === 'moderate') return 'Moderate';
  if (v === 'low' || v === 'normal') return 'Normal';
  return 'Unknown';
}

export function formatTimestamp(ts: unknown): string {
  if (ts == null) return '--';
  const d = new Date(String(ts));
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleString();
}

export function vitalToPatient(v: VitalReading): Patient {
  const id = v.patientId || v.id || String(v._id || 'unknown');
  const risk = normalizeRisk(v.overallRiskLevel || v.status || v.severity);
  return {
    id,
    name: v.name?.trim() || id,
    temperature: typeof v.temperature === 'number' ? v.temperature : null,
    heartRate: typeof v.heartRate === 'number' ? v.heartRate : null,
    spo2: typeof v.spo2 === 'number' ? v.spo2 : null,
    gsr: typeof v.gsr === 'number' ? v.gsr : null,
    temperatureCondition: v.temperatureCondition || '—',
    heartRateCondition: v.heartRateCondition || '—',
    spo2Condition: v.spo2Condition || '—',
    gsrCondition: v.gsrCondition || '—',
    stress: typeof v.stress === 'number' ? v.stress : null,
    status: risk,
    issues: Array.isArray(v.issues) ? v.issues : [],
    measures: Array.isArray(v.measures) ? v.measures : [],
    recommendation: v.recommendation || '--',
    timestamp: formatTimestamp(v.timestamp),
    overallRiskLevel: risk,
  };
}
