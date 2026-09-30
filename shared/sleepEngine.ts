export type SleepEventType = 'WAKEUP' | 'NAP' | 'NIGHT_SLEEP';

export interface SleepEvent {
  id?: string;
  childId?: string;
  eventType: SleepEventType;
  startTime: string; // "HH:MM" or ISO string
  endTime?: string | null; // "HH:MM" or ISO string (null/undefined if ongoing)
  durationMinutes?: number;
  napNumber?: number; // 1, 2, 3...
  note?: string;
  source?: string;
}

export interface ChildSettings {
  napsPerDay: number; // e.g. 3
  wakeIntervalMinMinutes: number; // e.g. 150 (2h 30m)
  wakeIntervalMaxMinutes: number; // e.g. 180 (3h 00m)
  totalDaySleepMinutes: number; // e.g. 200 (3h 20m)
  totalWakeMinutes?: number; // e.g. 600 (10h 00m)
  targetBedtime: string; // e.g. "20:30"
  typicalWakeupTime: string; // e.g. "07:00"
}

export type BabyState = 'AWAKE' | 'SLEEPING';

export interface PlannedNap {
  napNumber: number;
  isBridge: boolean;
  plannedStartTime: string; // "HH:MM"
  plannedEndTime: string; // "HH:MM"
  plannedDurationMinutes: number;
  formattedDuration: string; // "1 ч 30 мин" or "35 мин"
  formattedWindow?: string; // "13:25 – 13:55"
}

export interface ScheduleInput {
  settings: ChildSettings;
  currentTime: string; // "HH:MM" or ISO
  events: SleepEvent[];
  morningWakeupTime?: string; // "HH:MM"
}

export interface ScheduleOutput {
  state: BabyState;

  // Awake state specifics
  awakeDurationMinutes?: number;
  formattedAwakeDuration?: string; // "2:10"
  lastWakeTime?: string; // "HH:MM"
  batteryStep?: number; // 1 to 7

  // Sleeping state specifics
  sleepDurationMinutes?: number;
  formattedSleepDuration?: string; // "0:25"
  sleepStartTime?: string; // "HH:MM"
  currentNapNumber?: number;
  plannedCurrentNapDurationMinutes?: number;
  wakeDeadlineTime?: string; // "HH:MM"
  isWakeDeadlineExceeded?: boolean;
  wakeDeadlineMessage?: string; // "Разбудить до 14:52, иначе сдвинется отбой"

  // Next nap recommendation
  nextNap?: {
    napNumber: number;
    isBridge: boolean;
    targetStartTime: string; // "HH:MM"
    windowStartTime: string; // "HH:MM"
    windowEndTime: string; // "HH:MM"
    countdownMinutes: number;
    formattedCountdown: string; // "через ~20 мин"
    plannedDurationMinutes: number;
    formattedDuration: string; // "1 ч 30 мин"
    formattedWindow: string; // "13:25 – 13:55"
  } | null;

  // Subsequent naps
  subsequentNaps?: PlannedNap[];

  // Bedtime
  targetBedtime: string; // "20:30"
  projectedBedtime: string; // "20:30" or "20:45"
  isBedtimeShifted: boolean;
  bedtimeStatusMessage: string; // "цель отбоя" or "пересчитано"

  // Summary metrics
  completedNapsCount: number;
  targetNapsCount: number;
  remainingNapsCount: number;
  completedDaySleepMinutes: number;
  targetDaySleepMinutes: number;
  remainingDaySleepMinutes: number;
  formattedDaySleepProgress: string; // "1:15 / 3:20"
  formattedRemainingNaps: string; // "ещё 2 из 3"

  // Schedule crunch / adaptation
  isScheduleCrunched: boolean;
  scheduleCrunchReason?: string;
}

