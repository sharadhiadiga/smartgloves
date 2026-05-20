import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const selectedDevice = useMemo(() => {
    if (!selectedDeviceId) return null;
    return devices.find((d) => d.id === selectedDeviceId) ?? null;
  }, [devices, selectedDeviceId]);

  const isConnecting = connectionStatus === 'connecting';

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

      <View style={styles.buttonRow}>
        <Pressable
          style={[
            styles.connectBtnWide,
            (!selectedDevice || isConnected || isConnecting) && styles.btnDisabled,
          ]}
          onPress={() => selectedDevice && onConnect(selectedDevice)}
          disabled={!selectedDevice || isConnected || isConnecting}
        >
          <Text style={styles.connectBtnWideText}>
            {isConnecting ? 'Connecting…' : selectedDevice ? 'Connect' : 'Select a device'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.disconnectBtnWide, !isConnected && styles.btnDisabled]}
          onPress={onDisconnect}
          disabled={!isConnected}
        >
          <Text style={styles.disconnectBtnWideText}>Disconnect</Text>
        </Pressable>
      </View>

      {isScanning && (
        <View style={styles.scanRow}>
          <ActivityIndicator color="#8B5CF6" size="small" />
          <Text style={styles.scanText}>Scanning started — looking for ESP32…</Text>
        </View>
      )}

      {bleError ? <Text style={styles.errorText}>{bleError}</Text> : null}

      <View style={styles.deviceList}>
        <Text style={styles.sectionLabel}>
          Discovered devices {devices.length > 0 ? `(${devices.length})` : ''}
        </Text>

        <FlatList
          data={devices}
          keyExtractor={(item) => item.id}
          style={styles.deviceFlatList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {isScanning ? 'Scanning…' : 'No devices yet. Tap “Scan Devices”.'}
            </Text>
          }
          renderItem={({ item }) => {
            const selected = item.id === selectedDeviceId;
            const connected = connectedDevice?.id === item.id;
            return (
              <Pressable
                onPress={() => {
                  setSelectedDeviceId(item.id);
                  if (!isConnected && !isConnecting) {
                    onConnect(item);
                  }
                }}
                style={({ pressed }) => [
                  styles.deviceRow,
                  selected && styles.deviceRowSelected,
                  connected && styles.deviceRowConnected,
                  pressed && styles.deviceRowPressed,
                ]}
              >
                <View style={styles.deviceInfo}>
                  <View style={styles.deviceTitleRow}>
                    <Text style={styles.deviceName}>{deviceDisplayName(item)}</Text>
                    {connected ? <Text style={styles.connectedPill}>Connected</Text> : null}
                    {selected && !connected ? <Text style={styles.selectedPill}>Selected</Text> : null}
                  </View>
                  <Text style={styles.deviceId}>{item.id}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      </View>

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
  deviceFlatList: {
    maxHeight: 300,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 12,
    paddingVertical: 8,
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
  deviceRowSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#0B1530',
  },
  deviceRowConnected: {
    borderColor: '#22C55E',
    backgroundColor: '#052014',
  },
  deviceRowPressed: {
    opacity: 0.9,
  },
  deviceInfo: {
    flex: 1,
    paddingRight: 8,
  },
  deviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  deviceName: {
    color: '#F1F5F9',
    fontWeight: '700',
    fontSize: 13,
  },
  connectedPill: {
    color: '#052014',
    backgroundColor: '#22C55E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
  },
  selectedPill: {
    color: '#0B1020',
    backgroundColor: '#A5B4FC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
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
  connectBtnWide: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBtnWideText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },
  disconnectBtnWide: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#991B1B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disconnectBtnWideText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
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
