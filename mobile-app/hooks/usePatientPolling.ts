import { useCallback, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';

import { fetchPatients, type PatientRecord } from '@/services/apiService';

const DEFAULT_POLL_MS = 2000;

export interface UsePatientPollingOptions {
  pollIntervalMs?: number;
  onCriticalDetected?: (patientId: string, name: string) => void;
}

export function usePatientPolling(options: UsePatientPollingOptions = {}) {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_MS;
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const firstLoadRef = useRef(true);
  const knownCriticalRef = useRef<Set<string>>(new Set());
  const onCriticalRef = useRef(options.onCriticalDetected);
  onCriticalRef.current = options.onCriticalDetected;

  const loadPatients = useCallback(async (signal?: AbortSignal) => {
    try {
      if (firstLoadRef.current) setLoading(true);

      const patients = await fetchPatients();
      if (signal?.aborted) return;

      setRecords(patients);
      setLastUpdated(new Date().toISOString());
      setRetryCount(0);
      setOffline(false);
      setError(null);

      for (const p of patients) {
        const id = String(p.patientId ?? p.id ?? p._id ?? '');
        const status = String(p.status ?? p.severity ?? '').toLowerCase();
        const name = typeof p.name === 'string' ? p.name : id;
        if (status === 'critical' && id && !knownCriticalRef.current.has(id)) {
          knownCriticalRef.current.add(id);
          onCriticalRef.current?.(id, name);
          void Notifications.scheduleNotificationAsync({
            content: {
              title: 'Critical patient alert',
              body: `${name} (${id}) requires immediate attention`,
              sound: true,
            },
            trigger: null,
          }).catch((err) => console.log('[Notify] schedule failed:', err));
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Unable to fetch patient data';
      console.log('[Polling] Error:', message);
      setRetryCount((c) => c + 1);
      setOffline(true);
      setError(message);
    } finally {
      if (firstLoadRef.current) {
        setLoading(false);
        firstLoadRef.current = false;
      }
      setRefreshing(false);
    }
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    const controller = new AbortController();
    void loadPatients(controller.signal).finally(() => controller.abort());
  }, [loadPatients]);

  useEffect(() => {
    const controller = new AbortController();
    void loadPatients(controller.signal);
    const interval = setInterval(() => void loadPatients(), pollIntervalMs);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [loadPatients, pollIntervalMs]);

  return {
    records,
    loading,
    refreshing,
    error,
    offline,
    lastUpdated,
    retryCount,
    refresh,
    pollIntervalMs,
  };
}
