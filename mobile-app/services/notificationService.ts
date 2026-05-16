import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import type { Router } from 'expo-router';

import { getApiBaseUrl } from '@/constants/api';

export const CRITICAL_CHANNEL_ID = 'critical-alerts';
export const CRITICAL_CATEGORY_ID = 'CRITICAL_ALERT';

export const VIEW_ACTION_ID = 'VIEW_ACTION';
export const DISMISS_ACTION_ID = 'DISMISS_ACTION';

const DEFAULT_DOCTOR_ID = process.env.EXPO_PUBLIC_DOCTOR_ID?.trim() || 'doctor-default';
const DISMISS_COOLDOWN_MS = Number(process.env.EXPO_PUBLIC_ALERT_DISMISS_COOLDOWN_MS) || 5 * 60 * 1000;

export type CriticalNotificationData = {
  patientId: string;
  screen: 'Dashboard';
  status?: 'CRITICAL';
};

export type CriticalPatient = {
  id: string;
  name: string;
};

const dismissedUntil = new Map<string, number>();
const lastPatientStatus = new Map<string, string>();
let storedPushToken: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function getStoredPushToken(): string | null {
  return storedPushToken;
}

export function markAlertDismissed(patientId: string): void {
  dismissedUntil.set(patientId, Date.now() + DISMISS_COOLDOWN_MS);
  console.log('[Notify] Alert dismissed for', patientId, 'until cooldown ends');
}

export function shouldSuppressCriticalAlert(patientId: string): boolean {
  const until = dismissedUntil.get(patientId);
  if (!until) return false;
  if (Date.now() >= until) {
    dismissedUntil.delete(patientId);
    return false;
  }
  return true;
}

async function configureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(CRITICAL_CHANNEL_ID, {
    name: 'Critical Alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 300, 200, 300],
    lightColor: '#DC2626',
    sound: 'default',
    enableVibrate: true,
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  console.log('[Notify] Android channel configured:', CRITICAL_CHANNEL_ID);
}

async function configureNotificationCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(CRITICAL_CATEGORY_ID, [
    {
      identifier: VIEW_ACTION_ID,
      buttonTitle: 'View',
      options: {
        opensAppToForeground: true,
      },
    },
    {
      identifier: DISMISS_ACTION_ID,
      buttonTitle: 'Dismiss',
      options: {
        isDestructive: true,
      },
    },
  ]);

  console.log('[Notify] Category configured with View / Dismiss actions');
}

async function savePushTokenToBackend(userId: string, token: string): Promise<void> {
  const url = `${getApiBaseUrl()}/api/save-token`;
  console.log('[Notify] Saving push token to backend', url);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, token }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `save-token failed (${response.status})`);
  }

  console.log('[Notify] Push token saved on backend');
}

/**
 * Request permissions, configure channels/categories, register Expo push token.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  console.log('[Notify] registerForPushNotifications start');

  await configureNotificationCategories();
  await configureAndroidChannel();

  if (!Device.isDevice) {
    console.log('[Notify] Push requires a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notify] Permission denied:', finalStatus);
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  const token = tokenResponse.data;
  storedPushToken = token;

  console.log('[Notify] Expo push token:', token);

  try {
    await savePushTokenToBackend(DEFAULT_DOCTOR_ID, token);
  } catch (err) {
    console.log('[Notify] Backend token save failed (local alerts still work):', err);
  }

  return token;
}

/**
 * Schedule a device notification (lock screen, sound, vibration).
 */
export async function sendLocalNotification(patient: CriticalPatient): Promise<string | null> {
  if (shouldSuppressCriticalAlert(patient.id)) {
    console.log('[Notify] Suppressed — user dismissed recently:', patient.id);
    return null;
  }

  const data: CriticalNotificationData = {
    patientId: patient.id,
    screen: 'Dashboard',
    status: 'CRITICAL',
  };

  console.log('[Notify] Scheduling local CRITICAL alert for', patient.id);

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '🚨 Critical Alert',
      body: `Patient ${patient.name} (ID: ${patient.id}) is CRITICAL`,
      data,
      sound: 'default',
      categoryIdentifier: CRITICAL_CATEGORY_ID,
      ...(Platform.OS === 'android' && {
        channelId: CRITICAL_CHANNEL_ID,
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 300, 200, 300],
      }),
    },
    trigger: null,
  });

  console.log('[Notify] Local notification scheduled:', notificationId);
  return notificationId;
}

/**
 * Fire alert when status transitions into Critical (not on every poll).
 */
export async function notifyCriticalIfTransition(patient: CriticalPatient & { status: string }): Promise<void> {
  const normalized = patient.status.trim().toLowerCase();
  const previous = lastPatientStatus.get(patient.id);
  lastPatientStatus.set(patient.id, normalized);

  if (normalized !== 'critical') return;
  if (previous === 'critical') return;

  console.log('[Notify] CRITICAL transition detected for', patient.id);
  await sendLocalNotification({ id: patient.id, name: patient.name });
}

export function handleNotificationNavigation(router: Router, patientId?: string): void {
  console.log('[Notify] Navigate to Dashboard', patientId ? `patientId=${patientId}` : '');

  router.push('/(tabs)');
}

function getPatientIdFromResponse(
  response: Notifications.NotificationResponse
): string | undefined {
  const data = response.notification.request.content.data as Partial<CriticalNotificationData>;
  return typeof data?.patientId === 'string' ? data.patientId : undefined;
}

/**
 * Handle tap / View / Dismiss actions.
 */
export async function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  router: Router
): Promise<void> {
  const actionId = response.actionIdentifier;
  const patientId = getPatientIdFromResponse(response);
  const notificationId = response.notification.request.identifier;

  console.log('[Notify] Response received — action:', actionId, 'patientId:', patientId);

  if (actionId === DISMISS_ACTION_ID) {
    if (patientId) {
      markAlertDismissed(patientId);
    }
    if (notificationId) {
      await Notifications.dismissNotificationAsync(notificationId);
    }
    console.log('[Notify] Dismissed by user — will not re-alert during cooldown');
    return;
  }

  if (
    actionId === VIEW_ACTION_ID ||
    actionId === Notifications.DEFAULT_ACTION_IDENTIFIER
  ) {
    handleNotificationNavigation(router, patientId);
  }
}

/**
 * Register foreground + interaction listeners (no in-app Alert).
 */
export function setupNotificationListeners(router: Router): () => void {
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    console.log(
      '[Notify] Notification received (system tray):',
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

/**
 * Handle app opened from killed state via notification.
 */
export async function consumeInitialNotification(router: Router): Promise<void> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return;

  console.log('[Notify] App opened from notification (cold start)');
  await handleNotificationResponse(response, router);
}
