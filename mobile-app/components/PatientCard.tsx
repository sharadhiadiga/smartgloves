import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { VITAL_LABELS } from '@/constants/vitalLabels';
import { formatUiLabel } from '@/utils/vitals';

export type PatientStatus = 'Normal' | 'Moderate' | 'High' | 'Critical' | 'Unknown';

export type OverallRisk = 'Normal' | 'Moderate' | 'High' | 'Critical' | 'Unknown';

export interface Patient {
  id: string;
  name: string;
  overallRiskLevel?: OverallRisk;
  temperature: number | null;
  heartRate: number | null;
  spo2: number | null;
  gsr: number | null;
  temperatureCondition: string;
  heartRateCondition: string;
  spo2Condition: string;
  gsrCondition: string;
  stress: number | null;
  status: PatientStatus;
  issues: string[];
  measures: string[];
  recommendation: string;
  timestamp: string;
}

const NORMAL_STYLE = {
  border: '#16A34A',
  background: '#062F1A',
  pill: '#4ADE80',
};

const STATUS_STYLES: Record<string, { border: string; background: string; pill: string }> = {
  Normal: NORMAL_STYLE,
  Low: NORMAL_STYLE,
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

function conditionStyle(condition: string): { color: string } {
  const c = condition.trim().toLowerCase();
  if (c === 'critical') return { color: '#F87171' };
  if (c === 'high') return { color: '#FB923C' };
  if (c === 'moderate') return { color: '#FACC15' };
  if (c === 'normal') return { color: '#4ADE80' };
  return { color: '#94A3B8' };
}

function VitalRow({
  icon,
  label,
  value,
  condition,
}: {
  icon: string;
  label: string;
  value: string;
  condition?: string;
}) {
  const conditionLabel = condition ? formatUiLabel(condition) : null;

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {icon ? <Text style={styles.vitalIcon}>{icon}</Text> : null}
        <Text style={styles.vitalLabel}>{label}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.vitalValue}>{value}</Text>
        {conditionLabel ? (
          <Text style={[styles.conditionText, conditionStyle(conditionLabel)]}>{conditionLabel}</Text>
        ) : null}
      </View>
    </View>
  );
}

const PatientCard = React.memo(function PatientCard({ patient }: { patient: Patient }) {
  const router = useRouter();
  const riskLabel = formatUiLabel(patient.overallRiskLevel || patient.status);
  const statusStyle = STATUS_STYLES[riskLabel] ?? STATUS_STYLES.Normal;

  return (
    <Pressable
      onPress={() => router.push(`/patient/${patient.id}`)}
      style={({ pressed }) => [
        styles.card,
        { borderColor: statusStyle.border, backgroundColor: statusStyle.background },
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.name}>{patient.name}</Text>
          <Text style={styles.subtleText}>{patient.id}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.pill }]}>
          <Text style={styles.statusText}>{riskLabel}</Text>
        </View>
      </View>

      <VitalRow
        icon="🌡"
        label={VITAL_LABELS.temperature}
        value={formatValue(patient.temperature, '°C')}
        condition={patient.temperatureCondition}
      />
      <VitalRow
        icon="❤️"
        label={VITAL_LABELS.heartRate}
        value={formatValue(patient.heartRate, ' bpm')}
        condition={patient.heartRateCondition}
      />
      <VitalRow
        icon="🫁"
        label={VITAL_LABELS.spo2}
        value={formatValue(patient.spo2, '%')}
        condition={patient.spo2Condition}
      />
      <VitalRow
        icon="⚡"
        label={VITAL_LABELS.gsr}
        value={formatValue(patient.gsr)}
        condition={patient.gsrCondition}
      />

      <View style={styles.divider} />

      <VitalRow
        icon=""
        label="Stress Level"
        value={patient.stress !== null ? `${patient.stress}%` : '--'}
      />

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
    </Pressable>
  );
});

const styles = StyleSheet.create({
  cardPressed: {
    opacity: 0.92,
  },
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
  left: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  right: {
    flexShrink: 0,
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  vitalIcon: {
    fontSize: 16,
    flexShrink: 0,
  },
  vitalLabel: {
    color: '#E2E8F0',
    fontSize: 14,
    flexShrink: 0,
  },
  vitalValue: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  conditionText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
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
