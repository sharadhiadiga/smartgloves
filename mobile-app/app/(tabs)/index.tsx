import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import PatientCard, { Patient } from '@/components/PatientCard';
import BlePanel from '@/components/BlePanel';
import { getApiBaseUrl } from '@/constants/api';
import { useBleDashboard } from '@/hooks/useBleDashboard';
import type { PostSensorResponse } from '@/services/apiService';
import type { BleSensorPacket } from '@/services/bleService';
import { notifyCriticalIfTransition } from '@/services/notificationService';

type PatientStatusFilter = 'All' | 'Critical' | 'High' | 'Moderate' | 'Low';
const STATUS_FILTERS: PatientStatusFilter[] = ['All', 'Critical', 'High', 'Moderate', 'Low'];

const API_BASE_URL = getApiBaseUrl();
const API_ENDPOINT = `${API_BASE_URL}/api/all-patients`;
const POLL_INTERVAL_MS = 2000;

interface ApiResponse {
  patients?: Array<Partial<Patient>>;
}

interface RawPatient extends Partial<Patient> {
  _id?: string;
  deviceId?: string;
  patientId?: string;
  severity?: string;
}

function formatPatientTimestamp(ts: unknown): string {
  if (ts == null) return '--';
  if (typeof ts === 'string' && ts.trim().length > 0) {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? ts : d.toLocaleString();
  }
  if (typeof ts === 'number' && Number.isFinite(ts)) {
    return new Date(ts).toLocaleString();
  }
  return '--';
}

function normalizeStatus(rawStatus: unknown): Patient['status'] {
  if (typeof rawStatus !== 'string') return 'Unknown';
  const normalized = rawStatus.trim().toLowerCase();
  if (normalized === 'critical') return 'Critical';
  if (normalized === 'high') return 'High';
  if (normalized === 'moderate') return 'Moderate';
  if (normalized === 'low' || normalized === 'normal') return 'Low';
  return 'Unknown';
}

function rawToPatient(item: RawPatient): Patient {
  const resolvedId =
    typeof item?.patientId === 'string' && item.patientId.trim().length > 0
      ? item.patientId
      : typeof item?.id === 'string' && item.id.trim().length > 0
        ? item.id
        : typeof item?._id === 'string' && item._id.trim().length > 0
          ? item._id
          : typeof item?.deviceId === 'string' && item.deviceId.trim().length > 0
            ? item.deviceId
            : 'unknown-id';

  return {
    id: resolvedId,
    name: typeof item?.name === 'string' && item.name.trim().length > 0 ? item.name : resolvedId,
    temperature: typeof item?.temperature === 'number' ? item.temperature : null,
    heartRate: typeof item?.heartRate === 'number' ? item.heartRate : null,
    spo2: typeof item?.spo2 === 'number' ? item.spo2 : null,
    gsr: typeof item?.gsr === 'number' ? item.gsr : null,
    stress: typeof item?.stress === 'number' ? item.stress : null,
    status: normalizeStatus(item?.status || item?.severity),
    issues: Array.isArray(item?.issues)
      ? item.issues.filter((i) => typeof i === 'string' && i.trim().length > 0)
      : [],
    measures: Array.isArray(item?.measures)
      ? item.measures.filter((m) => typeof m === 'string' && m.trim().length > 0)
      : [],
    recommendation:
      typeof item?.recommendation === 'string' && item.recommendation.trim().length > 0
        ? item.recommendation
        : '--',
    timestamp: formatPatientTimestamp(item?.timestamp),
  };
}

function patientFromBackendEntry(
  packet: BleSensorPacket,
  data: Record<string, unknown>
): Patient {
  return rawToPatient({
    patientId: String(data.patientId ?? packet.patientId),
    name: typeof data.name === 'string' ? data.name : packet.patientId,
    temperature: typeof data.temperature === 'number' ? data.temperature : packet.temperature,
    heartRate: typeof data.heartRate === 'number' ? data.heartRate : packet.heartRate,
    spo2: typeof data.spo2 === 'number' ? data.spo2 : packet.spo2,
    gsr: typeof data.gsr === 'number' ? data.gsr : packet.gsr,
    stress: typeof data.stress === 'number' ? data.stress : null,
    status: data.status,
    severity: data.severity,
    issues: data.issues as string[] | undefined,
    measures: data.measures as string[] | undefined,
    recommendation: data.recommendation as string | undefined,
    timestamp: data.timestamp,
  });
}

