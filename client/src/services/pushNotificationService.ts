import { DayStatusResponse } from '../api/sleepApi';

export const PUSH_NOTIFICATIONS_STORAGE_KEY = 'mls_push_notifications_enabled';
export const NOTIFICATION_THROTTLE_MS = 15 * 60 * 1000; // 15 minutes (900,000 ms)

const lastNotificationTimestamps = new Map<string, number>();

/**
 * Checks if the browser supports Web Notifications.
 */
export function isPushNotificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Returns whether push notifications are enabled by the user in settings.
 */
export function isPushNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(PUSH_NOTIFICATIONS_STORAGE_KEY) === 'true';
}

/**
 * Persists the user's preference for push notifications.
 */
export function setPushNotificationsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PUSH_NOTIFICATIONS_STORAGE_KEY, enabled ? 'true' : 'false');
}

/**
 * Requests browser permission for notifications.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushNotificationsSupported()) {
    return 'denied';
  }
  try {
    return await Notification.requestPermission();
  } catch (err) {
    console.error('Failed to request notification permission:', err);
    return 'denied';
  }
}

/**
 * Sends a notification if enabled and permission is granted.
 * Returns true if the notification was dispatched, false otherwise.
 */
export function sendNotification(title: string, options?: NotificationOptions): boolean {
  if (!isPushNotificationsSupported() || !isPushNotificationsEnabled()) {
    return false;
  }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return false;
  }

  try {
    const notificationOptions: NotificationOptions = {
      icon: '/icon.svg',
      badge: '/favicon.svg',
      ...options,
    };
    new Notification(title, notificationOptions);
    return true;
  } catch (err) {
    console.error('Failed to send notification:', err);
    return false;
  }
}

/**
 * Clears the anti-spam throttle map. Useful for testing.
 */
export function resetNotificationThrottle(): void {
  lastNotificationTimestamps.clear();
}

/**
 * Checks schedule milestones and active smart warnings, dispatching notifications
 * with a 15-minute anti-spam throttle per notification key.
 */
export function checkAndDispatchScheduleNotifications(
  status: DayStatusResponse | null | undefined
): void {
  if (!status || !status.schedule) {
    return;
  }

  const now = Date.now();
  const schedule = status.schedule;

  // 1) "Пора спать": When AWAKE and countdown to next nap is <= 0
  if (schedule.state === 'AWAKE' && schedule.nextNap && schedule.nextNap.countdownMinutes <= 0) {
    const key = 'SLEEP_TIME';
    const lastDispatched = lastNotificationTimestamps.get(key);
    if (lastDispatched === undefined || now - lastDispatched >= NOTIFICATION_THROTTLE_MS) {
      const title = 'Пора спать малышу 😴';
      const body = `Время бодрствования подошло к концу (${schedule.formattedAwakeDuration || ''}). Следующий сон запланирован сейчас.`;
      const sent = sendNotification(title, { body });
      if (sent) {
        lastNotificationTimestamps.set(key, now);
      }
    }
  }

  // 2) "Пора будить": When SLEEPING and wake deadline is exceeded
  if (schedule.state === 'SLEEPING' && schedule.isWakeDeadlineExceeded) {
    const key = 'WAKE_NOW';
    const lastDispatched = lastNotificationTimestamps.get(key);
    if (lastDispatched === undefined || now - lastDispatched >= NOTIFICATION_THROTTLE_MS) {
      const title = 'Пора будить малыша ⏰';
      const body = `Сон длится уже ${schedule.formattedSleepDuration || ''}. Разбудите кроху, чтобы не сместить ночной отбой.`;
      const sent = sendNotification(title, { body });
      if (sent) {
        lastNotificationTimestamps.set(key, now);
      }
    }
  }

  // 3) Smart Warnings: Warnings with severity 'alert' or 'warning'
  const warnings = schedule.warnings || status.warnings || [];
  for (const warning of warnings) {
    if (warning.severity === 'alert' || warning.severity === 'warning') {
      const key = warning.code === 'ABNORMALLY_LONG_NAP' ? 'WAKE_NOW' : `WARNING_${warning.code}`;
      const lastDispatched = lastNotificationTimestamps.get(key);
      if (lastDispatched === undefined || now - lastDispatched >= NOTIFICATION_THROTTLE_MS) {
        const title = `⚠️ ${warning.title}`;
        const body = warning.message;
        const sent = sendNotification(title, { body });
        if (sent) {
          lastNotificationTimestamps.set(key, now);
        }
      }
    }
  }
}
