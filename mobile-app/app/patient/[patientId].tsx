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
import { fetchPatientLatest } from '@/services/api';
import { formatUiLabel, normalizeRisk, vitalToPatient } from '@/utils/vitals';

type RawPatient = Partial<Patient> & {
  _id?: string;
  patientId?: string;
  deviceId?: string;
  severity?: string;
  temperatureCondition?: string;
  heartRateCondition?: string;
  spo2Condition?: string;
  gsrCondition?: string;
};

function normalizeStatus(rawStatus: unknown): Patient['status'] {
  return normalizeRisk(rawStatus);
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

  const fetchPatient = useCallback(async () => {
    if (!resolvedId) {
      setError('Missing patient ID');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const match = await fetchPatientLatest(resolvedId);
      if (!match) {
        setError('Patient not found in latest records');
        setPatient(null);
      } else {
        setPatient(vitalToPatient(match));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load patient';
      console.error('[PatientDetails] Error:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [resolvedId]);

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
