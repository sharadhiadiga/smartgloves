import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import PatientCard, { Patient } from '@/components/PatientCard';
import { useRealtimeDashboard } from '@/hooks/useRealtimeDashboard';
import { formatUiLabel, vitalToPatient } from '@/utils/vitals';

export default function PatientDashboardScreen() {
  const { patients, loading, refreshing, error, refresh } = useRealtimeDashboard();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const models: Patient[] = useMemo(() => patients.map(vitalToPatient), [patients]);
  const selected = models.find((p) => p.id === selectedId) ?? models[0] ?? null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#7C3AED" />
        }
      >
        <Text style={styles.title}>Patient Dashboard</Text>
        <Text style={styles.sub}>Realtime vitals from cloud API (1s refresh)</Text>

        {loading && <ActivityIndicator color="#7C3AED" style={{ marginVertical: 20 }} />}
        {error && <Text style={styles.err}>{error}</Text>}

        {selected && (
          <View style={styles.detail}>
            <PatientCard patient={selected} />
          </View>
        )}

        <Text style={styles.listTitle}>All patients ({models.length})</Text>
        {models.map((p) => (
          <Pressable key={p.id} onPress={() => setSelectedId(p.id)}>
            <View style={[styles.listItem, selectedId === p.id && styles.listItemOn]}>
              <Text style={styles.listName}>{p.name}</Text>
              <Text style={styles.listMeta}>
                {formatUiLabel(p.overallRiskLevel || p.status)} · {p.timestamp}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#020617' },
  content: { padding: 18, paddingBottom: 100 },
  title: { fontSize: 26, fontWeight: '900', color: '#F8FAFC' },
  sub: { color: '#94A3B8', marginTop: 6, marginBottom: 16 },
  detail: { marginBottom: 16 },
  listTitle: { color: '#E2E8F0', fontWeight: '700', marginBottom: 10 },
  listItem: {
    padding: 14,
    backgroundColor: '#111827',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  listItemOn: { borderColor: '#6366F1' },
  listName: { color: '#F8FAFC', fontWeight: '700' },
  listMeta: { color: '#94A3B8', fontSize: 12, marginTop: 4 },
  err: { color: '#FCA5A5', marginBottom: 12 },
});
