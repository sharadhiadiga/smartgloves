import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type PatientStatus = 'Low' | 'Moderate' | 'High' | 'Critical' | 'Unknown';

export interface Patient {
  id: string;
  name: string;
  temperature: number | null;
  heartRate: number | null;
  spo2: number | null;
  gsr: number | null;
  stress: number | null;
  status: PatientStatus;
  issues: string[];
  measures: string[];
  recommendation: string;
  timestamp: string;
}

const STATUS_STYLES: Record<PatientStatus, { border: string; background: string; pill: string }> = {
  Low: {
    border: '#16A34A',
    background: '#062F1A',
    pill: '#4ADE80',
  },
  Moderate: {
    border: '#D97706',
    background: '#1E2A0F',
    pill: '#FACC15',
  },
  High: {
    border: '#EA580C',
    background: '#2B1A07',
    pill: '#FB923C',
  },
  Critical: {
    border: '#DC2626',
    background: '#2F1212',
    pill: '#F87171',
  },
  Unknown: {
    border: '#475569',
    background: '#0F172A',
    pill: '#94A3B8',
  },
};

const formatValue = (value: number | null, suffix = '') => {
  return typeof value === 'number' ? `${value}${suffix}` : '--';
};

const PatientCard = ({ patient }: { patient: Patient }) => {
  const statusStyle = STATUS_STYLES[patient.status] ?? STATUS_STYLES.Unknown;

  return (
    <View style={[styles.card, { borderColor: statusStyle.border, backgroundColor: statusStyle.background }]}> 
      <View style={styles.header}>
        <View>
          <Text style={styles.name}>{patient.name}</Text>
          <Text style={styles.subtleText}>{patient.id}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.pill }]}> 
          <Text style={styles.statusText}>{patient.status}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.vitalLabel}>🌡 Temperature</Text>
        <Text style={styles.vitalValue}>{formatValue(patient.temperature, '°C')}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.vitalLabel}>❤️ Heart Rate</Text>
        <Text style={styles.vitalValue}>{formatValue(patient.heartRate, ' bpm')}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.vitalLabel}>🫁 SpO₂</Text>
        <Text style={styles.vitalValue}>{formatValue(patient.spo2, ' %')}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.vitalLabel}>⚡ GSR</Text>
        <Text style={styles.vitalValue}>{formatValue(patient.gsr)}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.vitalLabel}>Stress Level</Text>
        <Text style={styles.vitalValue}>{patient.stress !== null ? `${patient.stress}%` : '--'}</Text>
      </View>

      {patient.issues.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠ Issues</Text>
          {patient.issues.map((issue, index) => (
            <Text key={index} style={styles.bulletItem}>
              • {issue}
            </Text>
          ))}
        </View>
      )}

      {patient.measures.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 Measures</Text>
          {patient.measures.map((measure, index) => (
            <Text key={index} style={styles.bulletItem}>
              • {measure}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.recommendationBox}>
        <Text style={styles.recommendationLabel}>🧠 Recommendation</Text>
        <Text style={styles.recommendationText}>{patient.recommendation}</Text>
      </View>

      <Text style={styles.timestamp}>⏱ {patient.timestamp}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtleText: {
    color: '#94A3B8',
    marginTop: 4,
    fontSize: 13,
  },
  statusBadge: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#020617',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  vitalLabel: {
    color: '#E2E8F0',
    fontSize: 14,
  },
  vitalValue: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 14,
    borderRadius: 2,
  },
  section: {
    marginTop: 10,
  },
  sectionTitle: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  bulletItem: {
    color: '#CBD5E1',
    fontSize: 14,
    marginBottom: 6,
    marginLeft: 10,
  },
  recommendationBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#334155',
  },
  recommendationLabel: {
    color: '#A5B4FC',
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '700',
  },
  recommendationText: {
    color: '#F8FAFC',
    fontSize: 14,
    lineHeight: 20,
  },
  timestamp: {
    marginTop: 14,
    color: '#94A3B8',
    fontSize: 12,
  },
});

export default PatientCard;
