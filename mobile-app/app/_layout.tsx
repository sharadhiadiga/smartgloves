import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  consumeInitialNotification,
  registerForPushNotifications,
  setupNotificationListeners,
} from '@/services/notificationService';

export const unstable_settings = {
  anchor: '(tabs)',
};

function PushNotificationRoot() {
  const router = useRouter();

  useEffect(() => {
    void registerForPushNotifications().catch((err) => {
      console.error('[Push] Registration failed:', err);
    });

    void consumeInitialNotification(router);

    return setupNotificationListeners(router);
  }, [router]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <PushNotificationRoot />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="patient/[patientId]" options={{ title: 'Patient Details' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
