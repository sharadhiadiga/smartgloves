import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VITAL_LABELS } from '@/constants/vitalLabels';
import { formatUiLabel } from '@/utils/vitals';

interface Props {
  temperature: number | null;
  heartRate: number | null;
  spo2: number | null;
  gsr: number | null;
  overallRisk: string;
}

export default function VitalsSummary({ temperature, heartRate, spo2, gsr, overallRisk }: Props) {
  return (
    <View style={styles.grid}>
      <View style={styles.cell}>
        <Text style={styles.label}>{VITAL_LABELS.temperature}</Text>
        <Text style={styles.value}>
          {temperature != null ? `${temperature}°C` : '--'}
        </Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.label}>{VITAL_LABELS.heartRate}</Text>
        <Text style={styles.value}>
          {heartRate != null ? `${heartRate} bpm` : '--'}
        </Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.label}>{VITAL_LABELS.spo2}</Text>
        <Text style={styles.value}>{spo2 != null ? `${spo2}%` : '--'}</Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.label}>{VITAL_LABELS.gsr}</Text>
        <Text style={styles.value}>{gsr != null ? `${gsr}` : '--'}</Text>
      </View>
      <View style={[styles.riskBar, riskColor(overallRisk)]}>
        <Text style={styles.riskText}>Risk: {formatUiLabel(overallRisk)}</Text>
      </View>
    </View>
  );
}

function riskColor(risk: string) {
  const r = risk.toLowerCase();
  if (r === 'critical') return { backgroundColor: '#7F1D1D' };
  if (r === 'high') return { backgroundColor: '#9A3412' };
  if (r === 'moderate') return { backgroundColor: '#854D0E' };
  return { backgroundColor: '#14532D' };
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 12,
  },
  cell: {
    width: '47%',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  label: { color: '#94A3B8', fontSize: 12 },
  value: { color: '#F8FAFC', fontSize: 18, fontWeight: '800', marginTop: 4 },
  riskBar: {
    width: '100%',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  riskText: { color: '#F8FAFC', fontWeight: '700', textAlign: 'center' },
});
