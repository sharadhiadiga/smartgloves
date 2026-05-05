import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface HealthData {
  temperature?: number | null;
  heartRate?: number | null;
  spo2?: number | null;
  gsr?: number | null;
  status?: string;
  level?: string;
  timestamp?: string;
  stress?: number | null;
  issues?: string[];
  measures?: string[];
  recommendation?: string | null;
}

const initialHealthData: HealthData = {
  temperature: null,
  heartRate: null,
  spo2: null,
  gsr: null,
  status: 'Waiting...',
  level: 'Unknown',
  timestamp: undefined,
  stress: null,
  issues: [],
  measures: [],
  recommendation: null,
};

export default function HomeScreen() {
  const [data, setData] = useState<HealthData>(initialHealthData);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = 'http://10.19.151.233:5001/predict';

  const fetchData = async () => {
    setLoading(true);
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const requestBody = {
        temperature: data.temperature ?? 36.8,
        heartRate: data.heartRate ?? 75,
        spo2: data.spo2 ?? 98,
        gsr: data.gsr ?? 1200,
      };

      console.log('[FETCH] Attempting to fetch from', API_URL, requestBody);

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      console.log('[FETCH] Response received, status:', response.status, 'in', responseTime, 'ms');

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[FETCH] Backend error:', response.status, errorText);
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('DATA RECEIVED:', result);

      const nextData: HealthData = {
        ...initialHealthData,
        ...data,
        ...requestBody,
        stress: result?.stress ?? null,
        issues: result?.issues ?? [],
        measures: result?.measures ?? [],
        status: result?.condition ?? data.status ?? 'Waiting...',
        level: result?.level ?? result?.condition ?? data.level ?? 'Unknown',
        recommendation: result?.recommendation ?? null,
      };

      setData({ ...nextData });
      setError(null);
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.error('[ERROR] Fetch timeout after 10 seconds');
        setError('Request timed out');
      } else {
        console.error('[ERROR] Fetch error:', err?.message ?? err);
        setError(err?.message || 'Failed to fetch data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const interval = setInterval(() => {
      fetchData();
    }, 5000);

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
          🌡 Temperature: <Text style={styles.valueHighlight}>{safeRender(data?.temperature)}°C</Text>
        </Text>

        <Text style={styles.value}>
          ❤️ Heart Rate: <Text style={styles.valueHighlight}>{safeRender(data?.heartRate)} bpm</Text>
        </Text>

        <Text style={styles.value}>
          🫁 SpO₂: <Text style={styles.valueHighlight}>{safeRender(data?.spo2)}%</Text>
        </Text>

        <Text style={styles.value}>
          🧠 GSR: <Text style={styles.valueHighlight}>{safeRender(data?.gsr)} µS</Text>
        </Text>

        <Text style={[styles.status, { color: getStatusColor(data?.status) }]}>Status: {data?.status ?? 'Waiting...'}</Text>

        <Text style={styles.value}>
          � Level: <Text style={styles.valueHighlight}>{data?.level ?? 'Unknown'}</Text>
        </Text>

        <Text style={styles.value}>
          �📈 Stress level: <Text style={styles.valueHighlight}>{safeRender(data?.stress)}%</Text>
        </Text>

        <Text style={styles.subHeader}>Issues</Text>
        {data?.issues && data.issues.length > 0 ? (
          data.issues.map((issue, index) => (
            <Text key={`issue-${index}`} style={styles.listItem}>
              • {issue}
            </Text>
          ))
        ) : (
          <Text style={styles.listItem}>No issues reported.</Text>
        )}

        <Text style={styles.subHeader}>Measures</Text>
        {data?.measures && data.measures.length > 0 ? (
          data.measures.map((measure, index) => (
            <Text key={`measure-${index}`} style={styles.listItem}>
              • {measure}
            </Text>
          ))
        ) : (
          <Text style={styles.listItem}>No measures available.</Text>
        )}

        <Text style={styles.timestamp}>
          Last updated: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '--'}
        </Text>
      </View>

      <Text style={styles.debugInfo}>
        {loading ? 'Refreshing every 5 seconds...' : error ? 'Offline' : 'Connected'}
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
  subHeader: {
    fontSize: 16,
    color: '#cbd5e1',
    marginTop: 14,
    fontWeight: '700',
  },
  listItem: {
    fontSize: 14,
    color: '#cbd5e1',
    marginLeft: 6,
    marginTop: 6,
  },
  timestamp: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  debugInfo: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 20,
  },
});