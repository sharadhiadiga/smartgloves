/**
 * @deprecated Import from `@/services/notificationService` instead.
 * Re-exports kept for backward compatibility.
 */
export {
  registerForPushNotifications,
  setupNotificationListeners,
  sendLocalNotification,
  notifyCriticalIfTransition,
  handleNotificationNavigation,
  handleNotificationResponse,
  consumeInitialNotification,
  markAlertDismissed,
  shouldSuppressCriticalAlert,
  getStoredPushToken,
  CRITICAL_CHANNEL_ID,
  CRITICAL_CATEGORY_ID,
  VIEW_ACTION_ID,
  DISMISS_ACTION_ID,
  type CriticalNotificationData,
  type CriticalPatient,
} from '@/services/notificationService';
