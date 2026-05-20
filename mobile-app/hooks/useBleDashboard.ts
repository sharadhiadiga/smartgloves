import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import type { Device } from 'react-native-ble-plx';

import { postSensorDataDebounced, type PostSensorResponse } from '@/services/apiService';
import {
  bleService,
  BLE_CONNECT_TIMEOUT_MS,
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
  if (Platform.OS !== 'android') {
    console.log('[BLE][Permissions] iOS — handled via Info.plist');
    return 'granted';
  }

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

  if (Platform.Version >= 33) {
    permissions.push(PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES);
  }

  console.log('[BLE][Permissions] Requesting:', permissions);
  const result = await PermissionsAndroid.requestMultiple(permissions);
  const granted = permissions.every((perm) => result[perm] === PermissionsAndroid.RESULTS.GRANTED);

  if (!granted) {
    const denied = permissions.filter((p) => result[p] !== PermissionsAndroid.RESULTS.GRANTED);
    console.log('[BLE][Permissions] Denied:', denied);
  } else {
    console.log('[BLE][Permissions] All granted');
  }

  return granted ? 'granted' : 'denied';
}

export function deviceDisplayName(device: Device): string {
  const name = device.name?.trim();
  const local = device.localName?.trim();
  if (name && local && name !== local) return `${name} (${local})`;
  return name || local || 'Unnamed Device';
}

function sortDevicesByRssi(list: Device[]): Device[] {
  return [...list].sort((a, b) => {
    const ra = a.rssi ?? -999;
    const rb = b.rssi ?? -999;
    return rb - ra;
  });
}

function upsertDevice(prev: Device[], incoming: Device): Device[] {
  const idx = prev.findIndex((d) => d.id === incoming.id);
  if (idx >= 0) {
    const next = [...prev];
    next[idx] = incoming;
    return sortDevicesByRssi(next);
  }
  return sortDevicesByRssi([...prev, incoming]);
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
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<BleConnectionStatus>('idle');
  const [livePacket, setLivePacket] = useState<BleSensorPacket | null>(null);
  const [lastRaw, setLastRaw] = useState('--');
  const [bleError, setBleError] = useState<string | null>(null);
  const [postsSent, setPostsSent] = useState(0);
  const [lastBackendAt, setLastBackendAt] = useState<string | null>(null);

  const seenDeviceIds = useRef(new Set<string>());
  const isScanningRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

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

    console.log('[BLE][UI] startScan requested');
    bleService.stopScan();

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

    const state = await bleService.getBluetoothState();
    setBluetoothState(state);
    if (state !== 'PoweredOn') {
      setBleError(`Bluetooth is not ready (${state}). Enable Bluetooth and try again.`);
      setConnectionStatus('error');
      return;
    }

    setIsScanning(true);
    setConnectionStatus('scanning');

    bleService.startScan(
      (device) => {
        if (!device?.id) return;

        seenDeviceIds.current.add(device.id);
        setDevices((prev) => upsertDevice(prev, device));
      },
      (message) => {
        console.log('[BLE][UI] scan error callback:', message);
        setIsScanning(false);
        setConnectionStatus((s) => (s === 'scanning' ? 'error' : s));
        setBleError(message);
      }
    );
  }, [bleSupported]);

  const stopScan = useCallback(() => {
    console.log('[BLE][UI] stopScan');
    bleService.stopScan();
    setIsScanning(false);
    setConnectionStatus((s) => (s === 'scanning' ? 'idle' : s));
  }, []);

  const connectToDevice = useCallback(
    async (device: Device) => {
      if (!bleSupported) return;
      if (connectingDeviceId) return;

      console.log('[BLE][UI] connect tapped:', device.id);
      setBleError(null);
      stopScan();
      setConnectingDeviceId(device.id);
      setConnectionStatus('connecting');

      try {
        const connected = await bleService.connect(device.id, {
          timeoutMs: BLE_CONNECT_TIMEOUT_MS,
          autoConnect: false,
        });
        console.log('[BLE][UI] connect success:', connected.id);
        setConnectedDevice(connected);
        setConnectionStatus('connected');

        bleService.subscribeToVitals({
          defaultPatientId: DEFAULT_PATIENT_ID,
          onRaw: (raw) => {
            console.log('[BLE][UI] raw vitals:', raw);
            setLastRaw(raw);
          },
          onPacket: (packet) => {
            console.log('[BLE][UI] parsed vitals packet:', packet);
            setLivePacket(packet);
            setConnectionStatus('subscribed');
            void handleBackendPost(packet);
          },
          onError: (message) => {
            console.log('[BLE][UI] vitals subscription error:', message);
            setBleError(message);
            setConnectionStatus('error');
          },
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Connection failed';
        console.log('[BLE][UI] connect failed:', message);
        setBleError(message);
        setConnectionStatus('error');
        setConnectedDevice(null);
      } finally {
        setConnectingDeviceId(null);
      }
    },
    [bleSupported, connectingDeviceId, handleBackendPost, stopScan]
  );

  const disconnect = useCallback(async () => {
    console.log('[BLE][UI] disconnect');
    await bleService.disconnect();
    setConnectedDevice(null);
    setConnectingDeviceId(null);
    setConnectionStatus('disconnected');
    setIsScanning(false);
    setLivePacket(null);
    setLastRaw('--');
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

    const unwatch = bleService.watchBluetoothState((state) => {
      setBluetoothState(state);
      if (state !== 'PoweredOn' && isScanningRef.current) {
        console.log('[BLE][UI] radio off while scanning — stopping scan');
        bleService.stopScan();
        setIsScanning(false);
        setConnectionStatus('idle');
      }
    });

    return () => {
      console.log('[BLE][UI] cleanup — stop scan, disconnect, destroy manager');
      unwatch();
      bleService.stopScan();
      void bleService.disconnect();
      bleService.destroy();
    };
  }, [bleSupported, refreshBluetoothState]);

  return {
    bleSupported,
    permission,
    bluetoothState,
    isScanning,
    devices,
    connectedDevice,
    connectingDeviceId,
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
    deviceDisplayName,
  };
}
