import { getApiBaseUrl } from '@/constants/api';
import type { BleSensorPacket } from '@/services/BLEService';

export interface PostSensorResponse {
  message?: string;
  prediction?: Record<string, unknown>;
  data?: Record<string, unknown>;
  source?: string;
  error?: string;
}

const API_DEBOUNCE_MS = Number(process.env.EXPO_PUBLIC_API_DEBOUNCE_MS) || 2000;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPacket: BleSensorPacket | null = null;
let inFlight = false;

function getDataEndpoint(): string {
  return `${getApiBaseUrl()}/api/data`;
}

function getPatientsEndpoint(): string {
  return `${getApiBaseUrl()}/api/all-patients`;
}

/**
 * POST vitals to backend (ML + MongoDB).
 */
export async function postSensorData(packet: BleSensorPacket): Promise<PostSensorResponse> {
  const url = getDataEndpoint();
  console.log('Sending to backend:', url, packet);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId: packet.patientId,
      temperature: packet.temperature,
      heartRate: packet.heartRate,
      spo2: packet.spo2,
      gsr: packet.gsr,
    }),
  });

  const text = await response.text();
  let json: PostSensorResponse = {};

  try {
    json = text ? (JSON.parse(text) as PostSensorResponse) : {};
  } catch {
    json = { error: text || `HTTP ${response.status}` };
  }

  if (!response.ok) {
    const errMsg = json.error || text || `HTTP ${response.status}`;
    console.log('[API] Backend error:', errMsg);
    throw new Error(errMsg);
  }

  console.log('Backend response:', JSON.stringify(json).slice(0, 500));
  return json;
}

/**
 * Debounce POST so rapid BLE notifications do not spam the backend.
 */
export function postSensorDataDebounced(
  packet: BleSensorPacket
): Promise<PostSensorResponse> {
  pendingPacket = packet;

  return new Promise((resolve, reject) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      const toSend = pendingPacket;
      pendingPacket = null;

      if (!toSend) {
        reject(new Error('No packet to send'));
        return;
      }

      if (inFlight) {
        pendingPacket = toSend;
        resolve({ message: 'Skipped — request in flight' });
        return;
      }

      inFlight = true;
      postSensorData(toSend)
        .then(resolve)
        .catch(reject)
        .finally(() => {
          inFlight = false;
          if (pendingPacket) {
            void postSensorDataDebounced(pendingPacket);
          }
        });
    }, API_DEBOUNCE_MS);
  });
}

export async function fetchAllPatients(): Promise<{ patients: Record<string, unknown>[] }> {
  const url = getPatientsEndpoint();
  console.log('[API] Fetching patients:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `GET all-patients failed (${response.status})`);
  }

  const json = (await response.json()) as { patients?: Record<string, unknown>[] };
  return { patients: Array.isArray(json.patients) ? json.patients : [] };
}

export function resetApiDebounce(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = null;
  pendingPacket = null;
}
