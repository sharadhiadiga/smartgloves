import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Device } from 'react-native-ble-plx';

import type { BleConnectionStatus } from '@/hooks/useBleDashboard';
import type { BleSensorPacket } from '@/services/bleService';

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
  if (Platform.OS === 'web') {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>ESP32 Bluetooth</Text>
        <View style={styles.webBanner}>
          <Text style={styles.webBannerText}>
            BLE not supported on web. Use an Android development build on a physical device.
          </Text>
        </View>
        <View style={styles.webButtonDisabled}>
          <Text style={styles.webButtonDisabledText}>Scan Devices (disabled)</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fullScreen}>
      <View style={styles.headerRow}>
        <Text style={styles.headerText}>Select ESP32 Device</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={onStartScan}
            disabled={!bleSupported || isScanning}
            style={[styles.headerBtn, (!bleSupported || isScanning) && styles.headerBtnDisabled]}
          >
            <Text style={styles.headerBtnText}>{isScanning ? 'Scanning…' : 'Scan'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onStopScan} style={[styles.headerBtn, styles.headerBtnSecondary]}>
            <Text style={styles.headerBtnText}>Stop</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDisconnect}
            disabled={!connectedDevice}
            style={[styles.headerBtn, styles.headerBtnDanger, !connectedDevice && styles.headerBtnDisabled]}
          >
            <Text style={styles.headerBtnText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.subHeaderText}>
        Status: {statusLabel(connectionStatus)} · Radio: {bluetoothState} · Found: {devices.length}
      </Text>

      {bleError ? <Text style={styles.errorText}>{bleError}</Text> : null}

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 50 }}
        showsVerticalScrollIndicator
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        onScroll={() => console.log('SCROLLING')}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {isScanning ? 'Scanning for Health_Glove_ESP32…' : 'Tap Scan to find Health_Glove_ESP32'}
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => onConnect(item)}
            style={styles.deviceTile}
          >
            <Text style={styles.deviceTileName}>
              {item.name || 'Health_Glove_ESP32'}
            </Text>
            <Text style={styles.deviceTileId}>{item.id}</Text>
          </TouchableOpacity>
        )}
      />

      {livePacket ? (
        <View style={styles.liveStrip}>
          <Text style={styles.liveStripText}>
            Live: {livePacket.temperature}°C · {livePacket.heartRate} bpm · SpO₂ {livePacket.spo2}% · GSR {livePacket.gsr} · POSTs {postsSent}
          </Text>
          <Text style={styles.liveStripRaw} numberOfLines={1}>
            {lastRaw}
          </Text>
        </View>
      ) : null}
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
    overflow: 'hidden',
  },
  panelTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
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
  webButtonDisabled: {
    opacity: 0.45,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webButtonDisabledText: {
    color: '#E2E8F0',
    fontWeight: '700',
    fontSize: 14,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 16,
    overflow: 'hidden',
    paddingTop: 6,
  },
  headerRow: {
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  headerText: {
    color: 'white',
    fontSize: 18,
    marginBottom: 10,
    fontWeight: '800',
  },
  subHeaderText: {
    color: '#9CA3AF',
    fontSize: 12,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  headerBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#1f2937',
    borderRadius: 12,
  },
  headerBtnSecondary: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
  },
  headerBtnDanger: {
    backgroundColor: '#7f1d1d',
  },
  headerBtnDisabled: {
    opacity: 0.5,
  },
  headerBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 12,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  deviceTile: {
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 10,
    backgroundColor: '#1f2937',
    borderRadius: 12,
  },
  deviceTileName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  deviceTileId: {
    color: 'gray',
    fontSize: 12,
    marginTop: 4,
  },
  liveStrip: {
    borderTopWidth: 1,
    borderTopColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#000',
  },
  liveStripText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '700',
  },
  liveStripRaw: {
    marginTop: 6,
    color: '#6B7280',
    fontSize: 10,
  },
});
