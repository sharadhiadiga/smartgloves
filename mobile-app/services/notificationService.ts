/**
 * Remote push only — backend sends via https://exp.host/--/api/v2/push/send
 * Do NOT use scheduleNotificationAsync (only works in-app / unreliable when closed).
 */
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import type { Router } from 'expo-router';

import { getApiBaseUrl } from '@/constants/api';

export const ANDROID_CHANNEL_ID = 'default';

export const DEFAULT_DOCTOR_USER_ID =
  process.env.EXPO_PUBLIC_DOCTOR_ID?.trim() || 'doctor1';

export type PushNotificationData = {
  patientId?: string;
  screen?: 'Dashboard';
  status?: 'CRITICAL';
};

let storedPushToken: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function getStoredPushToken(): string | null {
  return storedPushToken;
}

async function configureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'default',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
  });

  console.log('[Push] Android channel configured:', ANDROID_CHANNEL_ID);
}

async function savePushTokenToBackend(userId: string, token: string): Promise<void> {
  const url = `${getApiBaseUrl()}/api/save-token`;
  console.log('📡 Sending token to backend:', token);
  console.log('[Push] POST', url, { userId });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, token }),
  });

  const text = await response.text();
  let json: { success?: boolean; user?: unknown; error?: string } = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: text };
  }

  if (!response.ok) {
    console.error('[Push] save-token failed:', response.status, json);
    throw new Error(json.error || text || `save-token failed (${response.status})`);
  }

  console.log('[Push] Backend save-token response:', json);
}

/**
 * Get Expo push token and register with backend (required for closed-app notifications).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  console.log('[Push] registerForPushNotifications');

  await configureAndroidChannel();

  if (!Device.isDevice) {
    console.log('[Push] Use a physical device + EAS build (not Expo Go)');
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;

  if (existing !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') {
    console.log('[Push] Permission denied');
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  const token = (
    await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
  ).data;

  storedPushToken = token;
  console.log('🚀 PUSH TOKEN GENERATED:', token);
  console.log('PUSH TOKEN:', token);

  try {
    await savePushTokenToBackend(DEFAULT_DOCTOR_USER_ID, token);
    console.log('[Push] Token registered for userId:', DEFAULT_DOCTOR_USER_ID);
  } catch (err) {
    console.error('[Push] Failed to save token to backend:', err);
    throw err;
  }

  return token;
}

/** Re-send cached token to backend (e.g. after dashboard mount). */
export async function ensurePushTokenOnBackend(): Promise<void> {
  if (storedPushToken) {
    console.log('[Push] Re-syncing token to backend...');
    await savePushTokenToBackend(DEFAULT_DOCTOR_USER_ID, storedPushToken);
    return;
  }
  await registerForPushNotifications();
}

export function handleNotificationNavigation(router: Router, data?: PushNotificationData): void {
  console.log('[Push] Navigate to Dashboard', data);

  if (data?.screen === 'Dashboard' || data?.patientId) {
    router.push('/(tabs)');
    return;
  }

  router.push('/(tabs)');
}

export async function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  router: Router
): Promise<void> {
  const data = (response.notification.request.content.data ?? {}) as PushNotificationData;
  console.log('[Push] Notification tap — data:', data);
  handleNotificationNavigation(router, data);
}

export function setupNotificationListeners(router: Router): () => void {
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    console.log(
      '[Push] Remote notification received:',
      notification.request.content.title,
      notification.request.content.body
    );
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    void handleNotificationResponse(response, router);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

export async function consumeInitialNotification(router: Router): Promise<void> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return;

  console.log('[Push] Opened from notification (app was closed)');
  await handleNotificationResponse(response, router);
}