export interface SettingsInput {
  napsPerDay: number;
  wakeIntervalMinMinutes: number;
  wakeIntervalMaxMinutes: number;
  totalDaySleepMinutes: number;
  typicalWakeupTime: string;
  targetBedtime: string;
  totalWakeMinutes?: number;
}

export interface ValidationResult {
  isValid: boolean;
  status: 'valid' | 'warning' | 'error';
  message: string;
  dayLengthMinutes: number;
  minRequiredMinutes: number;
  maxRequiredMinutes: number;
  requiredMinutes: number;
  differenceMinutes: number;
}

/**
 * Parses time string ("HH:MM" or ISO) into minutes from midnight (0..1439).
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  if (timeStr.includes('T')) {
    const timePart = timeStr.split('T')[1];
    const [hh, mm] = timePart.split(':');
    return parseInt(hh, 10) * 60 + parseInt(mm, 10);
  }
  const [hh, mm] = timeStr.split(':');
  const h = parseInt(hh, 10);
  const m = parseInt(mm, 10);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

/**
 * Formats minutes from midnight to "HH:MM" string, wrapping around 24 hours.
 */
export function formatMinutesToTime(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Formats duration in minutes into "H:MM" or "0:MM" string (e.g. 130 -> "2:10").
 */
export function formatMinutesToHoursAndMinutes(totalMinutes: number): string {
  const nonNeg = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(nonNeg / 60);
  const m = nonNeg % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

/**
 * Formats duration into Russian words (e.g. "1 ч 30 мин", "35 мин", "1 ч").
 */
export function formatDurationRussian(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const hours = Math.floor(m / 60);
  const mins = m % 60;

  if (hours > 0 && mins > 0) {
    return `${hours} ч ${mins} мин`;
  }
  if (hours > 0) {
    return `${hours} ч`;
  }
  return `${mins} мин`;
}

/**
 * Calculates 7-segment battery bar step based on current awake minutes and max interval.
 * Formula from spec: min(7, max(1, floor((D_awake / W_max) * 7)))
 */
export function calculateBatteryStep(awakeMinutes: number, wakeIntervalMax: number): number {
  if (wakeIntervalMax <= 0) return 7;
  const raw = Math.floor((Math.max(0, awakeMinutes) / wakeIntervalMax) * 7);
  return Math.min(7, Math.max(1, raw));
}

/**
 * Calculates interval string format like "2:30–3:00".
 */
export function formatIntervalString(minMinutes: number, maxMinutes: number): string {
  return `${formatMinutesToHoursAndMinutes(minMinutes)}–${formatMinutesToHoursAndMinutes(maxMinutes)}`;
}

/**
 * Validates sanity of child settings against the 24-hour day structure.
 */
export function validateSettings(settings: SettingsInput): ValidationResult {
  const wakeupMin = parseTimeToMinutes(settings.typicalWakeupTime);
  const bedtimeMin = parseTimeToMinutes(settings.targetBedtime);

  let dayLength = bedtimeMin - wakeupMin;
  if (dayLength <= 0) {
    dayLength += 1440;
  }

  const wakeWindowsCount = settings.napsPerDay + 1;
  const minWakeTime = settings.totalWakeMinutes ?? (wakeWindowsCount * settings.wakeIntervalMinMinutes);
  const maxWakeTime = settings.totalWakeMinutes ?? (wakeWindowsCount * settings.wakeIntervalMaxMinutes);

  const minRequiredMinutes = settings.totalDaySleepMinutes + minWakeTime;
  const maxRequiredMinutes = settings.totalDaySleepMinutes + maxWakeTime;
  const requiredMinutes = settings.totalDaySleepMinutes + (minWakeTime + maxWakeTime) / 2;
  const differenceMinutes = dayLength - requiredMinutes;

  const intervalStr = formatIntervalString(settings.wakeIntervalMinMinutes, settings.wakeIntervalMaxMinutes);

  // Check tolerance (+- 30 minutes from min/max range)
  if (dayLength >= minRequiredMinutes - 30 && dayLength <= maxRequiredMinutes + 30) {
    return {
      isValid: true,
      status: 'valid',
      message: `${settings.napsPerDay} сна × интервал ${intervalStr} при отбое в ${settings.targetBedtime} — план сходится.`,
      dayLengthMinutes: dayLength,
      minRequiredMinutes,
      maxRequiredMinutes,
      requiredMinutes,
      differenceMinutes,
    };
  }

  if (dayLength < minRequiredMinutes - 30) {
    return {
      isValid: false,
      status: 'warning',
      message: `При таких интервалах отбой сдвинется позже ${settings.targetBedtime}. Рекомендуем сократить дневной сон или число снов.`,
      dayLengthMinutes: dayLength,
      minRequiredMinutes,
      maxRequiredMinutes,
      requiredMinutes,
      differenceMinutes,
    };
  }

  return {
    isValid: false,
    status: 'warning',
    message: `День слишком длинный для такого режима. Рекомендуем увеличить дневной сон или число снов.`,
    dayLengthMinutes: dayLength,
    minRequiredMinutes,
    maxRequiredMinutes,
    requiredMinutes,
    differenceMinutes,
  };
}

/**
 * Core adaptive sleep recommendation algorithm.
 */
export function calculateDaySchedule(input: ScheduleInput): ScheduleOutput {
  const { settings, currentTime, events } = input;
  const currentMinutes = parseTimeToMinutes(currentTime);
  const targetBedtimeMinutes = parseTimeToMinutes(settings.targetBedtime);
  const W_min = settings.wakeIntervalMinMinutes;
  const W_max = settings.wakeIntervalMaxMinutes;
  const S_target = settings.totalDaySleepMinutes;
  const N_target = settings.napsPerDay;

  // Identify active nap vs completed naps
  const activeNap = events.find(e => e.eventType === 'NAP' && (!e.endTime || e.endTime === null));
  const completedNaps = events
    .filter(e => e.eventType === 'NAP' && e.endTime != null && e.endTime !== '')
    .sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));

  const completedNapsCount = completedNaps.length;
  const completedDaySleepMinutes = completedNaps.reduce((acc, nap) => {
    if (nap.durationMinutes != null) return acc + nap.durationMinutes;
    if (nap.endTime && nap.startTime) {
      return acc + (parseTimeToMinutes(nap.endTime) - parseTimeToMinutes(nap.startTime));
    }
    return acc;
  }, 0);

  const remainingDaySleepMinutes = Math.max(0, S_target - completedDaySleepMinutes);
  const isSleeping = !!activeNap;
  const state: BabyState = isSleeping ? 'SLEEPING' : 'AWAKE';

  // Format common progress strings
  const formattedDaySleepProgress = `${formatMinutesToHoursAndMinutes(completedDaySleepMinutes)} / ${formatMinutesToHoursAndMinutes(S_target)}`;

  if (isSleeping && activeNap) {
    const sleepStartTimeStr = activeNap.startTime.includes('T')
      ? formatMinutesToTime(parseTimeToMinutes(activeNap.startTime))
      : activeNap.startTime;
    const sleepStartMinutes = parseTimeToMinutes(activeNap.startTime);
    const sleepDurationMinutes = Math.max(0, currentMinutes - sleepStartMinutes);
    const formattedSleepDuration = formatMinutesToHoursAndMinutes(sleepDurationMinutes);
    const currentNapNumber = activeNap.napNumber || (completedNapsCount + 1);

    const remainingNapsCount = Math.max(0, N_target - currentNapNumber);
    const formattedRemainingNaps = `ещё ${remainingNapsCount} из ${N_target}`;

    // Determine planned duration for this active nap
    let plannedCurrentNapDuration = 90;
    if (currentNapNumber === N_target && N_target > 1) {
      // It's the bridge nap
      plannedCurrentNapDuration = Math.min(40, Math.max(25, remainingDaySleepMinutes));
    } else if (remainingNapsCount === 1) {
      // 1 nap left after this: this nap is long nap
      plannedCurrentNapDuration = Math.min(90, Math.max(60, remainingDaySleepMinutes - 35));
    }

    // Wake deadline calculation:
    // Need: W_min + (remaining naps after this) * (subsequent nap duration + W_min)
    let requiredTimeAfter = 0;
    const subsequentNaps: PlannedNap[] = [];

    if (remainingNapsCount > 0) {
      // Next is bridge nap
      const bridgeDuration = Math.min(35, Math.max(25, remainingDaySleepMinutes - plannedCurrentNapDuration));
      requiredTimeAfter = W_min + bridgeDuration + W_min;
    } else {
      // Last nap before bed
      requiredTimeAfter = W_min;
    }

    const latestAllowedWakeForTargetBedtime = targetBedtimeMinutes - requiredTimeAfter;
    const plannedWakeTime = sleepStartMinutes + plannedCurrentNapDuration;
    const wakeDeadlineMinutes = Math.min(plannedWakeTime, latestAllowedWakeForTargetBedtime);
    const wakeDeadlineTime = formatMinutesToTime(wakeDeadlineMinutes);
    const isWakeDeadlineExceeded = currentMinutes > wakeDeadlineMinutes;

    // Projected bedtime
    const estimatedWakeMinutes = Math.max(currentMinutes, wakeDeadlineMinutes);
    let projectedBedtimeMinutes = targetBedtimeMinutes;
    let isBedtimeShifted = false;

    if (estimatedWakeMinutes + requiredTimeAfter > targetBedtimeMinutes) {
      projectedBedtimeMinutes = estimatedWakeMinutes + requiredTimeAfter;
      isBedtimeShifted = true;
    }

    const projectedBedtime = formatMinutesToTime(projectedBedtimeMinutes);
    const bedtimeStatusMessage = isBedtimeShifted ? 'пересчитано' : 'цель отбоя';
    const wakeDeadlineMessage = isWakeDeadlineExceeded
      ? `Пора будить, отбой сдвигается`
      : `Разбудить до ${wakeDeadlineTime}, иначе сдвинется отбой`;

    // Subsequent planned naps
    if (remainingNapsCount > 0) {
      const subNapNumber = currentNapNumber + 1;
      const subNapStart = estimatedWakeMinutes + W_min;
      const subNapDuration = 35;
      const subNapEnd = subNapStart + subNapDuration;

      subsequentNaps.push({
        napNumber: subNapNumber,
        isBridge: true,
        plannedStartTime: formatMinutesToTime(subNapStart),
        plannedEndTime: formatMinutesToTime(subNapEnd),
        plannedDurationMinutes: subNapDuration,
        formattedDuration: formatDurationRussian(subNapDuration),
        formattedWindow: `${formatMinutesToTime(subNapStart)} – ${formatMinutesToTime(subNapEnd)}`,
      });
    }

    return {
      state: 'SLEEPING',
      sleepDurationMinutes,
      formattedSleepDuration,
      sleepStartTime: sleepStartTimeStr,
      currentNapNumber,
      plannedCurrentNapDurationMinutes: plannedCurrentNapDuration,
      wakeDeadlineTime,
      isWakeDeadlineExceeded,
      wakeDeadlineMessage,
      subsequentNaps,
      targetBedtime: settings.targetBedtime,
      projectedBedtime,
      isBedtimeShifted,
      bedtimeStatusMessage,
      completedNapsCount,
      targetNapsCount: N_target,
      remainingNapsCount,
      completedDaySleepMinutes,
      targetDaySleepMinutes: S_target,
      remainingDaySleepMinutes,
      formattedDaySleepProgress,
      formattedRemainingNaps,
      isScheduleCrunched: isBedtimeShifted,
      scheduleCrunchReason: isBedtimeShifted ? 'Сон затянулся, отбой пересчитан' : undefined,
    };
  }

  // --- AWAKE STATE ---
  const remainingNapsCount = Math.max(0, N_target - completedNapsCount);
  const formattedRemainingNaps = `ещё ${remainingNapsCount} из ${N_target}`;

  // Find last wake time
  let lastWakeMinutes: number;
  let lastWakeTimeStr: string;

  if (completedNaps.length > 0) {
    const lastNap = completedNaps[completedNaps.length - 1];
    lastWakeMinutes = parseTimeToMinutes(lastNap.endTime!);
    lastWakeTimeStr = lastNap.endTime!.includes('T')
      ? formatMinutesToTime(lastWakeMinutes)
      : lastNap.endTime!;
  } else {
    const wakeupEvent = events.find(e => e.eventType === 'WAKEUP');
    if (wakeupEvent) {
      lastWakeMinutes = parseTimeToMinutes(wakeupEvent.startTime);
      lastWakeTimeStr = wakeupEvent.startTime.includes('T')
        ? formatMinutesToTime(lastWakeMinutes)
        : wakeupEvent.startTime;
    } else {
      const fallback = input.morningWakeupTime || settings.typicalWakeupTime;
      lastWakeMinutes = parseTimeToMinutes(fallback);
      lastWakeTimeStr = fallback;
    }
  }

  const awakeDurationMinutes = Math.max(0, currentMinutes - lastWakeMinutes);
  const formattedAwakeDuration = formatMinutesToHoursAndMinutes(awakeDurationMinutes);
  const batteryStep = calculateBatteryStep(awakeDurationMinutes, W_max);

  let nextNap: ScheduleOutput['nextNap'] = null;
  const subsequentNaps: PlannedNap[] = [];
  let isScheduleCrunched = false;
  let scheduleCrunchReason: string | undefined;
  let projectedBedtimeMinutes = targetBedtimeMinutes;

  if (remainingNapsCount > 0) {
    const nextNapNumber = completedNapsCount + 1;
    const isBridge = remainingNapsCount === 1 && N_target > 1;

    const targetStartMin = lastWakeMinutes + W_min;
    const windowEndMin = lastWakeMinutes + W_max;
    const countdownMinutes = targetStartMin - currentMinutes;

    let formattedCountdown = '';
    if (countdownMinutes > 0) {
      formattedCountdown = `через ~${countdownMinutes} мин`;
    } else if (countdownMinutes >= -(W_max - W_min)) {
      formattedCountdown = 'сейчас';
    } else {
      formattedCountdown = `пора спать (+${-countdownMinutes} мин)`;
    }

    // Planned duration distribution
    let plannedDuration = 90;
    if (remainingNapsCount === 1) {
      // Bridge nap or single final nap
      if (N_target > 1) {
        plannedDuration = Math.min(35, Math.max(25, remainingDaySleepMinutes));
      } else {
        plannedDuration = Math.min(120, remainingDaySleepMinutes);
      }
    } else if (remainingNapsCount === 2) {
      plannedDuration = Math.min(90, Math.max(60, remainingDaySleepMinutes - 35));
    }

    // Check schedule crunch
    // Available time from next nap start to target bedtime
    const effectiveNapStart = Math.max(currentMinutes, targetStartMin);
    const availableTimeUntilBed = targetBedtimeMinutes - effectiveNapStart;

    if (remainingNapsCount === 1) {
      const requiredAfter = plannedDuration + W_min;
      if (availableTimeUntilBed < requiredAfter) {
        isScheduleCrunched = true;
        scheduleCrunchReason = 'Сон сокращен, чтобы не сместить ночь';
        // Gracefully shrink bridge nap down to 20-25 min
        const shrunk = Math.max(20, availableTimeUntilBed - W_min);
        if (shrunk < plannedDuration) {
          plannedDuration = Math.min(plannedDuration, Math.max(20, shrunk));
        }
        if (effectiveNapStart + plannedDuration + W_min > targetBedtimeMinutes) {
          projectedBedtimeMinutes = effectiveNapStart + plannedDuration + W_min;
        }
      }
    } else if (remainingNapsCount === 2) {
      // Nap 2 + W_min + Bridge Nap (35m) + W_min
      const bridgeDuration = 35;
      const totalNeeded = plannedDuration + W_min + bridgeDuration + W_min;

      if (availableTimeUntilBed < totalNeeded) {
        isScheduleCrunched = true;
        scheduleCrunchReason = 'Сон сокращен, чтобы не сместить ночь';

        // Shrink bridge nap first
        const availableForBridge = availableTimeUntilBed - plannedDuration - 2 * W_min;
        const adjustedBridgeDuration = Math.max(20, Math.min(bridgeDuration, availableForBridge));

        const subNapStart = effectiveNapStart + plannedDuration + W_min;
        const subNapEnd = subNapStart + adjustedBridgeDuration;

        subsequentNaps.push({
          napNumber: nextNapNumber + 1,
          isBridge: true,
          plannedStartTime: formatMinutesToTime(subNapStart),
          plannedEndTime: formatMinutesToTime(subNapEnd),
          plannedDurationMinutes: adjustedBridgeDuration,
          formattedDuration: formatDurationRussian(adjustedBridgeDuration),
          formattedWindow: `${formatMinutesToTime(subNapStart)} – ${formatMinutesToTime(subNapEnd)}`,
        });

        if (subNapEnd + W_min > targetBedtimeMinutes) {
          projectedBedtimeMinutes = subNapEnd + W_min;
        }
      } else {
        // Standard distribution without crunch
        const subNapStart = effectiveNapStart + plannedDuration + W_min;
        const subNapEnd = subNapStart + bridgeDuration;

        subsequentNaps.push({
          napNumber: nextNapNumber + 1,
          isBridge: true,
          plannedStartTime: formatMinutesToTime(subNapStart),
          plannedEndTime: formatMinutesToTime(subNapEnd),
          plannedDurationMinutes: bridgeDuration,
          formattedDuration: formatDurationRussian(bridgeDuration),
          formattedWindow: `${formatMinutesToTime(subNapStart)} – ${formatMinutesToTime(subNapEnd)}`,
        });
      }
    }

    nextNap = {
      napNumber: nextNapNumber,
      isBridge,
      targetStartTime: formatMinutesToTime(targetStartMin),
      windowStartTime: formatMinutesToTime(targetStartMin),
      windowEndTime: formatMinutesToTime(windowEndMin),
      countdownMinutes,
      formattedCountdown,
      plannedDurationMinutes: plannedDuration,
      formattedDuration: formatDurationRussian(plannedDuration),
      formattedWindow: `${formatMinutesToTime(targetStartMin)} – ${formatMinutesToTime(windowEndMin)}`,
    };
  }

  const isBedtimeShifted = projectedBedtimeMinutes > targetBedtimeMinutes;
  const projectedBedtime = formatMinutesToTime(projectedBedtimeMinutes);
  const bedtimeStatusMessage = isBedtimeShifted ? 'пересчитано' : 'цель отбоя';

  return {
    state,
    awakeDurationMinutes,
    formattedAwakeDuration,
    lastWakeTime: lastWakeTimeStr,
    batteryStep,
    nextNap,
    subsequentNaps,
    targetBedtime: settings.targetBedtime,
    projectedBedtime,
    isBedtimeShifted,
    bedtimeStatusMessage,
    completedNapsCount,
    targetNapsCount: N_target,
    remainingNapsCount,
    completedDaySleepMinutes,
    targetDaySleepMinutes: S_target,
    remainingDaySleepMinutes,
    formattedDaySleepProgress,
    formattedRemainingNaps,
    isScheduleCrunched,
    scheduleCrunchReason,
  };
}