function patientFromLivePacket(packet: BleSensorPacket): Patient {
  return {
    id: packet.patientId,
    name: packet.patientId,
    temperature: packet.temperature,
    heartRate: packet.heartRate,
    spo2: packet.spo2,
    gsr: packet.gsr,
    stress: null,
    status: 'Unknown',
    issues: [],
    measures: [],
    recommendation: 'Sending to backend…',
    timestamp: new Date().toLocaleString(),
  };
}

export default function DashboardScreen() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<PatientStatusFilter>('All');
  const [refreshing, setRefreshing] = useState(false);
  const [criticalBanner, setCriticalBanner] = useState<string | null>(null);

  const listRef = useRef<FlatList<Patient> | null>(null);
  const firstLoadRef = useRef(true);
  const previousPatientIds = useRef<string[]>([]);
  const fetchPatientsRef = useRef<((signal?: AbortSignal) => Promise<void>) | null>(null);

  const triggerCriticalNotification = useCallback((patient: Patient) => {
    void notifyCriticalIfTransition({
      id: patient.id,
      name: patient.name,
      status: patient.status,
    }).catch((err) => {
      console.log('[Dashboard] Critical notification error:', err);
    });
  }, []);

  const mergePatient = useCallback((incoming: Patient) => {
    setPatients((prev) => {
      const idx = prev.findIndex((p) => p.id === incoming.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...incoming };
        return next;
      }
      return [incoming, ...prev];
    });
    if (incoming.status === 'Critical') {
      triggerCriticalNotification(incoming);
    }
  }, [triggerCriticalNotification]);

  const handleBackendResponse = useCallback(
    (packet: BleSensorPacket, response: PostSensorResponse) => {
      const saved = response.data;
      if (saved && typeof saved === 'object') {
        const merged = patientFromBackendEntry(packet, saved);
        mergePatient(merged);
        if (merged.status === 'Critical') {
          setCriticalBanner(`CRITICAL: ${merged.name} (${merged.id}) — seek immediate attention`);
        }
      }
      void fetchPatientsRef.current?.();
    },
    [mergePatient]
  );

  const ble = useBleDashboard({
    onBackendResponse: handleBackendResponse,
    onPipelineError: (message) => setError(message),
  });

  useEffect(() => {
    if (ble.livePacket) {
      mergePatient(patientFromLivePacket(ble.livePacket));
    }
  }, [ble.livePacket, mergePatient]);

  const fetchPatients = useCallback(async (signal?: AbortSignal) => {
    try {
      if (firstLoadRef.current) setLoading(true);
      console.log('[Dashboard] Fetching patients:', API_ENDPOINT);

      const response = await fetch(API_ENDPOINT, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal,
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Server returned ${response.status}`);
      }

      const json = (await response.json()) as ApiResponse | Array<RawPatient>;
      const payload: RawPatient[] = Array.isArray(json)
        ? json
        : Array.isArray(json?.patients)
          ? json.patients
          : [];

      const normalized = payload.map(rawToPatient).filter((p) => p.id !== 'unknown-id');
      setPatients(normalized);

      for (const p of normalized) {
        if (p.status === 'Critical') {
          void notifyCriticalIfTransition({
            id: p.id,
            name: p.name,
            status: p.status,
          });
        }
      }

      setLastUpdated(new Date().toISOString());
      setRetryCount(0);
      setOffline(false);
      setError(null);

      const critical = normalized.find((p) => p.status === 'Critical');
      if (critical) {
        setCriticalBanner(`CRITICAL: ${critical.name} (${critical.id})`);
      } else if (!ble.livePacket) {
        setCriticalBanner(null);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Unable to fetch patient data';
      console.log('[Dashboard] Fetch error:', message);
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
  }, [ble.livePacket]);

  fetchPatientsRef.current = fetchPatients;

  useEffect(() => {
    const controller = new AbortController();
    void fetchPatients(controller.signal);
    const interval = setInterval(() => void fetchPatients(), POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [fetchPatients]);

  useEffect(() => {
    const ids = patients.map((p) => p.id);
    if (previousPatientIds.current.length > 0 && ids.join(',') !== previousPatientIds.current.join(',')) {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
    previousPatientIds.current = ids;
  }, [patients]);

  const filteredPatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return patients.filter((patient) => {
      const statusMatch = filterStatus === 'All' || patient.status === filterStatus;
      const searchMatch =
        query.length === 0 ||
        patient.name.toLowerCase().includes(query) ||
        patient.id.toLowerCase().includes(query);
      return statusMatch && searchMatch;
    });
  }, [filterStatus, patients, searchQuery]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    const controller = new AbortController();
    void fetchPatients(controller.signal).finally(() => controller.abort());
  }, [fetchPatients]);

  const listHeader = useMemo(
    () => (
      <View>
        <Text style={styles.title}>Doctor Dashboard</Text>
        <Text style={styles.subtitle}>ESP32 → BLE → Backend → ML → Live vitals</Text>

        {criticalBanner ? (
          <View style={styles.criticalBanner}>
            <Text style={styles.criticalBannerText}>🚨 {criticalBanner}</Text>
            <Pressable onPress={() => setCriticalBanner(null)}>
              <Text style={styles.dismissText}>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}

        <BlePanel
          bleSupported={ble.bleSupported}
          isScanning={ble.isScanning}
          connectionStatus={ble.connectionStatus}
          connectedDevice={ble.connectedDevice}
          devices={ble.devices}
          livePacket={ble.livePacket}
          lastRaw={ble.lastRaw}
          bleError={ble.bleError}
          postsSent={ble.postsSent}
          bluetoothState={ble.bluetoothState}
          onStartScan={() => void ble.startScan()}
          onStopScan={ble.stopScan}
          onConnect={(d) => void ble.connectToDevice(d)}
          onDisconnect={() => void ble.disconnect()}
        />

        <Text style={styles.networkInfo}>
          Cloud: {offline ? 'Offline' : 'Connected'}
          {lastUpdated ? ` · ${new Date(lastUpdated).toLocaleTimeString()}` : ''}
          {ble.lastBackendAt ? ` · BLE POST ${new Date(ble.lastBackendAt).toLocaleTimeString()}` : ''}
        </Text>
        {retryCount > 0 && <Text style={styles.retryText}>API retries: {retryCount}</Text>}

        <View style={styles.searchContainer}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name or patient ID"
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        <View style={styles.filterRow}>
          {STATUS_FILTERS.map((status) => {
            const isActive = filterStatus === status;
            return (
              <Pressable
                key={status}
                onPress={() => setFilterStatus(status)}
                style={({ pressed }) => [
                  styles.filterButton,
                  isActive && styles.filterButtonActive,
                  pressed && styles.filterButtonPressed,
                ]}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{status}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={styles.loadingText}>Loading patients from cloud…</Text>
          </View>
        )}

        {error && !loading && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>API issue</Text>
            <Text style={styles.errorDetail}>{error}</Text>
          </View>
        )}
      </View>
    ),
    [
      ble,
      criticalBanner,
      error,
      filterStatus,
      lastUpdated,
      loading,
      offline,
      retryCount,
      searchQuery,
    ]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        ref={listRef}
        data={filteredPatients}
        renderItem={({ item }) => <PatientCard patient={item} />}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>
              {error ? 'Connect ESP32 via BLE above, or wait for cloud sync.' : 'No patients yet — connect ESP32'}
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#020617' },
  listContent: { paddingHorizontal: 18, paddingBottom: 24, paddingTop: 18 },
  title: { fontSize: 28, fontWeight: '900', color: '#F8FAFC' },
  subtitle: { marginTop: 6, fontSize: 14, color: '#94A3B8', marginBottom: 12 },
  networkInfo: { color: '#93C5FD', fontSize: 12, marginBottom: 4 },
  retryText: { color: '#FCA5A5', fontSize: 12, marginBottom: 10 },
  criticalBanner: {
    backgroundColor: '#7F1D1D',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  criticalBannerText: { color: '#FEE2E2', fontWeight: '700', fontSize: 14 },
  dismissText: { color: '#FCA5A5', marginTop: 8, fontSize: 12 },
  searchContainer: {
    borderRadius: 14,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  searchInput: { height: 44, paddingHorizontal: 16, color: '#F8FAFC', fontSize: 15 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
    marginRight: 8,
    marginBottom: 8,
  },
  filterButtonActive: { backgroundColor: '#4338CA', borderColor: '#6366F1' },
  filterButtonPressed: { opacity: 0.85 },
  filterText: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF' },
  loadingContainer: { alignItems: 'center', marginVertical: 16 },
  loadingText: { marginTop: 12, color: '#94A3B8' },
  errorContainer: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#831843',
  },
  errorText: { color: '#F8FAFC', fontWeight: '700', marginBottom: 6 },
  errorDetail: { color: '#CBD5E1', fontSize: 13 },
  emptyText: { color: '#94A3B8', fontSize: 15, textAlign: 'center', marginTop: 20 },
});
