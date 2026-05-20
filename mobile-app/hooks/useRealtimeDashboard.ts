import { useCallback, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';

import { POLL_INTERVAL_MS } from '@/constants/config';
import { fetchAlerts, fetchDashboard } from '@/services/api';
import { connectRealtimeSocket, disconnectRealtimeSocket } from '@/services/socket';
import type { DashboardResponse, VitalReading } from '@/types/vitals';

export function useRealtimeDashboard(pollMs: number = POLL_INTERVAL_MS) {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const patientsMapRef = useRef<Map<string, VitalReading>>(new Map());
  const knownCriticalRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  const mergeVital = useCallback((incoming: VitalReading) => {
    const key = `${incoming.patientId}:${incoming.deviceId || 'default'}`;
    patientsMapRef.current.set(key, { ...patientsMapRef.current.get(key), ...incoming });

    const patients = Array.from(patientsMapRef.current.values()).sort(
      (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    );

    const alerts = patients.filter((p) => {
      const r = String(p.overallRiskLevel || p.status || '').toLowerCase();
      return r === 'critical' || r === 'high';
    });

    setDashboard({
      updatedAt: new Date().toISOString(),
      patientCount: patients.length,
      alertCount: alerts.length,
      patients,
      alerts,
    });
    setLastUpdated(new Date().toISOString());
    setOffline(false);
    setError(null);

    const risk = String(incoming.overallRiskLevel || incoming.status || '').toLowerCase();
    if (risk === 'critical' && !knownCriticalRef.current.has(incoming.patientId)) {
      knownCriticalRef.current.add(incoming.patientId);
      void Notifications.scheduleNotificationAsync({
        content: {
          title: 'Critical patient alert',
          body: `${incoming.name || incoming.patientId} requires attention`,
          sound: true,
        },
        trigger: null,
      }).catch(() => undefined);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      if (firstLoadRef.current) setLoading(true);
      const data = await fetchDashboard();
      patientsMapRef.current.clear();
      for (const p of data.patients) {
        const key = `${p.patientId}:${p.deviceId || 'default'}`;
        patientsMapRef.current.set(key, p);
      }
      setDashboard(data);
      setLastUpdated(data.updatedAt || new Date().toISOString());
      setOffline(false);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Dashboard fetch failed';
      setError(message);
      setOffline(true);
      try {
        const alt = await fetchAlerts();
        if (alt.alerts?.length) {
          setDashboard({
            updatedAt: alt.updatedAt,
            patientCount: alt.count,
            alertCount: alt.count,
            patients: alt.alerts,
            alerts: alt.alerts,
          });
        }
      } catch {
        // keep primary error
      }
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
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void loadDashboard();
    const interval = setInterval(() => void loadDashboard(), pollMs);

    const sock = connectRealtimeSocket(
      (payload) => {
        setSocketConnected(true);
        mergeVital(payload);
      },
      () => {
        void loadDashboard();
      }
    );

    sock.on('connect', () => setSocketConnected(true));
    sock.on('disconnect', () => setSocketConnected(false));

    return () => {
      clearInterval(interval);
      disconnectRealtimeSocket();
    };
  }, [loadDashboard, mergeVital, pollMs]);

  return {
    dashboard,
    patients: dashboard?.patients ?? [],
    alerts: dashboard?.alerts ?? [],
    loading,
    refreshing,
    error,
    offline,
    socketConnected,
    lastUpdated,
    refresh,
  };
}
