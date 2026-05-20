/** @deprecated Use `@/services/api` — kept for backward compatibility */
export {
  fetchDashboard as fetchPatients,
  checkHealth,
  fetchAlerts,
  fetchPatientLatest,
} from '@/services/api';

export type { VitalReading as PatientRecord } from '@/types/vitals';
