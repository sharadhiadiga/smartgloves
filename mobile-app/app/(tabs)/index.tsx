import React, { useMemo, useState } from 'react';
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
import AlertCard from '@/components/AlertCard';
import ConnectionIndicator from '@/components/ConnectionIndicator';
import PatientCard, { Patient } from '@/components/PatientCard';
import VitalsSummary from '@/components/VitalsSummary';
import { useRealtimeDashboard } from '@/hooks/useRealtimeDashboard';
import { vitalToPatient } from '@/utils/vitals';

type Filter = 'All' | 'Critical' | 'High' | 'Moderate' | 'Normal';

export default function DoctorDashboardScreen() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('All');

  const {
    patients,
    alerts,
    loading,
    refreshing,
    error,
    offline,
    socketConnected,
    lastUpdated,
    refresh,
  } = useRealtimeDashboard();

  const patientModels: Patient[] = useMemo(() => patients.map(vitalToPatient), [patients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patientModels.filter((p) => {
      const risk = (p.overallRiskLevel || p.status).toString();
      const matchFilter =
        filter === 'All' ||
        risk.toLowerCase() === filter.toLowerCase() ||
        (filter === 'Normal' && (risk === 'Low' || risk === 'Normal'));
      const matchSearch =
        !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
  }, [patientModels, search, filter]);

  const headline = patientModels[0];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#7C3AED" />
        }
      >
        <Text style={styles.title}>Doctor Dashboard</Text>
        <Text style={styles.sub}>ESP32 → WiFi → Cloud API → Live vitals</Text>

        <ConnectionIndicator
          offline={offline}
          socketConnected={socketConnected}
          lastUpdated={lastUpdated}
          patientCount={patientModels.length}
        />

        {headline ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Live overview — {headline.name}</Text>
            <VitalsSummary
              temperature={headline.temperature}
              heartRate={headline.heartRate}
              spo2={headline.spo2}
              gsr={headline.gsr}
              overallRisk={headline.overallRiskLevel || headline.status}
            />
          </View>
        ) : null}

        {alerts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Alerts ({alerts.length})</Text>
            {alerts.slice(0, 5).map((a) => (
              <AlertCard key={`${a.patientId}-${a.timestamp}`} alert={a} />
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All patients</Text>
          <TextInput
            style={styles.search}
            placeholder="Search patient…"
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
          <View style={styles.filters}>
            {(['All', 'Critical', 'High', 'Moderate', 'Normal'] as Filter[]).map((f) => (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.chip, filter === f && styles.chipOn]}
              >
                <Text style={[styles.chipText, filter === f && styles.chipTextOn]}>{f}</Text>
              </Pressable>
            ))}
          </View>

          {loading && (
            <ActivityIndicator color="#7C3AED" style={{ marginVertical: 24 }} />
          )}
          {error && !loading && <Text style={styles.err}>{error}</Text>}
          {!loading &&
            filtered.map((p) => (
              <View key={p.id} style={{ marginBottom: 12 }}>
                <PatientCard patient={p} />
              </View>
            ))}
          {!loading && filtered.length === 0 && (
            <Text style={styles.empty}>No patients — power on ESP32 with WiFi configured</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#020617' },
  content: { padding: 18, paddingBottom: 100 },
  title: { fontSize: 28, fontWeight: '900', color: '#F8FAFC' },
  sub: { color: '#94A3B8', marginTop: 6, marginBottom: 8 },
  summaryCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  summaryTitle: { color: '#E2E8F0', fontWeight: '700', marginBottom: 4 },
  section: { marginTop: 20 },
  sectionTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800', marginBottom: 10 },
  search: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12, gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipOn: { backgroundColor: '#4338CA', borderColor: '#6366F1' },
  chipText: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  chipTextOn: { color: '#FFF' },
  err: { color: '#FCA5A5', marginVertical: 12 },
  empty: { color: '#94A3B8', textAlign: 'center', marginTop: 24 },
});
