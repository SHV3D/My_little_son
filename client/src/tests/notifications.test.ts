/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isPushNotificationsSupported,
  isPushNotificationsEnabled,
  setPushNotificationsEnabled,
  requestNotificationPermission,
  sendNotification,
  checkAndDispatchScheduleNotifications,
  resetNotificationThrottle,
} from '../services/pushNotificationService';
import { DayStatusResponse } from '../api/sleepApi';

describe('pushNotificationService', () => {
  let createdNotifications: Array<{ title: string; options?: NotificationOptions }> = [];

  class MockNotification {
    static permission: NotificationPermission = 'granted';
    static requestPermission = vi.fn(async () => 'granted' as NotificationPermission);

    title: string;
    options?: NotificationOptions;

    constructor(title: string, options?: NotificationOptions) {
      this.title = title;
      this.options = options;
      createdNotifications.push({ title, options });
    }
  }

  beforeEach(() => {
    localStorage.clear();
    resetNotificationThrottle();
    createdNotifications = [];
    MockNotification.permission = 'granted';
    MockNotification.requestPermission.mockClear();

    // Assign mock Notification to global and window
    (globalThis as any).Notification = MockNotification;
    (window as any).Notification = MockNotification;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('support and settings', () => {
    it('checks whether push notifications are supported', () => {
      expect(isPushNotificationsSupported()).toBe(true);

      const originalNotification = (window as any).Notification;
      delete (window as any).Notification;
      expect(isPushNotificationsSupported()).toBe(false);
      (window as any).Notification = originalNotification;
    });

    it('manages push notifications enabled state in localStorage', () => {
      expect(isPushNotificationsEnabled()).toBe(false);

      setPushNotificationsEnabled(true);
      expect(isPushNotificationsEnabled()).toBe(true);
      expect(localStorage.getItem('mls_push_notifications_enabled')).toBe('true');

      setPushNotificationsEnabled(false);
      expect(isPushNotificationsEnabled()).toBe(false);
      expect(localStorage.getItem('mls_push_notifications_enabled')).toBe('false');
    });

    it('requests notification permission via Notification.requestPermission()', async () => {
      MockNotification.permission = 'granted';
      const result = await requestNotificationPermission();
      expect(MockNotification.requestPermission).toHaveBeenCalled();
      expect(result).toBe('granted');
    });
  });

  describe('sendNotification', () => {
    it('does not send notification if push notifications are disabled', () => {
      setPushNotificationsEnabled(false);
      const dispatched = sendNotification('Тест');
      expect(dispatched).toBe(false);
      expect(createdNotifications.length).toBe(0);
    });

    it('does not send notification if permission is not granted', () => {
      setPushNotificationsEnabled(true);
      MockNotification.permission = 'denied';
      const dispatched = sendNotification('Тест');
      expect(dispatched).toBe(false);
      expect(createdNotifications.length).toBe(0);
    });

    it('sends notification with icons when enabled and granted', () => {
      setPushNotificationsEnabled(true);
      MockNotification.permission = 'granted';
      const dispatched = sendNotification('Привет', { body: 'Текст уведомления' });
      expect(dispatched).toBe(true);
      expect(createdNotifications.length).toBe(1);
      expect(createdNotifications[0].title).toBe('Привет');
      expect(createdNotifications[0].options?.body).toBe('Текст уведомления');
      expect(createdNotifications[0].options?.icon).toBe('/icon.svg');
      expect(createdNotifications[0].options?.badge).toBe('/favicon.svg');
    });
  });

  describe('checkAndDispatchScheduleNotifications', () => {
    const baseStatus: DayStatusResponse = {
      date: '2026-10-02',
      currentTime: '14:00',
      state: 'AWAKE',
      schedule: {
        state: 'AWAKE',
        formattedAwakeDuration: '2:15',
        completedNapsCount: 1,
        targetNapsCount: 3,
        remainingNapsCount: 2,
        completedDaySleepMinutes: 60,
        targetDaySleepMinutes: 180,
        remainingDaySleepMinutes: 120,
        formattedDaySleepProgress: '1:00 / 3:00',
        formattedRemainingNaps: 'ещё 2 из 3',
        targetBedtime: '20:30',
        projectedBedtime: '20:30',
        isBedtimeShifted: false,
        bedtimeStatusMessage: 'цель отбоя',
        isScheduleCrunched: false,
        nextNap: {
          napNumber: 2,
          isBridge: false,
          targetStartTime: '14:00',
          windowStartTime: '13:50',
          windowEndTime: '14:20',
          countdownMinutes: 0,
          formattedCountdown: 'сейчас',
          plannedDurationMinutes: 60,
          formattedDuration: '1 ч 0 мин',
          formattedWindow: '13:50 – 14:20',
        },
      },
      events: [],
      child: { id: 'demo-child-1', name: 'Сын', birthDate: '2026-01-15' },
      familyMembers: [],
    };

    beforeEach(() => {
      setPushNotificationsEnabled(true);
    });

    it('dispatches "Пора спать" when awake countdown is <= 0', () => {
      checkAndDispatchScheduleNotifications(baseStatus);

      expect(createdNotifications.length).toBe(1);
      expect(createdNotifications[0].title).toBe('Пора спать малышу 😴');
      expect(createdNotifications[0].options?.body).toContain('2:15');
      expect(createdNotifications[0].options?.body).toContain('Следующий сон запланирован сейчас.');
    });

    it('dispatches "Пора будить" when sleeping and wake deadline is exceeded', () => {
      const sleepingStatus: DayStatusResponse = {
        ...baseStatus,
        state: 'SLEEPING',
        schedule: {
          ...baseStatus.schedule,
          state: 'SLEEPING',
          formattedSleepDuration: '2:10',
          isWakeDeadlineExceeded: true,
          nextNap: null,
        },
      };

      checkAndDispatchScheduleNotifications(sleepingStatus);

      expect(createdNotifications.length).toBe(1);
      expect(createdNotifications[0].title).toBe('Пора будить малыша ⏰');
      expect(createdNotifications[0].options?.body).toContain('2:10');
      expect(createdNotifications[0].options?.body).toContain('Разбудите кроху, чтобы не сместить ночной отбой.');
    });

    it('dispatches smart warning when severity is alert or warning', () => {
      const warningStatus: DayStatusResponse = {
        ...baseStatus,
        schedule: {
          ...baseStatus.schedule,
          nextNap: null, // no sleep countdown
          warnings: [
            {
              code: 'OVERTIRED',
              severity: 'warning',
              title: 'Перегул: бодрствование превышено',
              message: 'Малыш бодрствует дольше нормы. Рекомендуется уложить спать как можно скорее.',
            },
          ],
        },
      };

      checkAndDispatchScheduleNotifications(warningStatus);

      expect(createdNotifications.length).toBe(1);
      expect(createdNotifications[0].title).toBe('⚠️ Перегул: бодрствование превышено');
      expect(createdNotifications[0].options?.body).toBe(
        'Малыш бодрствует дольше нормы. Рекомендуется уложить спать как можно скорее.'
      );
    });

    it('throttles duplicate notifications within 15 minutes', () => {
      vi.useFakeTimers();
      const startTime = new Date('2026-10-02T12:00:00Z').getTime();
      vi.setSystemTime(startTime);

      // First dispatch
      checkAndDispatchScheduleNotifications(baseStatus);
      expect(createdNotifications.length).toBe(1);

      // Immediate second dispatch should be throttled
      checkAndDispatchScheduleNotifications(baseStatus);
      expect(createdNotifications.length).toBe(1);

      // 10 minutes later: still throttled (< 15 mins)
      vi.setSystemTime(startTime + 10 * 60 * 1000);
      checkAndDispatchScheduleNotifications(baseStatus);
      expect(createdNotifications.length).toBe(1);

      // 16 minutes later: throttle expired, allowed
      vi.setSystemTime(startTime + 16 * 60 * 1000);
      checkAndDispatchScheduleNotifications(baseStatus);
      expect(createdNotifications.length).toBe(2);

      vi.useRealTimers();
    });

    it('clears throttle when resetNotificationThrottle is called', () => {
      checkAndDispatchScheduleNotifications(baseStatus);
      expect(createdNotifications.length).toBe(1);

      // Should be throttled
      checkAndDispatchScheduleNotifications(baseStatus);
      expect(createdNotifications.length).toBe(1);

      // Reset
      resetNotificationThrottle();

      // Allowed again immediately
      checkAndDispatchScheduleNotifications(baseStatus);
      expect(createdNotifications.length).toBe(2);
    });

    it('does not dispatch when status is null or undefined', () => {
      checkAndDispatchScheduleNotifications(null);
      checkAndDispatchScheduleNotifications(undefined);
      expect(createdNotifications.length).toBe(0);
    });

    it('does not dispatch sleep notification if countdownMinutes > 0', () => {
      const awakeUpcomingStatus: DayStatusResponse = {
        ...baseStatus,
        schedule: {
          ...baseStatus.schedule,
          nextNap: {
            ...baseStatus.schedule.nextNap!,
            countdownMinutes: 25,
          },
        },
      };

      checkAndDispatchScheduleNotifications(awakeUpcomingStatus);
      expect(createdNotifications.length).toBe(0);
    });

    it('does not dispatch wake notification if isWakeDeadlineExceeded is false', () => {
      const sleepingNormalStatus: DayStatusResponse = {
        ...baseStatus,
        state: 'SLEEPING',
        schedule: {
          ...baseStatus.schedule,
          state: 'SLEEPING',
          isWakeDeadlineExceeded: false,
          nextNap: null,
        },
      };

      checkAndDispatchScheduleNotifications(sleepingNormalStatus);
      expect(createdNotifications.length).toBe(0);
    });

    it('ignores info severity warnings', () => {
      const infoWarningStatus: DayStatusResponse = {
        ...baseStatus,
        schedule: {
          ...baseStatus.schedule,
          nextNap: null,
          warnings: [
            {
              code: 'UNDERTIRED',
              severity: 'info',
              title: 'Недогул',
              message: 'Интервал бодрствования меньше обычного.',
            },
          ],
        },
      };

      checkAndDispatchScheduleNotifications(infoWarningStatus);
      expect(createdNotifications.length).toBe(0);
    });

    it('shares WAKE_NOW throttle key for ABNORMALLY_LONG_NAP and suppresses warning if WAKE_NOW was already sent', () => {
      const wakeStatus: DayStatusResponse = {
        ...baseStatus,
        state: 'SLEEPING',
        schedule: {
          ...baseStatus.schedule,
          state: 'SLEEPING',
          formattedSleepDuration: '2:15',
          isWakeDeadlineExceeded: true,
          nextNap: null,
        },
      };

      // 1) First dispatch sends WAKE_NOW notification
      checkAndDispatchScheduleNotifications(wakeStatus);
      expect(createdNotifications.length).toBe(1);
      expect(createdNotifications[0].title).toBe('Пора будить малыша ⏰');

      // 2) Now check status with ABNORMALLY_LONG_NAP warning within throttle interval
      const warningStatus: DayStatusResponse = {
        ...baseStatus,
        state: 'SLEEPING',
        schedule: {
          ...baseStatus.schedule,
          state: 'SLEEPING',
          formattedSleepDuration: '2:15',
          isWakeDeadlineExceeded: false,
          nextNap: null,
          warnings: [
            {
              code: 'ABNORMALLY_LONG_NAP',
              severity: 'warning',
              title: 'Слишком длинный сон',
              message: 'Пора будить малыша, сон превышает максимум.',
            },
          ],
        },
      };

      // Should be suppressed because ABNORMALLY_LONG_NAP shares the WAKE_NOW throttle key
      checkAndDispatchScheduleNotifications(warningStatus);
      expect(createdNotifications.length).toBe(1);
    });

    it('does not send duplicate notifications when both wake deadline and ABNORMALLY_LONG_NAP occur together', () => {
      const combinedStatus: DayStatusResponse = {
        ...baseStatus,
        state: 'SLEEPING',
        schedule: {
          ...baseStatus.schedule,
          state: 'SLEEPING',
          formattedSleepDuration: '2:30',
          isWakeDeadlineExceeded: true,
          nextNap: null,
          warnings: [
            {
              code: 'ABNORMALLY_LONG_NAP',
              severity: 'warning',
              title: 'Слишком длинный сон',
              message: 'Пора будить малыша, сон превышает максимум.',
            },
          ],
        },
      };

      checkAndDispatchScheduleNotifications(combinedStatus);
      // Only 1 notification dispatched (WAKE_NOW), ABNORMALLY_LONG_NAP suppressed
      expect(createdNotifications.length).toBe(1);
      expect(createdNotifications[0].title).toBe('Пора будить малыша ⏰');
    });
  });
});
