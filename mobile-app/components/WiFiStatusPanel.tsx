import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { getApiBaseUrl } from '@/constants/api';

interface WiFiStatusPanelProps {
  offline: boolean;
  lastUpdated: string | null;
  patientCount: number;
  pollIntervalMs: number;
}

export default function WiFiStatusPanel({
  offline,
  lastUpdated,
  patientCount,
  pollIntervalMs,
}: WiFiStatusPanelProps) {
  const apiBase = getApiBaseUrl();

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>WiFi Data Stream</Text>
      <Text style={styles.line}>ESP32 → WiFi → Backend → This app</Text>
      <Text style={styles.line} numberOfLines={2}>
        API: {apiBase}/api/patients
      </Text>
      <Text style={styles.line}>
        Status: {offline ? 'Offline' : 'Connected'} · Refresh: every {pollIntervalMs / 1000}s
      </Text>
      <Text style={styles.line}>
        Patients: {patientCount}
        {lastUpdated ? ` · Last sync ${new Date(lastUpdated).toLocaleTimeString()}` : ''}
      </Text>
      {Platform.OS === 'web' ? (
        <Text style={styles.hint}>Use your machine LAN IP in EXPO_PUBLIC_API_BASE_URL for local dev.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    ...Platform.select({
      android: { elevation: 5 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
      },
      default: {},
    }),
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  line: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 6,
    lineHeight: 18,
  },
  hint: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
  },
});
