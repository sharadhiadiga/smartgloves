import { Platform } from 'react-native';
import type { BleError, Characteristic, Device, Subscription } from 'react-native-ble-plx';
import { decode as base64Decode } from 'base-64';

type BlePlxModule = typeof import('react-native-ble-plx');

export type BleSensorPacket = {
  patientId: string;
  temperature: number;
  heartRate: number;
  spo2: number;
  gsr: number;
};

export const DEFAULT_PATIENT_ID =
  process.env.EXPO_PUBLIC_PATIENT_ID?.trim() || 'P001';

export const BLE_SERVICE_UUID = (
  process.env.EXPO_PUBLIC_BLE_SERVICE_UUID || '12345678-1234-1234-1234-123456789ABC'
).toLowerCase();

export const BLE_CHAR_UUID = (
  process.env.EXPO_PUBLIC_BLE_CHAR_UUID || 'ABCD1234-5678-5678-5678-ABCDEF123456'
).toLowerCase();

/** True on iOS/Android native; false on web (use mock / disabled UI). */
export function isBleSupported(): boolean {
  return Platform.OS !== 'web';
}

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : (value as number);
  return Number.isFinite(n) ? Number(n) : null;
}

function decodeBleValue(value: string): string {
  try {
    return base64Decode(value);
  } catch {
    return value;
  }
}

/**
 * Parse ESP32 text: "temp:39,hr:120,spo2:90,gsr:2000" or JSON payload.
 */
export function parseBleData(
  rawInput: string,
  defaultPatientId: string = DEFAULT_PATIENT_ID
):
  | { ok: true; packet: BleSensorPacket; format: 'esp32' | 'json' }
  | { ok: false; error: string } {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: false, error: 'Empty BLE payload' };
  }

  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const patientId = typeof obj.patientId === 'string' ? obj.patientId.trim() : '';
      if (!patientId) return { ok: false, error: 'JSON missing patientId' };

      const temperature = toFiniteNumber(obj.temperature);
      const heartRate = toFiniteNumber(obj.heartRate);
      const spo2 = toFiniteNumber(obj.spo2);
      const gsr = toFiniteNumber(obj.gsr);

      if (temperature === null || heartRate === null || spo2 === null || gsr === null) {
        return { ok: false, error: 'JSON missing numeric vitals' };
      }

      return {
        ok: true,
        packet: { patientId, temperature, heartRate, spo2, gsr },
        format: 'json',
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Invalid JSON';
      return { ok: false, error: message };
    }
  }

  const map: Record<string, string> = {};
  for (const segment of trimmed.split(',')) {
    const colon = segment.indexOf(':');
    if (colon <= 0) continue;
    const key = segment.slice(0, colon).trim().toLowerCase();
    map[key] = segment.slice(colon + 1).trim();
  }

  const temperature = toFiniteNumber(map.temp ?? map.temperature);
  const heartRate = toFiniteNumber(map.hr ?? map.heartrate ?? map.heart_rate);
  const spo2 = toFiniteNumber(map.spo2 ?? map.sp02);
  const gsr = toFiniteNumber(map.gsr);

  if (temperature === null || heartRate === null || spo2 === null || gsr === null) {
    return { ok: false, error: 'ESP32 payload missing temp/hr/spo2/gsr' };
  }

  const patientId =
    (map.patientid && map.patientid.trim()) ||
    (map.id && map.id.trim()) ||
    defaultPatientId;

  return {
    ok: true,
    packet: { patientId, temperature, heartRate, spo2, gsr },
    format: 'esp32',
  };
}

export function parseBleBase64Data(
  base64Value: string,
  defaultPatientId: string = DEFAULT_PATIENT_ID
):
  | { ok: true; packet: BleSensorPacket; rawText: string; format: 'esp32' | 'json' }
  | { ok: false; error: string; rawText?: string } {
  try {
    const rawText = decodeBleValue(base64Value);
    const parsed = parseBleData(rawText, defaultPatientId);
    if (!parsed.ok) return { ...parsed, rawText };
    return { ok: true, packet: parsed.packet, rawText, format: parsed.format };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Decode failed';
    return { ok: false, error: message };
  }
}

type ScanCallback = (device: Device) => void;
type ErrorCallback = (message: string) => void;

class BleServiceImpl {
  private manager: InstanceType<BlePlxModule['BleManager']> | null = null;
  private scanActive = false;
  private connectedDevice: Device | null = null;
  private disconnectSub: Subscription | null = null;
  private notifySub: Subscription | null = null;
  private shouldAutoReconnect = true;
  private vitalsListener: {
    onRaw: (raw: string) => void;
    onPacket: (packet: BleSensorPacket, meta: { rawText: string; format: 'esp32' | 'json' }) => void;
    onError: ErrorCallback;
    defaultPatientId: string;
  } | null = null;

  private ensureManager() {
    if (Platform.OS === 'web') {
      throw new Error('BLE not supported on web. Use Android build.');
    }
    if (!this.manager) {
      const mod = require('react-native-ble-plx') as BlePlxModule;
      this.manager = new mod.BleManager();
    }
    return this.manager;
  }

  async getBluetoothState(): Promise<string> {
    if (Platform.OS === 'web') return 'unsupported-web';
    return this.ensureManager().state();
  }

  startScan(onDeviceFound: ScanCallback, onError: ErrorCallback): void {
    if (Platform.OS === 'web') {
      onError('BLE not supported, use Android build');
      return;
    }
    if (this.scanActive) return;

    const mgr = this.ensureManager();
    this.scanActive = true;
    console.log('Scanning started');

    mgr.startDeviceScan(null, { allowDuplicates: false }, (error: BleError | null, device: Device | null) => {
      if (error) {
        this.scanActive = false;
        console.log('[BLE] Scan error:', error.message);
        onError(error.message);
        return;
      }
      if (!device) return;
      console.log('Device found:', device.name || device.localName || device.id);
      onDeviceFound(device);
    });
  }

