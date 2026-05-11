import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Device } from 'react-native-ble-plx';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { getApiBaseUrl } from '@/constants/api';
import { bleService, BleSensorPacket } from '@/services/BLEService';

const API_BASE_URL = getApiBaseUrl();
const POST_DATA_ENDPOINT = `${API_BASE_URL}/api/data`;

const SERVICE_UUID = (process.env.EXPO_PUBLIC_BLE_SERVICE_UUID || '0000fff0-0000-1000-8000-00805f9b34fb').toLowerCase();
const CHAR_UUID = (process.env.EXPO_PUBLIC_BLE_CHAR_UUID || '0000fff1-0000-1000-8000-00805f9b34fb').toLowerCase();

type PermissionState = 'unknown' | 'granted' | 'denied';
type ConnectionStatus =
  | 'Idle'
  | 'Scanning'
  | 'Connecting'
  | 'Connected'
  | 'Subscribed'
  | 'Disconnected'
  | 'Error';

async function requestBlePermissions(): Promise<PermissionState> {
  if (Platform.OS !== 'android') return 'granted';

  const permissions: string[] = [];
  if (Platform.Version >= 31) {
    permissions.push(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
  } else {
    permissions.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  }

  const result = await PermissionsAndroid.requestMultiple(permissions);
  const granted = permissions.every((perm) => result[perm] === PermissionsAndroid.RESULTS.GRANTED);
  return granted ? 'granted' : 'denied';
}

function deviceLabel(device: Device) {
  return device.name?.trim() || device.localName?.trim() || 'Unnamed Device';
}

export default function BluetoothScreen() {
  const [permission, setPermission] = useState<PermissionState>('unknown');
  const [bluetoothState, setBluetoothState] = useState('unknown');
  const [status, setStatus] = useState<ConnectionStatus>('Idle');
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [lastPacket, setLastPacket] = useState<BleSensorPacket | null>(null);
  const [lastRaw, setLastRaw] = useState('--');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [postCount, setPostCount] = useState(0);

  const seenDeviceIds = useRef(new Set<string>());
  const scanInProgress = useRef(false);

  const refreshBluetoothState = useCallback(async () => {
    const state = await bleService.getBluetoothState();
    setBluetoothState(state);
  }, []);

  useEffect(() => {
    void (async () => {
      if (Platform.OS === 'web') {
        setPermission('denied');
        setBluetoothState('unsupported-web');
        setStatus('Error');
        setErrorMessage('BLE is disabled on web. Run Android dev build.');
        return;
      }
      const perm = await requestBlePermissions();
      setPermission(perm);
      await refreshBluetoothState();
    })();

    return () => {
      bleService.stopScan();
      void bleService.disconnect();
    };
  }, [refreshBluetoothState]);

  const startScan = useCallback(async () => {
    if (Platform.OS === 'web') return;

    setErrorMessage(null);
    setDevices([]);
    seenDeviceIds.current = new Set<string>();

    const perm = await requestBlePermissions();
    setPermission(perm);
    if (perm !== 'granted') {
      setErrorMessage('Bluetooth permissions denied');
      return;
    }

    await refreshBluetoothState();
    scanInProgress.current = true;
    setStatus('Scanning');

    bleService.startScan(
      (device) => {
        if (seenDeviceIds.current.has(device.id)) return;
        seenDeviceIds.current.add(device.id);
        setDevices((prev) => [...prev, device]);
      },
      (message) => {
        setStatus('Error');
        setErrorMessage(message);
      }
    );
  }, [refreshBluetoothState]);

  const stopScan = useCallback(() => {
    scanInProgress.current = false;
    bleService.stopScan();
    if (status === 'Scanning') {
      setStatus('Idle');
    }
  }, [status]);

  const postToBackend = useCallback(async (packet: BleSensorPacket) => {
    try {
      const resp = await fetch(POST_DATA_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(packet),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`POST /api/data failed (${resp.status}): ${text}`);
      }
      console.log('POST SUCCESS');
      setPostCount((n) => n + 1);
    } catch (error: any) {
      console.log('POST ERROR:', error?.message ?? error);
      setErrorMessage(error?.message ?? 'POST failed');
    }
  }, []);

  const connectDevice = useCallback(
    async (device: Device) => {
      try {
        setErrorMessage(null);
        stopScan();
        setStatus('Connecting');
        const connected = await bleService.connect(device.id);
        setConnectedDevice(connected);
        setStatus('Connected');

        await bleService.subscribeToJsonNotifications({
          serviceUUID: SERVICE_UUID,
          characteristicUUID: CHAR_UUID,
          onRaw: (raw) => setLastRaw(raw),
          onPacket: (packet) => {
            setLastPacket(packet);
            setStatus('Subscribed');
            void postToBackend(packet);
          },
          onError: (message) => {
            setStatus('Error');
            setErrorMessage(message);
          },
        });
      } catch (error: any) {
        setStatus('Error');
        setErrorMessage(error?.message ?? 'Failed to connect');
      }
    },
    [postToBackend, stopScan]
  );

  const disconnectDevice = useCallback(async () => {
    await bleService.disconnect();
    setConnectedDevice(null);
    setStatus('Disconnected');
  }, []);

  const renderDevice = useCallback(
    ({ item }: { item: Device }) => (
      <View style={styles.deviceRow}>
        <View style={styles.deviceLeft}>
          <Text style={styles.deviceName}>{deviceLabel(item)}</Text>
          <Text style={styles.deviceId}>{item.id}</Text>
        </View>
        <Pressable style={styles.connectBtn} onPress={() => void connectDevice(item)}>
          <Text style={styles.connectText}>Connect</Text>
        </Pressable>
      </View>
    ),
    [connectDevice]
  );

  const statusColor = useMemo(() => {
    if (status === 'Subscribed') return '#22C55E';
    if (status === 'Connected') return '#38BDF8';
    if (status === 'Scanning' || status === 'Connecting') return '#FACC15';
    if (status === 'Error') return '#F87171';
    return '#94A3B8';
  }, [status]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.titleRow}>
          <IconSymbol size={26} name="dot.radiowaves.left.and.right" color="#93C5FD" />
          <Text style={styles.title}>Bluetooth Monitor</Text>
        </View>

        <Text style={styles.info}>Status: <Text style={{ color: statusColor }}>{status}</Text></Text>
        <Text style={styles.info}>Bluetooth: {bluetoothState}</Text>
        <Text style={styles.info}>Permission: {permission}</Text>
        <Text style={styles.info}>API: {POST_DATA_ENDPOINT}</Text>

        <View style={styles.buttonRow}>
          <Pressable style={styles.primaryBtn} onPress={() => void startScan()}>
            <Text style={styles.primaryBtnText}>Scan Devices</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => stopScan()}>
            <Text style={styles.secondaryBtnText}>Stop</Text>
          </Pressable>
        </View>

        {status === 'Scanning' && (
          <View style={styles.scanning}>
            <ActivityIndicator color="#8B5CF6" />
            <Text style={styles.scanningText}>Scanning nearby devices...</Text>
          </View>
        )}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <Text style={styles.sectionTitle}>Discovered Devices</Text>
        <FlatList
          data={devices}
          renderItem={renderDevice}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.emptyText}>No devices found yet.</Text>}
          contentContainerStyle={styles.list}
        />

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Connected Device</Text>
          <Text style={styles.info}>
            {connectedDevice ? `${deviceLabel(connectedDevice)} (${connectedDevice.id})` : '--'}
          </Text>
          <Pressable style={styles.disconnectBtn} onPress={() => void disconnectDevice()}>
            <Text style={styles.disconnectText}>Disconnect</Text>
          </Pressable>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Live Sensor Data</Text>
          <Text style={styles.info}>Patient ID: {lastPacket?.patientId ?? '--'}</Text>
          <Text style={styles.info}>Temperature: {lastPacket?.temperature ?? '--'}</Text>
          <Text style={styles.info}>Heart Rate: {lastPacket?.heartRate ?? '--'}</Text>
          <Text style={styles.info}>SpO2: {lastPacket?.spo2 ?? '--'}</Text>
          <Text style={styles.info}>GSR: {lastPacket?.gsr ?? '--'}</Text>
          <Text style={styles.info}>Packets Sent: {postCount}</Text>
          <Text style={styles.sectionTitle}>Incoming BLE Raw</Text>
          <Text style={styles.rawText}>{lastRaw}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#020617' },
  container: { flex: 1, backgroundColor: '#020617', paddingHorizontal: 16, paddingTop: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  title: { color: '#F8FAFC', fontSize: 28, fontWeight: '900' },
  info: { color: '#CBD5E1', fontSize: 12, marginBottom: 4 },
  buttonRow: { flexDirection: 'row', marginTop: 10, gap: 10 },
  primaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: {
    width: 90,
    height: 44,
    borderRadius: 12,
    borderColor: '#334155',
    borderWidth: 1,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { color: '#E2E8F0', fontWeight: '700' },
  scanning: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  scanningText: { color: '#A78BFA', fontSize: 12 },
  errorText: { color: '#FCA5A5', marginTop: 8 },
  sectionTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '800', marginTop: 14, marginBottom: 6 },
  list: { paddingBottom: 8 },
  emptyText: { color: '#94A3B8', fontSize: 12 },
  deviceRow: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceLeft: { flex: 1, paddingRight: 12 },
  deviceName: { color: '#F1F5F9', fontWeight: '700' },
  deviceId: { color: '#94A3B8', fontSize: 11, marginTop: 3 },
  connectBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 999,
    paddingHorizontal: 12,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  panel: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0B1220',
    borderRadius: 12,
    padding: 10,
  },
  disconnectBtn: {
    marginTop: 8,
    backgroundColor: '#991B1B',
    borderRadius: 10,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disconnectText: { color: '#fff', fontWeight: '700' },
  rawText: {
    color: '#CBD5E1',
    fontSize: 11,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    backgroundColor: '#111827',
    padding: 8,
  },
});

