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
import { getApiBaseUrl } from '@/constants/api';

type PatientStatusFilter = 'All' | 'Critical' | 'High' | 'Moderate' | 'Low';
const STATUS_FILTERS: PatientStatusFilter[] = ['All', 'Critical', 'High', 'Moderate', 'Low'];

const API_BASE_URL = getApiBaseUrl();
const API_ENDPOINT = `${API_BASE_URL}/api/all-patients`;
const API_HEALTH_ENDPOINT = `${API_BASE_URL}/health`;

console.log('[Dashboard] API_BASE_URL (resolved):', API_BASE_URL);
console.log('[Dashboard] Patients endpoint:', API_ENDPOINT);
/** How often the doctor dashboard refetches (same patientId picks up latest reading). */
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

export default function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<PatientStatusFilter>('All');
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef<FlatList<Patient> | null>(null);
  const firstLoadRef = useRef(true);
  const previousPatientIds = useRef<string[]>([]);

  const normalizeStatus = (rawStatus: unknown): Patient['status'] => {
    if (typeof rawStatus !== 'string') {
      return 'Unknown';
    }

    const normalized = rawStatus.trim().toLowerCase();

    if (normalized === 'critical') return 'Critical';
    if (normalized === 'high') return 'High';
    if (normalized === 'moderate') return 'Moderate';
    if (normalized === 'low' || normalized === 'normal') return 'Low';

    return 'Unknown';
  };

  const normalizePatient = useCallback(
    (item: RawPatient): Patient => {
      const resolvedId =
        typeof item?.id === 'string' && item.id.trim().length > 0
          ? item.id
          : typeof item?.patientId === 'string' && item.patientId.trim().length > 0
            ? item.patientId
          : typeof item?._id === 'string' && item._id.trim().length > 0
            ? item._id
            : typeof item?.deviceId === 'string' && item.deviceId.trim().length > 0
              ? item.deviceId
              : 'unknown-id';

      return {
        id: resolvedId,
        name:
          typeof item?.name === 'string' && item.name.trim().length > 0
            ? item.name
            : resolvedId,
        temperature: typeof item?.temperature === 'number' ? item.temperature : null,
        heartRate: typeof item?.heartRate === 'number' ? item.heartRate : null,
        spo2: typeof item?.spo2 === 'number' ? item.spo2 : null,
        gsr: typeof item?.gsr === 'number' ? item.gsr : null,
        stress: typeof item?.stress === 'number' ? item.stress : null,
        status: normalizeStatus(item?.status || item?.severity),
        issues: Array.isArray(item?.issues)
          ? item.issues.filter((issue) => typeof issue === 'string' && issue.trim().length > 0)
          : [],
        measures: Array.isArray(item?.measures)
          ? item.measures.filter((measure) => typeof measure === 'string' && measure.trim().length > 0)
          : [],
        recommendation:
          typeof item?.recommendation === 'string' && item.recommendation.trim().length > 0
            ? item.recommendation
            : '--',
        timestamp: formatPatientTimestamp(item?.timestamp),
      };
    },
    [normalizeStatus]
  );

  const fetchPatients = useCallback(
    async (signal?: AbortSignal) => {
      try {
        if (firstLoadRef.current) {
          setLoading(true);
        }
        console.log('Fetching from:', API_ENDPOINT);

        const response = await fetch(API_ENDPOINT, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal,
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || `Server returned ${response.status}`);
        }

        const json = (await response.json()) as ApiResponse | Array<RawPatient>;
        console.log('Live API Response keys:', Array.isArray(json) ? 'array' : Object.keys(json || {}));
        console.log('Live API Response:', JSON.stringify(json).slice(0, 2000));

        void fetch(API_HEALTH_ENDPOINT, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })
          .then((r) => r.json())
          .then((h) => console.log('[Dashboard] /health:', h))
          .catch(() => undefined);
        const payload: RawPatient[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.patients)
            ? (json.patients as RawPatient[])
            : [];
        const normalized = payload.map(normalizePatient).filter((item) => item.id !== 'unknown-id');
        setPatients(normalized);
        setLastUpdated(new Date().toISOString());
        setRetryCount(0);
        setOffline(false);
        setError(null);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return;
        }
        console.log('Fetch error:', err);
        setRetryCount((current) => current + 1);
        setOffline(true);
        const hint =
          err?.message === 'Network request failed'
            ? `${err.message} — use same Wi‑Fi as this machine, allow port 5000, backend base ${API_BASE_URL} (Node must listen on 0.0.0.0)`
            : err?.message ?? 'Unable to fetch patient data';
        setError(hint);
      } finally {
        if (firstLoadRef.current) {
          setLoading(false);
          firstLoadRef.current = false;
        }
        setRefreshing(false);
      }
    },
    [normalizePatient]
  );

  useEffect(() => {
    const controller = new AbortController();

    fetchPatients(controller.signal);

    const interval = setInterval(() => {
      void fetchPatients();
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [fetchPatients]);

  useEffect(() => {
    const ids = patients.map((patient) => patient.id);

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
    fetchPatients(controller.signal).finally(() => controller.abort());
  }, [fetchPatients]);

  const renderPatient = useCallback(
    ({ item }: { item: Patient }) => {
      return <PatientCard patient={item} />;
    },
    []
  );

  const keyExtractor = useCallback((item: Patient) => item.id, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <Text style={styles.title}>Doctor Dashboard</Text>
        <Text style={styles.subtitle}>Real-time patient vitals and recommendations</Text>
        <Text style={styles.networkInfo}>API: {API_BASE_URL}</Text>
        <Text style={styles.networkInfo}>
          Status: {offline ? 'Offline/Reconnecting' : 'Connected'}
          {lastUpdated ? ` | Updated: ${new Date(lastUpdated).toLocaleTimeString()}` : ''}
        </Text>
        {retryCount > 0 && <Text style={styles.retryText}>Retries: {retryCount}</Text>}

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
            <Text style={styles.loadingText}>Loading live patients...</Text>
          </View>
        )}

        {error && !loading && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Unable to load patient dashboard.</Text>
            <Text style={styles.errorDetail}>{error}</Text>
          </View>
        )}

        <FlatList
          ref={listRef}
          data={filteredPatients}
          renderItem={renderPatient}
          keyExtractor={keyExtractor}
          maxToRenderPerBatch={8}
          windowSize={7}
          initialNumToRender={6}
          removeClippedSubviews
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.emptyText}>
                {error ? 'Using last fetched data, or wait for retry.' : 'No patients yet'}
              </Text>
            ) : null
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020617',
  },
  page: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    backgroundColor: '#020617',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    color: '#94A3B8',
    marginBottom: 16,
  },
  networkInfo: {
    color: '#93C5FD',
    fontSize: 12,
    marginBottom: 4,
  },
  retryText: {
    color: '#FCA5A5',
    fontSize: 12,
    marginBottom: 10,
  },
  searchContainer: {
    borderRadius: 14,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  searchInput: {
    height: 44,
    paddingHorizontal: 16,
    color: '#F8FAFC',
    fontSize: 15,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
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
  filterButtonActive: {
    backgroundColor: '#4338CA',
    borderColor: '#6366F1',
  },
  filterButtonPressed: {
    opacity: 0.85,
  },
  filterText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#94A3B8',
  },
  errorContainer: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#831843',
  },
  errorText: {
    color: '#F8FAFC',
    fontWeight: '700',
    marginBottom: 6,
  },
  errorDetail: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 20,
  },
});
