import { Platform } from 'react-native';
import type { Device, Subscription, Characteristic, BleError } from 'react-native-ble-plx';
import { decode as base64Decode } from 'base-64';

type BlePlxModule = typeof import('react-native-ble-plx');

export interface BleSensorPacket {
  patientId: string;
  temperature: number;
  heartRate: number;
  spo2: number;
  gsr: number;
}

function safeJsonParse<T>(raw: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Invalid JSON' };
  }
}

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : (value as number);
  return Number.isFinite(n) ? Number(n) : null;
}

export function validateSensorPacket(raw: unknown): { ok: true; value: BleSensorPacket } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Payload is not an object' };
  const obj = raw as Record<string, unknown>;

  const patientId = typeof obj.patientId === 'string' ? obj.patientId.trim() : '';
  if (!patientId) return { ok: false, error: 'Missing patientId' };

  const temperature = toFiniteNumber(obj.temperature);
  const heartRate = toFiniteNumber(obj.heartRate);
  const spo2 = toFiniteNumber(obj.spo2);
  const gsr = toFiniteNumber(obj.gsr);
  if (temperature === null || heartRate === null || spo2 === null || gsr === null) {
    return { ok: false, error: 'temperature/heartRate/spo2/gsr must be numeric' };
  }

  return { ok: true, value: { patientId, temperature, heartRate, spo2, gsr } };
}

export function parseBleJsonPacket(base64Value: string): {
  ok: true;
  packet: BleSensorPacket;
  rawText: string;
} | {
  ok: false;
  error: string;
  rawText?: string;
} {
  try {
    const rawText = base64Decode(base64Value);
    const parsed = safeJsonParse<unknown>(rawText);
    if (!parsed.ok) return { ok: false, error: parsed.error, rawText };

    const validated = validateSensorPacket(parsed.value);
    if (!validated.ok) return { ok: false, error: validated.error, rawText };

    return { ok: true, packet: validated.value, rawText };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Base64 decode failed' };
  }
}

class BLEService {
  private manager: InstanceType<BlePlxModule['BleManager']> | null = null;
  private scanActive = false;
  private connectedDevice: Device | null = null;
  private disconnectSub: Subscription | null = null;
  private notifySub: Subscription | null = null;
  private shouldAutoReconnect = true;

  private ensureManager() {
    if (Platform.OS === 'web') {
      throw new Error('BLE is not supported on web. Use Android development build.');
    }
    if (!this.manager) {
      // Runtime require avoids web-side execution crashes (createClient undefined).
      const mod = require('react-native-ble-plx') as BlePlxModule;
      this.manager = new mod.BleManager();
    }
    return this.manager;
  }

  async getBluetoothState() {
    if (Platform.OS === 'web') return 'unsupported-web';
    const mgr = this.ensureManager();
    return await mgr.state();
  }

  startScan(onDeviceFound: (device: Device) => void, onError: (message: string) => void) {
    if (Platform.OS === 'web') {
      onError('BLE scanning is not available on web');
      return;
    }
    if (this.scanActive) return;
    const mgr = this.ensureManager();

    this.scanActive = true;
    console.log('Scanning...');
    mgr.startDeviceScan(null, { allowDuplicates: false }, (error: BleError | null, device: Device | null) => {
      if (error) {
        this.scanActive = false;
        console.log('[BLE][SCAN_ERROR]', error.message);
        onError(error.message);
        return;
      }
      if (!device) return;
      console.log('Device Found:', device.name || device.localName || 'Unnamed Device');
      onDeviceFound(device);
    });
  }

  stopScan() {
    if (!this.scanActive) return;
    this.scanActive = false;
    this.manager?.stopDeviceScan();
  }

  async connect(deviceId: string) {
    if (Platform.OS === 'web') {
      throw new Error('BLE connect is not available on web');
    }
    const mgr = this.ensureManager();

    this.stopScan();
    this.shouldAutoReconnect = true;
    const device = await mgr.connectToDevice(deviceId, { timeout: 10000, autoConnect: true });
    await device.discoverAllServicesAndCharacteristics();
    this.connectedDevice = device;
    console.log('Connected:', device.id);

    this.disconnectSub?.remove();
    this.disconnectSub = mgr.onDeviceDisconnected(device.id, (_err, disconnectedDevice) => {
      this.connectedDevice = null;
      this.notifySub?.remove();
      this.notifySub = null;
      if (this.shouldAutoReconnect && disconnectedDevice?.id) {
        void this.reconnectWithBackoff(disconnectedDevice.id);
      }
    });

    return device;
  }

  private async reconnectWithBackoff(deviceId: string) {
    const attempts = [1000, 2000, 4000];
    for (const delayMs of attempts) {
      if (!this.shouldAutoReconnect) return;
      await new Promise((r) => setTimeout(r, delayMs));
      try {
        await this.connect(deviceId);
        return;
      } catch (e: any) {
        console.log('[BLE][RECONNECT_FAIL]', e?.message ?? e);
      }
    }
  }

  async disconnect() {
    this.shouldAutoReconnect = false;
    const id = this.connectedDevice?.id;
    this.notifySub?.remove();
    this.notifySub = null;
    this.disconnectSub?.remove();
    this.disconnectSub = null;
    this.connectedDevice = null;
    if (id) {
      try {
        await this.ensureManager().cancelDeviceConnection(id);
      } catch {
        // ignore disconnect race
      }
    }
  }

  async subscribeToJsonNotifications(args: {
    serviceUUID: string;
    characteristicUUID: string;
    onRaw: (base64Value: string) => void;
    onPacket: (packet: BleSensorPacket, rawText: string) => void;
    onError: (message: string) => void;
  }) {
    if (Platform.OS === 'web') {
      throw new Error('BLE notifications are not available on web');
    }
    const device = this.connectedDevice;
    if (!device) throw new Error('No connected device');

    this.notifySub?.remove();
    this.notifySub = device.monitorCharacteristicForService(
      args.serviceUUID,
      args.characteristicUUID,
      (error: BleError | null, characteristic: Characteristic | null) => {
        if (error) {
          args.onError(error.message);
          return;
        }
        const value = characteristic?.value;
        if (!value) return;

        console.log('BLE RAW:', value);
        args.onRaw(value);

        const parsed = parseBleJsonPacket(value);
        if (!parsed.ok) {
          args.onError(parsed.error);
          return;
        }

        console.log('BLE PARSED:', parsed.packet);
        args.onPacket(parsed.packet, parsed.rawText);
      }
    );
  }
}

export const bleService = new BLEService();

