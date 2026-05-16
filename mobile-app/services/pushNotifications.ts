/** @deprecated Use `@/services/notificationService` */
export {
  registerForPushNotifications,
  setupNotificationListeners,
  handleNotificationNavigation,
  handleNotificationResponse,
  consumeInitialNotification,
  getStoredPushToken,
  DEFAULT_DOCTOR_USER_ID,
  ANDROID_PUSH_CHANNEL_ID,
} from '@/services/notificationService';
