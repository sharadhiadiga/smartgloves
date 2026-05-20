import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import PatientCard, { Patient } from '@/components/PatientCard';
import WiFiStatusPanel from '@/components/WiFiStatusPanel';
import { usePatientPolling } from '@/hooks/usePatientPolling';
import type { PatientRecord } from '@/services/apiService';

type PatientStatusFilter = 'All' | 'Critical' | 'High' | 'Moderate' | 'Low';
const STATUS_FILTERS: PatientStatusFilter[] = ['All', 'Critical', 'High', 'Moderate', 'Low'];
const POLL_INTERVAL_MS = 2000;

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

function normalizeCondition(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) return '—';
  return value.trim();
}

function recordToPatient(item: PatientRecord): Patient {
  const resolvedId =
    typeof item?.patientId === 'string' && item.patientId.trim().length > 0
      ? item.patientId
      : typeof item?.id === 'string' && item.id.trim().length > 0
        ? item.id
        : typeof item?._id === 'string' && item._id.trim().length > 0
          ? String(item._id)
          : 'unknown-id';

  return {
    id: resolvedId,
    name: typeof item?.name === 'string' && item.name.trim().length > 0 ? item.name : resolvedId,
    temperature: typeof item?.temperature === 'number' ? item.temperature : null,
    heartRate: typeof item?.heartRate === 'number' ? item.heartRate : null,
    spo2: typeof item?.spo2 === 'number' ? item.spo2 : null,
    gsr: typeof item?.gsr === 'number' ? item.gsr : null,
    temperatureCondition: normalizeCondition(item.temperatureCondition),
    heartRateCondition: normalizeCondition(item.heartRateCondition),
    spo2Condition: normalizeCondition(item.spo2Condition),
    gsrCondition: normalizeCondition(item.gsrCondition),
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

export default function DashboardScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<PatientStatusFilter>('All');
  const [criticalBanner, setCriticalBanner] = useState<string | null>(null);

  const handleCritical = useCallback((patientId: string, name: string) => {
    setCriticalBanner(`CRITICAL: ${name} (${patientId}) — seek immediate attention`);
  }, []);

  const polling = usePatientPolling({
    pollIntervalMs: POLL_INTERVAL_MS,
    onCriticalDetected: handleCritical,
  });

  const patients = useMemo(
    () => polling.records.map(recordToPatient).filter((p) => p.id !== 'unknown-id'),
    [polling.records]
  );

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        refreshControl={
          <RefreshControl
            refreshing={polling.refreshing}
            onRefresh={polling.refresh}
            tintColor="#7C3AED"
          />
        }
      >
        <Text style={styles.title}>Doctor Dashboard</Text>
        <Text style={styles.subtitle}>ESP32 → WiFi → Backend → Live vitals</Text>

        {criticalBanner ? (
          <View style={styles.criticalBanner}>
            <Text style={styles.criticalBannerText}>🚨 {criticalBanner}</Text>
            <Pressable onPress={() => setCriticalBanner(null)}>
              <Text style={styles.dismissText}>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}

        <WiFiStatusPanel
          offline={polling.offline}
          lastUpdated={polling.lastUpdated}
          patientCount={patients.length}
          pollIntervalMs={POLL_INTERVAL_MS}
        />
        {polling.retryCount > 0 && (
          <Text style={styles.retryText}>API retries: {polling.retryCount}</Text>
        )}

        <View style={styles.dashboardCard}>
          <Text style={styles.dashboardTitle}>Patient Dashboard</Text>

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

          {polling.loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#7C3AED" />
              <Text style={styles.loadingText}>Loading patients…</Text>
            </View>
          )}

          {polling.error && !polling.loading && (
            <View style={styles.errorContainer}>
              <Text style={styles.apiErrorTitle}>API issue</Text>
              <Text style={styles.errorDetail}>{polling.error}</Text>
            </View>
          )}

          {!polling.loading &&
            (filteredPatients.length === 0 ? (
              <Text style={styles.emptyText}>
                {polling.error ? 'Waiting for backend…' : 'No patients yet — start ESP32 WiFi uplink'}
              </Text>
            ) : (
              filteredPatients.map((patient) => (
                <View key={patient.id} style={styles.patientCardWrap}>
                  <PatientCard patient={patient} />
                </View>
              ))
            ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#020617' },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 100,
    flexGrow: 1,
  },
  dashboardCard: {
    marginTop: 12,
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#111827',
    borderRadius: 16,
  },
  dashboardTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  title: { fontSize: 28, fontWeight: '900', color: '#F8FAFC' },
  subtitle: { marginTop: 6, fontSize: 14, color: '#94A3B8', marginBottom: 12 },
  retryText: { color: '#FCA5A5', fontSize: 12, marginTop: 8, marginBottom: 4 },
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
  apiErrorTitle: { color: '#F8FAFC', fontWeight: '700', marginBottom: 6 },
  errorDetail: { color: '#CBD5E1', fontSize: 13 },
  patientCardWrap: { marginVertical: 8 },
  emptyText: { color: '#94A3B8', fontSize: 15, textAlign: 'center', marginTop: 20 },
});
