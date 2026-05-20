import { getApiBaseUrl } from '@/constants/api';

export interface SensorPayload {
  patientId: string;
  temperature: number;
  heartRate: number;
  spo2: number;
  gsr: number;
  temperatureCondition?: string;
  heartRateCondition?: string;
  spo2Condition?: string;
  gsrCondition?: string;
}

export interface PatientRecord {
  patientId?: string;
  id?: string;
  _id?: string;
  name?: string;
  temperature?: number;
  heartRate?: number;
  spo2?: number;
  gsr?: number;
  temperatureCondition?: string;
  heartRateCondition?: string;
  spo2Condition?: string;
  gsrCondition?: string;
  status?: string;
  severity?: string;
  stress?: number;
  issues?: string[];
  measures?: string[];
  recommendation?: string;
  timestamp?: string | number | Date;
}

export interface PatientsApiResponse {
  patients?: PatientRecord[];
}

function getPatientsEndpoint(): string {
  return `${getApiBaseUrl()}/api/patients`;
}

/**
 * Fetch all latest patient records from the backend (ESP32 → WiFi → API).
 */
export async function fetchPatients(): Promise<PatientRecord[]> {
  const url = getPatientsEndpoint();
  console.log('[API] GET patients:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  const text = await response.text();
  if (!response.ok) {
    console.log('[API] GET patients failed:', response.status, text);
    throw new Error(text || `GET /api/patients failed (${response.status})`);
  }

  let json: PatientsApiResponse | PatientRecord[] = {};
  try {
    json = text ? (JSON.parse(text) as PatientsApiResponse | PatientRecord[]) : {};
  } catch {
    throw new Error('Invalid JSON from /api/patients');
  }

  if (Array.isArray(json)) {
    return json;
  }

  const patients = Array.isArray(json.patients) ? json.patients : [];
  console.log('[API] Patients loaded:', patients.length);
  return patients;
}
