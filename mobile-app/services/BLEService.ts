import { Platform } from 'react-native';
import type { BleError, Characteristic, Device, Subscription } from 'react-native-ble-plx';
import { decode as base64Decode } from 'base-64';

type BlePlxModule = typeof import('react-native-ble-plx');

export const BLE_CONNECT_TIMEOUT_MS = 15_000;

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
  process.env.EXPO_PUBLIC_BLE_SERVICE_UUID || '0000fff0-0000-1000-8000-00805f9b34fb'
).toLowerCase();

export const BLE_CHAR_UUID = (
  process.env.EXPO_PUBLIC_BLE_CHAR_UUID || '0000fff1-0000-1000-8000-00805f9b34fb'
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
type StateCallback = (state: string) => void;

/** Log every service and characteristic UUID after GATT discovery. */
export async function logDeviceGatt(device: Device): Promise<void> {
  console.log('[BLE][GATT] discoverAllServicesAndCharacteristics — starting for', device.id);
  await device.discoverAllServicesAndCharacteristics();
  console.log('[BLE][GATT] Discovery complete for', device.id);

  const services = await device.services();
  console.log('[BLE][GATT] Service count:', services.length);
  console.log('[BLE][GATT] Service UUIDs:', services.map((s) => s.uuid));

  for (const service of services) {
    try {
      const characteristics = await device.characteristicsForService(service.uuid);
      console.log(`[BLE][GATT] Service ${service.uuid} — ${characteristics.length} characteristic(s)`);
      for (const c of characteristics) {
        console.log('[BLE][GATT] Characteristic:', {
          serviceUuid: service.uuid,
          uuid: c.uuid,
          isReadable: c.isReadable,
          isNotifiable: c.isNotifiable,
          isIndicatable: c.isIndicatable,
          isWritableWithResponse: c.isWritableWithResponse,
          isWritableWithoutResponse: c.isWritableWithoutResponse,
        });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[BLE][GATT] Failed characteristics for service', service.uuid, message);
    }
  }
}

class BleServiceImpl {
  private manager: InstanceType<BlePlxModule['BleManager']> | null = null;
  private scanActive = false;
  private connectedDevice: Device | null = null;
  private disconnectSub: Subscription | null = null;
  private notifySub: Subscription | null = null;
  private stateSub: Subscription | null = null;
  private shouldAutoReconnect = false;
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
      console.log('[BLE] BleManager created');
    }
    return this.manager;
  }

  watchBluetoothState(onStateChange: StateCallback): () => void {
    if (Platform.OS === 'web') {
      onStateChange('unsupported-web');
      return () => undefined;
    }

    const mgr = this.ensureManager();
    this.stateSub?.remove();
    this.stateSub = mgr.onStateChange((state) => {
      console.log('[BLE] Bluetooth state changed:', state);
      onStateChange(state);
    });

    void mgr.state().then((state) => {
      console.log('[BLE] Initial Bluetooth state:', state);
      onStateChange(state);
    });

    return () => {
      this.stateSub?.remove();
      this.stateSub = null;
    };
  }

  async getBluetoothState(): Promise<string> {
    if (Platform.OS === 'web') return 'unsupported-web';
    const state = await this.ensureManager().state();
    console.log('[BLE] getBluetoothState:', state);
    return state;
  }

  /** Stop any active scan before starting a new one. */
  stopScan(): void {
    if (!this.scanActive && !this.manager) return;
    this.scanActive = false;
    try {
      this.manager?.stopDeviceScan();
      console.log('[BLE] Scan stopped');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[BLE] stopDeviceScan error:', message);
    }
  }

  /**
   * Generic BLE scan — no service UUID or name filters.
   * bleManager.startDeviceScan(null, null, callback)
   */
  startScan(onDeviceFound: ScanCallback, onError: ErrorCallback): void {
    if (Platform.OS === 'web') {
      onError('BLE not supported, use Android build');
      return;
    }

    this.stopScan();

    const mgr = this.ensureManager();
    this.scanActive = true;
    console.log('[BLE] Scan started (all devices, no filters)');

    mgr.startDeviceScan(null, null, (error: BleError | null, device: Device | null) => {
      if (error) {
        this.scanActive = false;
        console.log('[BLE] Scan error:', error.message, error.reason);
        onError(error.message);
        return;
      }
      if (!device?.id) return;

      console.log('[BLE] Device found:', {
        id: device.id,
        name: device.name,
        localName: device.localName,
        rssi: device.rssi,
      });
      onDeviceFound(device);
    });
  }

  async connect(
    deviceId: string,
    options?: { timeoutMs?: number; autoConnect?: boolean }
  ): Promise<Device> {
    if (Platform.OS === 'web') {
      throw new Error('BLE not supported, use Android build');
    }

    const timeoutMs = options?.timeoutMs ?? BLE_CONNECT_TIMEOUT_MS;
    const autoConnect = options?.autoConnect ?? false;

    this.stopScan();
    this.shouldAutoReconnect = false;

    const mgr = this.ensureManager();
    console.log('[BLE] Connecting to device:', deviceId, { timeoutMs, autoConnect });

    let device: Device;
    try {
      device = await mgr.connectToDevice(deviceId, { timeout: timeoutMs, autoConnect });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Connection timed out or failed';
      console.log('[BLE] Connection failed:', deviceId, message);
      throw new Error(message);
    }

    console.log('[BLE] Device connected:', device.id, device.name ?? device.localName ?? 'unnamed');
    await logDeviceGatt(device);

    this.connectedDevice = device;

    this.disconnectSub?.remove();
    this.disconnectSub = mgr.onDeviceDisconnected(device.id, (disconnectError, disconnected) => {
      if (disconnectError) {
        console.log('[BLE] Disconnect event error:', disconnectError.message);
      }
      console.log('[BLE] Device disconnected:', disconnected?.id ?? deviceId);
      this.connectedDevice = null;
      this.notifySub?.remove();
      this.notifySub = null;
    });

    if (this.vitalsListener) {
      this.attachVitalsSubscription();
    }

    return device;
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
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.log('[BLE] cancelDeviceConnection:', message);
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
      console.log('[BLE] Attaching vitals subscription to connected device');
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
    try {
      console.log('[BLE] Subscribing to notifications', { service, characteristic });
      this.notifySub = device.monitorCharacteristicForService(
        service,
        characteristic,
        (error: BleError | null, char: Characteristic | null) => {
          if (error) {
            console.log('[BLE] Notification error:', error.message);
            listener.onError(error.message);
            return;
          }
          const value = char?.value;
          if (!value) return;

          const parsed = parseBleBase64Data(value, listener.defaultPatientId);
          if (!parsed.ok) {
            listener.onError(parsed.error);
            return;
          }

          listener.onRaw(parsed.rawText);
          listener.onPacket(parsed.packet, { rawText: parsed.rawText, format: parsed.format });
        }
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to subscribe';
      console.log('[BLE] Subscription setup failed:', message);
      listener.onError(message);
    }
  }

  /** Tear down BleManager — call on app unmount. */
  destroy(): void {
    console.log('[BLE] Destroying BleManager');
    this.stopScan();
    this.notifySub?.remove();
    this.notifySub = null;
    this.disconnectSub?.remove();
    this.disconnectSub = null;
    this.stateSub?.remove();
    this.stateSub = null;
    this.connectedDevice = null;
    this.vitalsListener = null;

    if (this.manager) {
      this.manager.destroy();
      this.manager = null;
      console.log('[BLE] BleManager destroyed');
    }
  }
}

const nativeBleService = new BleServiceImpl();

/** Web-safe no-op implementation */
const webBleService = {
  async getBluetoothState() {
    return 'unsupported-web';
  },
  watchBluetoothState(onStateChange: StateCallback) {
    onStateChange('unsupported-web');
    return () => undefined;
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
  destroy() {},
};

/** Singleton used by useBleDashboard */
export const bleService = isBleSupported() ? nativeBleService : webBleService;

export function startScan(onDeviceFound: ScanCallback, onError: ErrorCallback): void {
  bleService.startScan(onDeviceFound, onError);
}

export function stopScan(): void {
  bleService.stopScan();
}

export async function connectToDevice(
  deviceId: string,
  options?: { timeoutMs?: number }
): Promise<Device> {
  return bleService.connect(deviceId, options);
}

export async function disconnectDevice(): Promise<void> {
  await bleService.disconnect();
}

export function destroyBleManager(): void {
  bleService.destroy();
}
