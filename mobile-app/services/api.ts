import { API_BASE_URL, API_PATHS } from '@/constants/config';
import type { AlertsResponse, DashboardResponse, VitalReading } from '@/types/vitals';

const MAX_RETRIES = 3;

async function fetchWithRetry<T>(url: string, init?: RequestInit): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[API] ${init?.method || 'GET'} ${url} (attempt ${attempt})`);
      const res = await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers || {}),
        },
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || `HTTP ${res.status}`);
      }

      return (text ? JSON.parse(text) : {}) as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.log('[API] Error:', lastError.message);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }

  throw lastError ?? new Error('Request failed');
}

export async function checkHealth(): Promise<{ status: string; database?: string }> {
  return fetchWithRetry(`${API_BASE_URL}${API_PATHS.health}`);
}

export async function fetchDashboard(): Promise<DashboardResponse> {
  return fetchWithRetry<DashboardResponse>(`${API_BASE_URL}${API_PATHS.dashboard}`);
}

export async function fetchAlerts(): Promise<AlertsResponse> {
  return fetchWithRetry<AlertsResponse>(`${API_BASE_URL}${API_PATHS.alerts}`);
}

export async function fetchPatientLatest(patientId: string): Promise<VitalReading | null> {
  const json = await fetchWithRetry<{ success: boolean; data: VitalReading | null }>(
    `${API_BASE_URL}${API_PATHS.patientLatest(patientId)}`
  );
  return json.data ?? null;
}
