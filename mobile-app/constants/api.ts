import { Platform } from 'react-native';
import Constants from 'expo-constants';

const BACKEND_PORT = 5000;
const PRODUCTION_API_BASE = 'https://smartgloves-backend.onrender.com';

/**
 * Derives LAN hostname from Expo (Metro) so physical devices reach the dev machine.
 * Android emulator maps 10.0.2.2 to the host PC.
 */
function getDevMachineHost(): string | null {
  const fromConfig =
    Constants.expoConfig?.hostUri ??
    (Constants as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } }).manifest2?.extra
      ?.expoClient?.hostUri;

  if (typeof fromConfig === 'string' && fromConfig.includes(':')) {
    return fromConfig.split(':')[0] ?? null;
  }

  const debuggerHost = (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig
    ?.debuggerHost;
  if (typeof debuggerHost === 'string' && debuggerHost.includes(':')) {
    return debuggerHost.split(':')[0] ?? null;
  }

  const legacy = (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost;
  if (typeof legacy === 'string' && legacy.includes(':')) {
    return legacy.split(':')[0] ?? null;
  }

  return null;
}

/** Base URL for Node API (no trailing slash). */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, '');
  }

  const host = getDevMachineHost();

  if (host) {
    if (host === 'localhost' || host === '127.0.0.1') {
      if (Platform.OS === 'android') {
        return `http://10.0.2.2:${BACKEND_PORT}`;
      }
      return `http://127.0.0.1:${BACKEND_PORT}`;
    }
    return `http://${host}:${BACKEND_PORT}`;
  }

  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${BACKEND_PORT}`;
  }

  return PRODUCTION_API_BASE;
}