  stopScan(): void {
    if (!this.scanActive) return;
    this.scanActive = false;
    this.manager?.stopDeviceScan();
    console.log('[BLE] Scan stopped');
  }

  async connect(deviceId: string): Promise<Device> {
    if (Platform.OS === 'web') {
      throw new Error('BLE not supported, use Android build');
    }

    const mgr = this.ensureManager();
    this.stopScan();
    this.shouldAutoReconnect = true;

    const device = await mgr.connectToDevice(deviceId, { timeout: 10000, autoConnect: true });
    await device.discoverAllServicesAndCharacteristics();
    this.connectedDevice = device;
    console.log('Connected to device:', device.name || device.id);

    this.disconnectSub?.remove();
    this.disconnectSub = mgr.onDeviceDisconnected(device.id, (_err, disconnected) => {
      console.log('[BLE] Disconnected:', disconnected?.id);
      this.connectedDevice = null;
      this.notifySub?.remove();
      this.notifySub = null;
      if (this.shouldAutoReconnect && disconnected?.id) {
        void this.reconnectWithBackoff(disconnected.id);
      }
    });

    if (this.vitalsListener) {
      this.attachVitalsSubscription();
    }

    return device;
  }

  private async reconnectWithBackoff(deviceId: string): Promise<void> {
    for (const delayMs of [1000, 2000, 4000]) {
      if (!this.shouldAutoReconnect) return;
      await new Promise((r) => setTimeout(r, delayMs));
      try {
        console.log('[BLE] Auto-reconnect:', deviceId);
        await this.connect(deviceId);
        return;
      } catch (e: unknown) {
        console.log('[BLE] Reconnect failed:', e instanceof Error ? e.message : e);
      }
    }
  }

  async disconnect(): Promise<void> {
    this.shouldAutoReconnect = false;
    const id = this.connectedDevice?.id;
    this.notifySub?.remove();
    this.notifySub = null;
    this.disconnectSub?.remove();
    this.disconnectSub = null;
    this.connectedDevice = null;

    if (id && Platform.OS !== 'web') {
      try {
        await this.ensureManager().cancelDeviceConnection(id);
        console.log('[BLE] Disconnected from', id);
      } catch {
        // ignore race
      }
    }
  }

  subscribeToVitals(args: {
    serviceUUID?: string;
    characteristicUUID?: string;
    defaultPatientId?: string;
    onRaw: (rawText: string) => void;
    onPacket: (packet: BleSensorPacket, meta: { rawText: string; format: 'esp32' | 'json' }) => void;
    onError: ErrorCallback;
  }): void {
    this.vitalsListener = {
      onRaw: args.onRaw,
      onPacket: args.onPacket,
      onError: args.onError,
      defaultPatientId: args.defaultPatientId || DEFAULT_PATIENT_ID,
    };

    if (Platform.OS === 'web') {
      args.onError('BLE not supported on web');
      return;
    }

    if (this.connectedDevice) {
      this.attachVitalsSubscription(args.serviceUUID, args.characteristicUUID);
    }
  }

  private attachVitalsSubscription(
    serviceUUID: string = BLE_SERVICE_UUID,
    characteristicUUID: string = BLE_CHAR_UUID
  ): void {
    if (!this.vitalsListener || !this.connectedDevice) return;

    const device = this.connectedDevice;
    const listener = this.vitalsListener;
    const service = serviceUUID.toLowerCase();
    const characteristic = characteristicUUID.toLowerCase();

    this.notifySub?.remove();
    this.notifySub = device.monitorCharacteristicForService(
      service,
      characteristic,
      (error: BleError | null, char: Characteristic | null) => {
        if (error) {
          listener.onError(error.message);
          return;
        }
        const value = char?.value;
        if (!value) return;

        console.log('Receiving BLE data');

        const parsed = parseBleBase64Data(value, listener.defaultPatientId);
        if (!parsed.ok) {
          listener.onError(parsed.error);
          return;
        }

        listener.onRaw(parsed.rawText);
        console.log('Receiving BLE data:', parsed.rawText);
        listener.onPacket(parsed.packet, { rawText: parsed.rawText, format: parsed.format });
      }
    );

    console.log('[BLE] Subscribed to notifications');
  }
}

const nativeBleService = new BleServiceImpl();

/** Web-safe no-op implementation */
const webBleService = {
  async getBluetoothState() {
    return 'unsupported-web';
  },
  startScan(_onDevice: ScanCallback, onError: ErrorCallback) {
    onError('BLE not supported, use Android build');
  },
  stopScan() {},
  async connect(_deviceId: string): Promise<Device> {
    throw new Error('BLE not supported, use Android build');
  },
  async disconnect() {},
  subscribeToVitals(args: Parameters<BleServiceImpl['subscribeToVitals']>[0]) {
    args.onError('BLE not supported, use Android build');
  },
};

/** Singleton used by useBleDashboard (unchanged API). */
export const bleService = isBleSupported() ? nativeBleService : webBleService;

/** Named exports (requested API) */
export function startScan(onDeviceFound: ScanCallback, onError: ErrorCallback): void {
  bleService.startScan(onDeviceFound, onError);
}

export function stopScan(): void {
  bleService.stopScan();
}

export async function connectToDevice(deviceId: string): Promise<Device> {
  return bleService.connect(deviceId);
}

export async function disconnectDevice(): Promise<void> {
  await bleService.disconnect();
}
