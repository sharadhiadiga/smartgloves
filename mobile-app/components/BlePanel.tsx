import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Device } from 'react-native-ble-plx';

import type { BleConnectionStatus } from '@/hooks/useBleDashboard';
import { deviceDisplayName } from '@/hooks/useBleDashboard';
import type { BleSensorPacket } from '@/services/bleService';
import { getApiBaseUrl } from '@/constants/api';

interface BlePanelProps {
  bleSupported: boolean;
  isScanning: boolean;
  connectionStatus: BleConnectionStatus;
  connectedDevice: Device | null;
  devices: Device[];
  livePacket: BleSensorPacket | null;
  lastRaw: string;
  bleError: string | null;
  postsSent: number;
  bluetoothState: string;
  onStartScan: () => void;
  onStopScan: () => void;
  onConnect: (device: Device) => void;
  onDisconnect: () => void;
}

function statusLabel(status: BleConnectionStatus): string {
  switch (status) {
    case 'scanning':
      return 'Scanning';
    case 'connecting':
      return 'Connecting…';
    case 'connected':
      return 'Connected';
    case 'subscribed':
      return 'Live stream';
    case 'disconnected':
      return 'Disconnected';
    case 'error':
      return 'Error';
    default:
      return 'Idle';
  }
}

function statusColor(status: BleConnectionStatus): string {
  if (status === 'subscribed') return '#22C55E';
  if (status === 'connected') return '#38BDF8';
  if (status === 'scanning' || status === 'connecting') return '#FACC15';
  if (status === 'error') return '#F87171';
  return '#94A3B8';
}

export default function BlePanel({
  bleSupported,
  isScanning,
  connectionStatus,
  connectedDevice,
  devices,
  livePacket,
  lastRaw,
  bleError,
  postsSent,
  bluetoothState,
  onStartScan,
  onStopScan,
  onConnect,
  onDisconnect,
}: BlePanelProps) {
  const isConnected = Boolean(connectedDevice);
  const connectedColor = isConnected ? '#22C55E' : '#64748B';

  if (Platform.OS === 'web') {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>ESP32 Bluetooth</Text>
        <View style={styles.webBanner}>
          <Text style={styles.webBannerText}>
            BLE not supported on web. Use an Android development build on a physical device.
          </Text>
        </View>
        <Pressable style={[styles.primaryBtn, styles.btnDisabled]} disabled>
          <Text style={styles.primaryBtnText}>Scan Devices (disabled)</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.titleRow}>
        <Text style={styles.panelTitle}>ESP32 Bluetooth</Text>
        <View style={[styles.connectedDot, { backgroundColor: connectedColor }]} />
        <Text style={[styles.connectedLabel, { color: connectedColor }]}>
          {isConnected ? 'Connected' : 'Not connected'}
        </Text>
      </View>

      <Text style={styles.meta}>
        BLE: {statusLabel(connectionStatus)} · Radio: {bluetoothState}
      </Text>
      <Text style={styles.meta}>API: {getApiBaseUrl()}</Text>

      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.primaryBtn, (isScanning || !bleSupported) && styles.btnDimmed]}
          onPress={onStartScan}
          disabled={!bleSupported || isScanning}
        >
          <Text style={styles.primaryBtnText}>Scan Devices</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={onStopScan}>
          <Text style={styles.secondaryBtnText}>Stop</Text>
        </Pressable>
      </View>

      {isScanning && (
        <View style={styles.scanRow}>
          <ActivityIndicator color="#8B5CF6" size="small" />
          <Text style={styles.scanText}>Scanning started — looking for ESP32…</Text>
        </View>
      )}

      {bleError ? <Text style={styles.errorText}>{bleError}</Text> : null}

      {devices.length > 0 && (
        <View style={styles.deviceList}>
          <Text style={styles.sectionLabel}>Discovered devices</Text>
          {devices.slice(0, 6).map((device) => (
            <View key={device.id} style={styles.deviceRow}>
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{deviceDisplayName(device)}</Text>
                <Text style={styles.deviceId}>{device.id}</Text>
              </View>
              <Pressable
                style={styles.connectBtn}
                onPress={() => onConnect(device)}
                disabled={connectionStatus === 'connecting'}
              >
                <Text style={styles.connectBtnText}>Connect</Text>
              </Pressable>
            </View>
          ))}
          {devices.length > 6 && (
            <Text style={styles.meta}>+{devices.length - 6} more (scroll dashboard)</Text>
          )}
        </View>
      )}

      {connectedDevice && (
        <View style={styles.connectedBox}>
          <Text style={styles.sectionLabel}>Connected device</Text>
          <Text style={styles.deviceName}>
            {deviceDisplayName(connectedDevice)} ({connectedDevice.id})
          </Text>
          <Pressable style={styles.disconnectBtn} onPress={onDisconnect}>
            <Text style={styles.disconnectText}>Disconnect</Text>
          </Pressable>
        </View>
      )}

      {livePacket && (
        <View style={styles.liveBox}>
          <Text style={styles.sectionLabel}>Live vitals (BLE)</Text>
          <Text style={[styles.liveStatus, { color: statusColor(connectionStatus) }]}>
            Streaming · POSTs: {postsSent}
          </Text>
          <Text style={styles.vitalLine}>Patient: {livePacket.patientId}</Text>
          <Text style={styles.vitalLine}>Temp: {livePacket.temperature}°C</Text>
          <Text style={styles.vitalLine}>HR: {livePacket.heartRate} bpm</Text>
          <Text style={styles.vitalLine}>SpO₂: {livePacket.spo2}%</Text>
          <Text style={styles.vitalLine}>GSR: {livePacket.gsr}</Text>
          <Text style={styles.rawLabel}>Raw: {lastRaw}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0B1220',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  panelTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
  },
  connectedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  connectedLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  meta: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 3,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 8,
  },
  primaryBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  btnDimmed: {
    opacity: 0.7,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  secondaryBtn: {
    width: 72,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#E2E8F0',
    fontWeight: '700',
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  scanText: {
    color: '#A78BFA',
    fontSize: 12,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    marginBottom: 8,
  },
  webBanner: {
    backgroundColor: '#422006',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#B45309',
  },
  webBannerText: {
    color: '#FDE68A',
    fontSize: 13,
    lineHeight: 18,
  },
  sectionLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 4,
  },
  deviceList: {
    marginTop: 4,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
    backgroundColor: '#0F172A',
  },
  deviceInfo: {
    flex: 1,
    paddingRight: 8,
  },
  deviceName: {
    color: '#F1F5F9',
    fontWeight: '700',
    fontSize: 13,
  },
  deviceId: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  connectBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  connectBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 12,
  },
  connectedBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  disconnectBtn: {
    marginTop: 8,
    backgroundColor: '#991B1B',
    borderRadius: 10,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disconnectText: {
    color: '#FFF',
    fontWeight: '700',
  },
  liveBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#334155',
  },
  liveStatus: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  vitalLine: {
    color: '#E2E8F0',
    fontSize: 13,
    marginBottom: 2,
  },
  rawLabel: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 6,
  },
});
