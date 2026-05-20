import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { API_BASE_URL } from '@/constants/config';

interface Props {
  offline: boolean;
  socketConnected: boolean;
  lastUpdated: string | null;
  patientCount: number;
}

export default function ConnectionIndicator({
  offline,
  socketConnected,
  lastUpdated,
  patientCount,
}: Props) {
  const cloudOk = !offline;
  const realtime = socketConnected ? 'Socket live' : 'Polling';

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Cloud connection</Text>
      <Text style={styles.line}>API: {API_BASE_URL}</Text>
      <View style={styles.row}>
        <View style={[styles.dot, cloudOk ? styles.dotOk : styles.dotBad]} />
        <Text style={styles.line}>{cloudOk ? 'Backend reachable' : 'Offline / error'}</Text>
      </View>
      <View style={styles.row}>
        <View style={[styles.dot, socketConnected ? styles.dotOk : styles.dotWarn]} />
        <Text style={styles.line}>Realtime: {realtime}</Text>
      </View>
      <Text style={styles.line}>
        Patients: {patientCount}
        {lastUpdated ? ` · ${new Date(lastUpdated).toLocaleTimeString()}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  title: { color: '#F8FAFC', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  line: { color: '#9CA3AF', fontSize: 12, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  dotOk: { backgroundColor: '#22C55E' },
  dotWarn: { backgroundColor: '#EAB308' },
  dotBad: { backgroundColor: '#EF4444' },
});
