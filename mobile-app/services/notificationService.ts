/**
 * Remote push notifications via Expo Push Service (works when app is closed/background).
 * Do NOT use scheduleNotificationAsync — backend sends via https://exp.host/--/api/v2/push/send
 */
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import type { Router } from 'expo-router';

import { getApiBaseUrl } from '@/constants/api';

/** Android channel for remote pushes (must match backend channelId). */
export const ANDROID_PUSH_CHANNEL_ID = 'default';

export const CRITICAL_CATEGORY_ID = 'CRITICAL_ALERT';
export const VIEW_ACTION_ID = 'VIEW_ACTION';
export const DISMISS_ACTION_ID = 'DISMISS_ACTION';

/** Default doctor account for token registration — must match a doctor receiving alerts. */
export const DEFAULT_DOCTOR_USER_ID =
  process.env.EXPO_PUBLIC_DOCTOR_ID?.trim() || 'doctor1';

export type CriticalNotificationData = {
  patientId?: string;
  screen?: 'Dashboard';
  status?: 'CRITICAL';
};

let storedPushToken: string | null = null;

/** Global handler — show system alert/sound when a remote push arrives in foreground. */
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

  await Notifications.setNotificationChannelAsync(ANDROID_PUSH_CHANNEL_ID, {
    name: 'default',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  console.log('[Push] Android channel ready:', ANDROID_PUSH_CHANNEL_ID);
}

async function configureNotificationCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(CRITICAL_CATEGORY_ID, [
    {
      identifier: VIEW_ACTION_ID,
      buttonTitle: 'View',
      options: { opensAppToForeground: true },
    },
    {
      identifier: DISMISS_ACTION_ID,
      buttonTitle: 'Dismiss',
      options: { isDestructive: true },
    },
  ]);
}

async function savePushTokenToBackend(userId: string, token: string): Promise<void> {
  const url = `${getApiBaseUrl()}/api/save-token`;
  console.log('[Push] POST save-token →', url, 'userId=', userId);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, token }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `save-token failed (${response.status})`);
  }

  const json = await response.json();
  console.log('[Push] Token stored on backend:', json);
}

/**
 * Request permission, get Expo push token, register with backend.
 * Requires EAS dev build + physical device (not Expo Go for production push).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  console.log('[Push] registerForPushNotifications start');

  await configureAndroidChannel();
  await configureNotificationCategories();

  if (!Device.isDevice) {
    console.log('[Push] Physical device required for push token');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permission denied');
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  if (!projectId) {
    console.warn('[Push] Missing EAS projectId in app.json extra.eas — token may fail');
  }

  const tokenResult = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  const token = tokenResult.data;
  storedPushToken = token;

  console.log('PUSH TOKEN:', token);

  await savePushTokenToBackend(DEFAULT_DOCTOR_USER_ID, token);

  return token;
}

export function handleNotificationNavigation(router: Router, data?: CriticalNotificationData): void {
  console.log('[Push] handleNotificationNavigation', data);

  if (data?.screen === 'Dashboard' || data?.patientId) {
    router.push('/(tabs)');
    return;
  }

  router.push('/(tabs)');
}

function readNotificationData(
  response: Notifications.NotificationResponse
): CriticalNotificationData {
  return (response.notification.request.content.data ?? {}) as CriticalNotificationData;
}

export async function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  router: Router
): Promise<void> {
  const actionId = response.actionIdentifier;
  const data = readNotificationData(response);

  console.log('[Push] Notification response — action:', actionId, 'data:', data);

  if (actionId === DISMISS_ACTION_ID) {
    const notificationId = response.notification.request.identifier;
    if (notificationId) {
      await Notifications.dismissNotificationAsync(notificationId);
    }
    return;
  }

  if (
    actionId === VIEW_ACTION_ID ||
    actionId === Notifications.DEFAULT_ACTION_IDENTIFIER
  ) {
    handleNotificationNavigation(router, data);
  }
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

  console.log('[Push] App opened from notification (cold start)');
  await handleNotificationResponse(response, router);
}
