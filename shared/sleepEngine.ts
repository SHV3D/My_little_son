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
 * Pluralizes Russian nouns based on count (1 сон, 2-4 сна, 5+ снов).
 */
export function pluralizeRussian(count: number, one: string, twoToFour: string, fiveAndMore: string): string {
  const abs = Math.abs(Math.round(count));
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  let word: string;
  if (mod100 >= 11 && mod100 <= 14) {
    word = fiveAndMore;
  } else if (mod10 === 1) {
    word = one;
  } else if (mod10 >= 2 && mod10 <= 4) {
    word = twoToFour;
  } else {
    word = fiveAndMore;
  }
  return `${count} ${word}`;
}

export function formatNapsCountRussian(count: number): string {
  return pluralizeRussian(count, 'сон', 'сна', 'снов');
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
      message: `${formatNapsCountRussian(settings.napsPerDay)} × интервал ${intervalStr} при отбое в ${settings.targetBedtime} — план сходится.`,
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

  // Identify active sleep (NAP or NIGHT_SLEEP) vs completed naps
  const activeSleep = events.find(
    e => (e.eventType === 'NAP' || e.eventType === 'NIGHT_SLEEP') && (!e.endTime || e.endTime === null || e.endTime === '')
  );
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
  const isSleeping = !!activeSleep;
  const state: BabyState = isSleeping ? 'SLEEPING' : 'AWAKE';

  // Format common progress strings
  const formattedDaySleepProgress = `${formatMinutesToHoursAndMinutes(completedDaySleepMinutes)} / ${formatMinutesToHoursAndMinutes(S_target)}`;

  if (isSleeping && activeSleep) {
    const isNightSleep = activeSleep.eventType === 'NIGHT_SLEEP';
    const sleepStartTimeStr = activeSleep.startTime.includes('T')
      ? formatMinutesToTime(parseTimeToMinutes(activeSleep.startTime))
      : activeSleep.startTime;
    const sleepStartMinutes = parseTimeToMinutes(activeSleep.startTime);
    const sleepDurationMinutes = Math.max(0, currentMinutes - sleepStartMinutes);
    const formattedSleepDuration = formatMinutesToHoursAndMinutes(sleepDurationMinutes);

    if (isNightSleep) {
      return {
        state: 'SLEEPING',
        sleepDurationMinutes,
        formattedSleepDuration,
        sleepStartTime: sleepStartTimeStr,
        currentNapNumber: undefined,
        plannedCurrentNapDurationMinutes: undefined,
        wakeDeadlineTime: undefined,
        isWakeDeadlineExceeded: false,
        wakeDeadlineMessage: undefined,
        subsequentNaps: [],
        targetBedtime: settings.targetBedtime,
        projectedBedtime: settings.targetBedtime,
        isBedtimeShifted: false,
        bedtimeStatusMessage: 'цель отбоя',
        completedNapsCount,
        targetNapsCount: N_target,
        remainingNapsCount: 0,
        completedDaySleepMinutes,
        targetDaySleepMinutes: S_target,
        remainingDaySleepMinutes,
        formattedDaySleepProgress,
        formattedRemainingNaps: `ещё 0 из ${N_target}`,
        isScheduleCrunched: false,
        scheduleCrunchReason: undefined,
      };
    }

    const currentNapNumber = activeSleep.napNumber || (completedNapsCount + 1);
    const remainingNapsCount = Math.max(0, N_target - currentNapNumber);
    const formattedRemainingNaps = `ещё ${remainingNapsCount} из ${N_target}`;

    // Determine planned duration for this active nap
    let plannedCurrentNapDuration = 90;
    if (currentNapNumber === N_target && N_target > 1) {
      // It's the bridge nap
      plannedCurrentNapDuration = Math.min(40, Math.max(25, remainingDaySleepMinutes));
    } else if (N_target === 1) {
      plannedCurrentNapDuration = Math.min(120, remainingDaySleepMinutes);
    } else if (remainingNapsCount === 1) {
      // 1 nap left after this: this nap is long nap
      plannedCurrentNapDuration = Math.min(90, Math.max(60, remainingDaySleepMinutes - 35));
    } else {
      // 2 or more naps remain after this: earlier long nap
      plannedCurrentNapDuration = Math.min(
        90,
        Math.max(60, remainingDaySleepMinutes - 35 - (remainingNapsCount - 1) * 75)
      );
    }

    // Calculate subsequent naps durations
    const subsequentDurations: number[] = [];
    const remainingSleepAfterThis = Math.max(0, remainingDaySleepMinutes - plannedCurrentNapDuration);

    if (remainingNapsCount === 1) {
      if (N_target > 1) {
        subsequentDurations.push(Math.min(35, Math.max(25, remainingSleepAfterThis)));
      } else {
        subsequentDurations.push(Math.min(120, remainingSleepAfterThis));
      }
    } else if (remainingNapsCount > 1) {
      const bridgeDuration = 35;
      const longCount = remainingNapsCount - 1;
      const sleepForLong = Math.max(60 * longCount, remainingSleepAfterThis - bridgeDuration);
      let remainingLongSleep = sleepForLong;
      for (let i = 0; i < longCount; i++) {
        const remainingNapsAfterThis = longCount - 1 - i;
        const maxForThis = Math.max(60, remainingLongSleep - remainingNapsAfterThis * 75);
        const dur = Math.min(90, maxForThis);
        subsequentDurations.push(dur);
        remainingLongSleep = Math.max(0, remainingLongSleep - dur);
      }
      subsequentDurations.push(bridgeDuration);
    }

    // Wake deadline calculation:
    // sum of all subsequent wake windows (each W_min) plus all subsequent nap durations + final wake window
    const requiredTimeAfter = (remainingNapsCount + 1) * W_min + subsequentDurations.reduce((a, b) => a + b, 0);

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

    // Subsequent planned naps chain
    const subsequentNaps: PlannedNap[] = [];
    let cursor = estimatedWakeMinutes;
    for (let i = 0; i < remainingNapsCount; i++) {
      const subNapNumber = currentNapNumber + 1 + i;
      const isSubBridge = subNapNumber === N_target && N_target > 1;
      const subNapStart = cursor + W_min;
      const subNapDuration = subsequentDurations[i];
      const subNapEnd = subNapStart + subNapDuration;
      cursor = subNapEnd;

      subsequentNaps.push({
        napNumber: subNapNumber,
        isBridge: isSubBridge,
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

  if (remainingNapsCount === 0) {
    // When all daytime naps are completed:
    // Check if lastWakeMinutes + W_min > targetBedtimeMinutes.
    // If so, recalculate bedtime: projectedBedtimeMinutes = lastWakeMinutes + W_min.
    if (lastWakeMinutes + W_min > targetBedtimeMinutes) {
      projectedBedtimeMinutes = lastWakeMinutes + W_min;
      isScheduleCrunched = true;
      scheduleCrunchReason = 'Позднее пробуждение, отбой пересчитан';
    }
  } else {
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

    // Determine planned durations for all remaining naps:
    // earlier remaining naps get primary long nap durations (~75-90 min),
    // and final nap before night gets bridge nap duration (~30-35 min, minimum 20-25 min)
    const durations: number[] = [];
    if (remainingNapsCount === 1) {
      if (N_target > 1) {
        durations.push(Math.min(35, Math.max(25, remainingDaySleepMinutes)));
      } else {
        durations.push(Math.min(120, remainingDaySleepMinutes));
      }
    } else {
      const bridgeDuration = 35;
      const longCount = remainingNapsCount - 1;
      const sleepForLong = Math.max(60 * longCount, remainingDaySleepMinutes - bridgeDuration);
      let remainingLongSleep = sleepForLong;
      for (let i = 0; i < longCount; i++) {
        const remainingNapsAfterThis = longCount - 1 - i;
        const maxForThis = Math.max(60, remainingLongSleep - remainingNapsAfterThis * 75);
        const dur = Math.min(90, maxForThis);
        durations.push(dur);
        remainingLongSleep = Math.max(0, remainingLongSleep - dur);
      }
      durations.push(bridgeDuration);
    }

    // Check schedule crunch
    const effectiveNapStart = Math.max(currentMinutes, targetStartMin);
    const availableTimeUntilBed = targetBedtimeMinutes - effectiveNapStart;
    const totalWakeWindowsNeeded = remainingNapsCount * W_min;
    const totalSleepNeeded = durations.reduce((a, b) => a + b, 0);
    const totalNeeded = totalWakeWindowsNeeded + totalSleepNeeded;

    if (availableTimeUntilBed < totalNeeded) {
      isScheduleCrunched = true;
      scheduleCrunchReason = 'Сон сокращен, чтобы не сместить ночь';

      if (N_target > 1) {
        // Gracefully shrink bridge nap down to 20-25 min
        const bridgeIndex = remainingNapsCount - 1;
        const sleepWithoutBridge = totalSleepNeeded - durations[bridgeIndex];
        const availableForBridge = availableTimeUntilBed - totalWakeWindowsNeeded - sleepWithoutBridge;
        const shrunkBridge = Math.max(20, Math.min(durations[bridgeIndex], availableForBridge));
        durations[bridgeIndex] = shrunkBridge;
      } else {
        const shrunk = Math.max(20, availableTimeUntilBed - W_min);
        durations[0] = Math.min(durations[0], Math.max(20, shrunk));
      }
    }

    // Planned duration for next nap
    const plannedDuration = durations[0];
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

    // Chain subsequent naps iteratively for all remaining naps
    let cursor = effectiveNapStart + plannedDuration;
    for (let j = 1; j < remainingNapsCount; j++) {
      const subNapNumber = nextNapNumber + j;
      const isSubBridge = subNapNumber === N_target && N_target > 1;
      const subNapStart = cursor + W_min;
      const subNapDuration = durations[j];
      const subNapEnd = subNapStart + subNapDuration;
      cursor = subNapEnd;

      subsequentNaps.push({
        napNumber: subNapNumber,
        isBridge: isSubBridge,
        plannedStartTime: formatMinutesToTime(subNapStart),
        plannedEndTime: formatMinutesToTime(subNapEnd),
        plannedDurationMinutes: subNapDuration,
        formattedDuration: formatDurationRussian(subNapDuration),
        formattedWindow: `${formatMinutesToTime(subNapStart)} – ${formatMinutesToTime(subNapEnd)}`,
      });
    }

    // Final bedtime calculation after all naps and final wake window
    const finalBedtimeMinutes = cursor + W_min;
    if (finalBedtimeMinutes > targetBedtimeMinutes) {
      projectedBedtimeMinutes = finalBedtimeMinutes;
    }
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
