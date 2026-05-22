import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { VitalReading } from '@/types/vitals';
import { VITAL_LABELS } from '@/constants/vitalLabels';
import { formatUiLabel } from '@/utils/vitals';

export default function AlertCard({ alert }: { alert: VitalReading }) {
  const risk = formatUiLabel(alert.overallRiskLevel || alert.status || 'High');
  return (
    <View style={styles.card}>
      <Text style={styles.title}>🚨 {alert.name || alert.patientId}</Text>
      <Text style={styles.sub}>{alert.patientId} · {risk}</Text>
      <Text style={styles.vitals}>
        {VITAL_LABELS.temperature}: {alert.temperature}°C · {VITAL_LABELS.heartRate}: {alert.heartRate}{' '}
        bpm · {VITAL_LABELS.spo2}: {alert.spo2}% · {VITAL_LABELS.gsr}: {alert.gsr}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#7F1D1D',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  title: { color: '#FEE2E2', fontWeight: '800', fontSize: 15 },
  sub: { color: '#FCA5A5', fontSize: 12, marginTop: 4 },
  vitals: { color: '#FECACA', fontSize: 12, marginTop: 8 },
});
