import { Alert, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { getApiBaseUrl } from '@/constants/api';

const DEFAULT_DOCTOR_ID =
  process.env.EXPO_PUBLIC_DOCTOR_ID?.trim() || 'doctor-default';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function getDoctorUserId(): string {
  return DEFAULT_DOCTOR_ID;
}

async function savePushTokenToBackend(userId: string, token: string): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/save-token`;

  console.log('[Push] Saving token to', url, 'userId=', userId);

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
  console.log('[Push] Token saved:', json);
}

/**
 * Request permission, obtain Expo push token, and register with backend.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  console.log('[Push] registerForPushNotifications start');

  if (!Device.isDevice) {
    console.log('[Push] Push notifications require a physical device');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('critical-alerts', {
      name: 'Critical Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#DC2626',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permission not granted:', finalStatus);
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  const token = tokenResponse.data;

  console.log('[Push] Expo push token:', token);

  const userId = getDoctorUserId();
  await savePushTokenToBackend(userId, token);

  return token;
}

export type NotificationNavigationHandler = (patientId: string) => void;

/**
 * Listen for foreground notifications and tap-to-open navigation.
 */
export function setupNotificationListeners(
  onNavigateToPatient: NotificationNavigationHandler
): () => void {
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    console.log('[Push] Notification received:', JSON.stringify(notification.request.content));
    const title = notification.request.content.title ?? 'Alert';
    const body = notification.request.content.body ?? '';
    Alert.alert(title, body);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as {
      patientId?: string;
      status?: string;
    };
    console.log('[Push] Notification tapped, data:', data);

    const patientId = data?.patientId;
    if (patientId && typeof patientId === 'string') {
      onNavigateToPatient(patientId);
    }
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}
