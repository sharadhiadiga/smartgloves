import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface HealthData {
  temperature?: number | null;
  heartRate?: number | null;
  spo2?: number | null;
  gsr?: number | null;
  status?: string;
  predictionLevel?: string;
  stress?: number | null;
  issues?: string[];
  measures?: string[];
  timestamp?: string;
}

const initialHealthData: HealthData = {
  temperature: null,
  heartRate: null,
  spo2: null,
  gsr: null,
  status: 'Waiting...',
  predictionLevel: 'Waiting...',
  stress: 0,
  issues: [],
  measures: [],
  timestamp: undefined,
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://10.19.151.76:5000';
const LATEST_ENDPOINT = `${API_BASE_URL}/api/latest`;

export default function HomeScreen() {
  const [data, setData] = useState<HealthData>(initialHealthData);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      console.log('[FETCH] Attempting to fetch from', LATEST_ENDPOINT);

      const response = await fetch(LATEST_ENDPOINT, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('[FETCH] Response received, status:', response.status);

      const result = await response.json();
      console.log('DATA RECEIVED:', result);

      const payload = result?.success === true && result?.data ? result.data : result ?? {};
      const nextData: HealthData = {
        ...initialHealthData,
        ...payload,
        status: payload?.status ?? payload?.predictionLevel ?? 'Waiting...',
        predictionLevel: payload?.predictionLevel ?? payload?.status ?? 'Waiting...',
        stress: typeof payload?.stress === 'number' ? payload.stress : 0,
        issues: Array.isArray(payload?.issues) ? payload.issues : [],
        measures: Array.isArray(payload?.measures) ? payload.measures : [],
      };

      setData({ ...nextData });
      setError(null);
    } catch (err: any) {
      console.error('[ERROR] Fetch error:', err?.message ?? err);
      setError(err?.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const interval = setInterval(() => {
      fetchData();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status?: string | null): string => {
    if (!status) return '#e2e8f0';
    switch (status.toLowerCase()) {
      case 'normal':
        return '#22c55e';
      case 'high stress':
        return '#f59e0b';
      case 'abnormal':
        return '#ef4444';
      default:
        return '#e2e8f0';
    }
  };

  const safeRender = (value: number | null | undefined, defaultText: string = '--'): string => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return defaultText;
    }
    return String(value);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Health Monitor</Text>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#60a5fa" />
          <Text style={styles.loadingText}>Loading health data...</Text>
        </View>
      )}

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      ) : null}

      <View style={styles.dataContainer}>
        <Text style={styles.value}>
          🌡 temp: <Text style={styles.valueHighlight}>{safeRender(data?.temperature)}°C</Text>
        </Text>

        <Text style={styles.value}>
          ❤️ heartrate: <Text style={styles.valueHighlight}>{safeRender(data?.heartRate)} bpm</Text>
        </Text>

        <Text style={styles.value}>
          🫁 SpO₂: <Text style={styles.valueHighlight}>{safeRender(data?.spo2)}%</Text>
        </Text>

        <Text style={styles.value}>
          🧠 GSR: <Text style={styles.valueHighlight}>{safeRender(data?.gsr)} µS</Text>
        </Text>

        <Text style={[styles.status, { color: getStatusColor(data?.status) }]}>Status: {data?.status ?? 'Waiting...'}</Text>

        <Text style={styles.sectionTitle}>issues</Text>
        <Text style={styles.listText}>
          {data?.issues?.length ? data.issues.map((issue) => `- ${issue}`).join('\n') : '- No active issue'}
        </Text>

        <Text style={styles.sectionTitle}>measures</Text>
        <Text style={styles.listText}>
          {data?.measures?.length ? data.measures.map((measure) => `- ${measure}`).join('\n') : '- No active measure'}
        </Text>

        <Text style={styles.timestamp}>
          Last updated: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '--'}
        </Text>
      </View>

      <Text style={styles.debugInfo}>
        {loading ? 'Refreshing every 2 seconds...' : error ? 'Offline' : 'Connected'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    color: '#ffffff',
    marginBottom: 30,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 12,
  },
  errorContainer: {
    width: '100%',
    backgroundColor: '#7f1d1d',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#fca5a5',
  },
  dataContainer: {
    width: '100%',
    backgroundColor: '#1e293b',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderTopWidth: 2,
    borderTopColor: '#3b82f6',
  },
  value: {
    fontSize: 18,
    color: '#cbd5e1',
    marginVertical: 10,
    fontWeight: '500',
  },
  valueHighlight: {
    fontSize: 20,
    color: '#60a5fa',
    fontWeight: '700',
  },
  status: {
    fontSize: 24,
    marginTop: 20,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  timestamp: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 16,
    color: '#e2e8f0',
    marginTop: 14,
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  listText: {
    fontSize: 14,
    color: '#cbd5e1',
    marginTop: 8,
    lineHeight: 20,
  },
  debugInfo: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 20,
  },
});