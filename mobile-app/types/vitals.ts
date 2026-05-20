export type RiskLevel = 'Normal' | 'Moderate' | 'High' | 'Critical' | 'Unknown';

export interface VitalReading {
  _id?: string;
  id?: string;
  patientId: string;
  name?: string;
  deviceId?: string;
  temperature: number;
  heartRate: number;
  spo2: number;
  gsr: number;
  temperatureCondition: string;
  heartRateCondition: string;
  spo2Condition: string;
  gsrCondition: string;
  overallRiskLevel?: RiskLevel;
  status?: string;
  severity?: string;
  stress?: number;
  issues?: string[];
  measures?: string[];
  recommendation?: string;
  timestamp?: string;
}

export interface DashboardResponse {
  success?: boolean;
  updatedAt: string;
  patientCount: number;
  alertCount: number;
  patients: VitalReading[];
  alerts: VitalReading[];
}

export interface AlertsResponse {
  success?: boolean;
  updatedAt: string;
  count: number;
  alerts: VitalReading[];
}
