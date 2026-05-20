/** Cloud API — Render production backend */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') ||
  'https://smartgloves-backend.onrender.com';

export const POLL_INTERVAL_MS = Number(process.env.EXPO_PUBLIC_POLL_MS) || 1000;

export const API_PATHS = {
  health: '/health',
  vitals: '/api/vitals',
  dashboard: '/api/dashboard',
  alerts: '/api/alerts',
  patients: '/api/patients',
  patientLatest: (id: string) => `/api/patient/latest/${encodeURIComponent(id)}`,
} as const;
