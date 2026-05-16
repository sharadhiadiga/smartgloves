import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import PatientCard, { Patient } from '@/components/PatientCard';
import { getApiBaseUrl } from '@/constants/api';

const API_BASE_URL = getApiBaseUrl();

type RawPatient = Partial<Patient> & {
  _id?: string;
  patientId?: string;
  deviceId?: string;
  severity?: string;
};

function normalizeStatus(rawStatus: unknown): Patient['status'] {
  if (typeof rawStatus !== 'string') return 'Unknown';
  const normalized = rawStatus.trim().toLowerCase();
  if (normalized === 'critical') return 'Critical';
  if (normalized === 'high') return 'High';
  if (normalized === 'moderate') return 'Moderate';
  if (normalized === 'low' || normalized === 'normal') return 'Low';
  return 'Unknown';
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

export default function PatientDetailsScreen() {
  const router = useRouter();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const resolvedId = typeof patientId === 'string' ? patientId : '';

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const normalizePatient = useCallback((item: RawPatient, fallbackId: string): Patient => {
    const id =
      typeof item?.patientId === 'string' && item.patientId.trim().length > 0
        ? item.patientId
        : fallbackId;

    return {
      id,
      name:
        typeof item?.name === 'string' && item.name.trim().length > 0 ? item.name : id,
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
        ? item.measures.filter((m) => typeof m === 'string' && m.trim().length > 0)
        : [],
      recommendation:
        typeof item?.recommendation === 'string' && item.recommendation.trim().length > 0
          ? item.recommendation
          : '--',
      timestamp: formatPatientTimestamp(item?.timestamp),
    };
  }, []);

  const fetchPatient = useCallback(async () => {
    if (!resolvedId) {
      setError('Missing patient ID');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = `${API_BASE_URL}/api/all-patients`;
      console.log('[PatientDetails] Fetching', url, 'for', resolvedId);

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const json = (await response.json()) as { patients?: RawPatient[] };
      const list = Array.isArray(json?.patients) ? json.patients : [];
      const match = list.find(
        (p) =>
          String(p.patientId || p.deviceId || p._id || '') === resolvedId ||
          String(p._id || '') === resolvedId
      );

      if (!match) {
        setError('Patient not found in latest records');
        setPatient(null);
      } else {
        setPatient(normalizePatient(match, resolvedId));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load patient';
      console.error('[PatientDetails] Error:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [normalizePatient, resolvedId]);

  useEffect(() => {
    void fetchPatient();
  }, [fetchPatient]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Patient Details', headerShown: true }} />
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.muted}>Loading patient...</Text>
        </View>
      )}

      {error && !loading && (
        <View style={styles.centered}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void fetchPatient()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {patient && !loading && (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.screenTitle}>Patient Details</Text>
          <PatientCard patient={patient} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020617',
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backText: {
    color: '#93C5FD',
    fontSize: 16,
    fontWeight: '600',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 16,
    paddingHorizontal: 18,
  },
  scroll: {
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  muted: {
    color: '#94A3B8',
    marginTop: 12,
  },
  error: {
    color: '#FCA5A5',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#4338CA',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryText: {
    color: '#FFF',
    fontWeight: '700',
  },
});
