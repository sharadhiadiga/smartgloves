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
import { deviceDisplayName } from '@/hooks/useBleDashboard';
import type { BleSensorPacket } from '@/services/BLEService';

interface BlePanelProps {
  bleSupported: boolean;
  isScanning: boolean;
  connectionStatus: BleConnectionStatus;
  connectedDevice: Device | null;
  connectingDeviceId: string | null;
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

function formatRssi(rssi: number | null | undefined): string {
  if (rssi == null || !Number.isFinite(rssi)) return 'RSSI: —';
  return `RSSI: ${rssi} dBm`;
}

export default function BlePanel({
  bleSupported,
  isScanning,
  connectionStatus,
  connectedDevice,
  connectingDeviceId,
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
  const isConnecting = connectionStatus === 'connecting' || connectingDeviceId != null;

  if (Platform.OS === 'web') {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>BLE Scanner</Text>
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
    <View style={styles.card}>
      <Text style={styles.cardTitle}>BLE Scanner</Text>

      <View style={styles.headerButtons}>
        <TouchableOpacity
          onPress={onStartScan}
          disabled={!bleSupported || isScanning || isConnecting}
          style={[
            styles.headerBtn,
            (!bleSupported || isScanning || isConnecting) && styles.headerBtnDisabled,
          ]}
        >
          {isScanning ? (
            <View style={styles.btnRow}>
              <ActivityIndicator size="small" color="#fff" style={styles.btnSpinner} />
              <Text style={styles.headerBtnText}>Scanning…</Text>
            </View>
          ) : (
            <Text style={styles.headerBtnText}>Scan</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onStopScan}
          disabled={!isScanning}
          style={[styles.headerBtn, styles.headerBtnSecondary, !isScanning && styles.headerBtnDisabled]}
        >
          <Text style={styles.headerBtnText}>Stop</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDisconnect}
          disabled={!connectedDevice && !isConnecting}
          style={[
            styles.headerBtn,
            styles.headerBtnDanger,
            !connectedDevice && !isConnecting && styles.headerBtnDisabled,
          ]}
        >
          <Text style={styles.headerBtnText}>Disconnect</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subHeaderText}>
        Status: {statusLabel(connectionStatus)} · Radio: {bluetoothState} · Found: {devices.length}
      </Text>

      {connectedDevice ? (
        <Text style={styles.connectedHint} numberOfLines={2}>
          Connected: {deviceDisplayName(connectedDevice)}
        </Text>
      ) : null}

      {bleError ? <Text style={styles.errorText}>{bleError}</Text> : null}

      <View style={styles.deviceListBox}>
        <FlatList
          data={devices}
          keyExtractor={(item) => item.id}
          nestedScrollEnabled
          showsVerticalScrollIndicator
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          extraData={connectingDeviceId ?? connectedDevice?.id ?? devices.length}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              {isScanning ? (
                <ActivityIndicator size="small" color="#7C3AED" style={styles.emptySpinner} />
              ) : null}
              <Text style={styles.emptyTextInBox}>
                {isScanning
                  ? 'Scanning for nearby BLE devices…'
                  : 'Tap Scan to discover nearby BLE devices'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSelected = connectedDevice?.id === item.id;
            const isRowConnecting = connectingDeviceId === item.id;
            const disabled = isConnecting || isSelected;

            return (
              <TouchableOpacity
                onPress={() => onConnect(item)}
                disabled={disabled}
                style={[
                  styles.deviceRow,
                  isSelected && styles.deviceRowSelected,
                  isRowConnecting && styles.deviceRowConnecting,
                ]}
              >
                <View style={styles.deviceRowHeader}>
                  <Text style={styles.deviceTileName}>{deviceDisplayName(item)}</Text>
                  {isRowConnecting ? (
                    <ActivityIndicator size="small" color="#A78BFA" />
                  ) : null}
                </View>
                <Text style={styles.deviceMeta}>name: {item.name ?? '—'}</Text>
                <Text style={styles.deviceMeta}>localName: {item.localName ?? '—'}</Text>
                <Text style={styles.deviceTileId}>id: {item.id}</Text>
                <Text style={styles.deviceRssi}>{formatRssi(item.rssi)}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {livePacket ? (
        <View style={styles.liveStrip}>
          <Text style={styles.liveStripText}>
            Live: {livePacket.temperature}°C · {livePacket.heartRate} bpm · SpO₂ {livePacket.spo2}% · GSR{' '}
            {livePacket.gsr} · POSTs {postsSent}
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
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
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
    marginBottom: 10,
  },
  subHeaderText: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 4,
  },
  connectedHint: {
    color: '#86EFAC',
    fontSize: 12,
    marginBottom: 8,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnSpinner: {
    marginRight: 6,
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
    marginBottom: 8,
  },
  deviceListBox: {
    height: 200,
    borderRadius: 12,
    backgroundColor: '#000000',
    marginTop: 4,
    overflow: 'hidden',
  },
  emptyWrap: {
    padding: 16,
    alignItems: 'center',
  },
  emptySpinner: {
    marginBottom: 8,
  },
  emptyTextInBox: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
  },
  deviceRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  deviceRowSelected: {
    backgroundColor: '#1e3a2f',
    borderBottomColor: '#166534',
  },
  deviceRowConnecting: {
    backgroundColor: '#1e1b4b',
  },
  deviceRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  deviceTileName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  deviceMeta: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 2,
  },
  deviceTileId: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 4,
  },
  deviceRssi: {
    color: '#A78BFA',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  liveStrip: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
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
