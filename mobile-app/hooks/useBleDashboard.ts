import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import type { Device } from 'react-native-ble-plx';

import { postSensorDataDebounced, type PostSensorResponse } from '@/services/apiService';
import {
  bleService,
  DEFAULT_PATIENT_ID,
  isBleSupported,
  type BleSensorPacket,
} from '@/services/BLEService';

export type BleConnectionStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'subscribed'
  | 'disconnected'
  | 'error';

type PermissionState = 'unknown' | 'granted' | 'denied';

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

export function deviceDisplayName(device: Device): string {
  return device.name?.trim() || device.localName?.trim() || 'Unnamed Device';
}

export interface UseBleDashboardOptions {
  onBackendResponse?: (packet: BleSensorPacket, response: PostSensorResponse) => void;
  onPipelineError?: (message: string) => void;
}

export function useBleDashboard(options: UseBleDashboardOptions = {}) {
  const bleSupported = isBleSupported();
  const [permission, setPermission] = useState<PermissionState>('unknown');
  const [bluetoothState, setBluetoothState] = useState('unknown');
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<BleConnectionStatus>('idle');
  const [livePacket, setLivePacket] = useState<BleSensorPacket | null>(null);
  const [lastRaw, setLastRaw] = useState('--');
  const [bleError, setBleError] = useState<string | null>(null);
  const [postsSent, setPostsSent] = useState(0);
  const [lastBackendAt, setLastBackendAt] = useState<string | null>(null);

  const seenDeviceIds = useRef(new Set<string>());
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const refreshBluetoothState = useCallback(async () => {
    if (!bleSupported) {
      setBluetoothState('unsupported-web');
      return;
    }
    const state = await bleService.getBluetoothState();
    setBluetoothState(state);
  }, [bleSupported]);

  const handleBackendPost = useCallback(async (packet: BleSensorPacket) => {
    try {
      const response = await postSensorDataDebounced(packet);
      setPostsSent((n) => n + 1);
      setLastBackendAt(new Date().toISOString());
      optionsRef.current.onBackendResponse?.(packet, response);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Backend POST failed';
      console.log('[Pipeline] API failure:', message);
      setBleError(message);
      optionsRef.current.onPipelineError?.(message);
    }
  }, []);

  const startScan = useCallback(async () => {
    if (!bleSupported) return;

    setBleError(null);
    setDevices([]);
    seenDeviceIds.current = new Set();

    const perm = await requestBlePermissions();
    setPermission(perm);
    if (perm !== 'granted') {
      setBleError('Bluetooth permissions denied');
      setConnectionStatus('error');
      return;
    }

    await refreshBluetoothState();
    setIsScanning(true);
    setConnectionStatus('scanning');

    bleService.startScan(
      (device) => {
        if (!device || !device.name) return;

        // 🔥 ONLY allow your ESP32
        if (device.name !== 'Health_Glove_ESP32') return;

        if (seenDeviceIds.current.has(device.id)) return;
        seenDeviceIds.current.add(device.id);
        setDevices((prev) => [...prev, device]);

        // Optional fast auto-connect
        // stopScan();
        // void connectToDevice(device);
      },
      (message) => {
        setIsScanning(false);
        setConnectionStatus('error');
        setBleError(message);
      }
    );
  }, [bleSupported, refreshBluetoothState]);

  const stopScan = useCallback(() => {
    bleService.stopScan();
    setIsScanning(false);
    if (connectionStatus === 'scanning') {
      setConnectionStatus('idle');
    }
  }, [connectionStatus]);

  const connectToDevice = useCallback(
    async (device: Device) => {
      if (!bleSupported) return;

      try {
        setBleError(null);
        stopScan();
        setConnectionStatus('connecting');

        const connected = await bleService.connect(device.id);
        setConnectedDevice(connected);
        setConnectionStatus('connected');

        bleService.subscribeToVitals({
          defaultPatientId: DEFAULT_PATIENT_ID,
          onRaw: (raw) => setLastRaw(raw),
          onPacket: (packet) => {
            setLivePacket(packet);
            setConnectionStatus('subscribed');
            void handleBackendPost(packet);
          },
          onError: (message) => {
            setBleError(message);
            setConnectionStatus('error');
          },
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Connection failed';
        setBleError(message);
        setConnectionStatus('error');
      }
    },
    [bleSupported, handleBackendPost, stopScan]
  );

  const disconnect = useCallback(async () => {
    await bleService.disconnect();
    setConnectedDevice(null);
    setConnectionStatus('disconnected');
    setIsScanning(false);
  }, []);

  useEffect(() => {
    if (!bleSupported) {
      setPermission('denied');
      setBluetoothState('unsupported-web');
      setBleError('BLE not supported, use Android build');
      return;
    }

    void (async () => {
      const perm = await requestBlePermissions();
      setPermission(perm);
      await refreshBluetoothState();
    })();

    return () => {
      bleService.stopScan();
      void bleService.disconnect();
    };
  }, [bleSupported, refreshBluetoothState]);

  return {
    bleSupported,
    permission,
    bluetoothState,
    isScanning,
    devices,
    connectedDevice,
    connectionStatus,
    livePacket,
    lastRaw,
    bleError,
    postsSent,
    lastBackendAt,
    startScan,
    stopScan,
    connectToDevice,
    disconnect,
    refreshBluetoothState,
  };
}
