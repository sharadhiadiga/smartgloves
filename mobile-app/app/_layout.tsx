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

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  useEffect(() => {
    console.log('🚀 App started - registering for push notifications');

    registerForPushNotifications()
      .then((token) => {
        console.log('✅ PUSH TOKEN GENERATED:', token);
      })
      .catch((err) => {
        console.error('❌ Push registration error:', err);
      });
  }, []);

  useEffect(() => {
    void consumeInitialNotification(router);
    return setupNotificationListeners(router);
  }, [router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="patient/[patientId]" options={{ title: 'Patient Details' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
