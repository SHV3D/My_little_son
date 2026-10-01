import { describe, it, expect } from 'vitest';
import {
  calculateDaySchedule,
  validateSettings,
  parseTimeToMinutes,
  formatMinutesToTime,
  formatMinutesToHoursAndMinutes,
  formatDurationRussian,
  calculateBatteryStep,
  pluralizeRussian,
  formatNapsCountRussian,
  ChildSettings,
  SleepEvent,
  ScheduleInput,
  evaluateSleepWarnings,
  validateEventCollision,
} from './sleepEngine';
import type { SleepWarning, SleepWarningCode, WarningSeverity } from './sleepEngine';

describe('sleepEngine - Helper Functions', () => {
  it('parses time strings to minutes from midnight', () => {
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('07:10')).toBe(430);
    expect(parseTimeToMinutes('13:05')).toBe(785);
    expect(parseTimeToMinutes('20:30')).toBe(1230);
    expect(parseTimeToMinutes('2026-09-30T10:55:00')).toBe(655);
  });

  it('formats minutes from midnight to HH:MM strings', () => {
    expect(formatMinutesToTime(0)).toBe('00:00');
    expect(formatMinutesToTime(430)).toBe('07:10');
    expect(formatMinutesToTime(785)).toBe('13:05');
    expect(formatMinutesToTime(1230)).toBe('20:30');
    expect(formatMinutesToTime(1445)).toBe('00:05'); // wraps past midnight
  });

  it('formats duration to H:MM or 0:MM', () => {
    expect(formatMinutesToHoursAndMinutes(25)).toBe('0:25');
    expect(formatMinutesToHoursAndMinutes(75)).toBe('1:15');
    expect(formatMinutesToHoursAndMinutes(130)).toBe('2:10');
  });

  it('formats duration in Russian human-readable words', () => {
    expect(formatDurationRussian(25)).toBe('25 мин');
    expect(formatDurationRussian(35)).toBe('35 мин');
    expect(formatDurationRussian(60)).toBe('1 ч');
    expect(formatDurationRussian(90)).toBe('1 ч 30 мин');
    expect(formatDurationRussian(200)).toBe('3 ч 20 мин');
  });

  it('calculates 7-segment battery bar step based on wake duration and max interval', () => {
    const W_max = 180;
    // Step = min(7, max(1, floor((D_awake / W_max) * 7)))
    expect(calculateBatteryStep(0, W_max)).toBe(1);
    expect(calculateBatteryStep(20, W_max)).toBe(1);
    expect(calculateBatteryStep(80, W_max)).toBe(3); // 80/180 * 7 = 3.11 -> 3
    expect(calculateBatteryStep(130, W_max)).toBe(5); // 130/180 * 7 = 5.05 -> 5 (from 01_today_awake.html)
    expect(calculateBatteryStep(180, W_max)).toBe(7); // 180/180 * 7 = 7
    expect(calculateBatteryStep(220, W_max)).toBe(7); // clamped to 7
  });

  it('correctly pluralizes Russian words for сон / сна / снов', () => {
    expect(formatNapsCountRussian(1)).toBe('1 сон');
    expect(formatNapsCountRussian(2)).toBe('2 сна');
    expect(formatNapsCountRussian(3)).toBe('3 сна');
    expect(formatNapsCountRussian(4)).toBe('4 сна');
    expect(formatNapsCountRussian(5)).toBe('5 снов');
    expect(formatNapsCountRussian(6)).toBe('6 снов');
    expect(formatNapsCountRussian(11)).toBe('11 снов');
    expect(formatNapsCountRussian(12)).toBe('12 снов');
    expect(formatNapsCountRussian(14)).toBe('14 снов');
    expect(formatNapsCountRussian(20)).toBe('20 снов');
    expect(formatNapsCountRussian(21)).toBe('21 сон');
    expect(formatNapsCountRussian(22)).toBe('22 сна');
    expect(formatNapsCountRussian(25)).toBe('25 снов');

    expect(pluralizeRussian(1, 'сон', 'сна', 'снов')).toBe('1 сон');
    expect(pluralizeRussian(2, 'сон', 'сна', 'снов')).toBe('2 сна');
    expect(pluralizeRussian(5, 'сон', 'сна', 'снов')).toBe('5 снов');
  });
});

describe('sleepEngine - (a) Awake State Calculations', () => {
  const standardSettings: ChildSettings = {
    napsPerDay: 3,
    wakeIntervalMinMinutes: 150, // 2:30
    wakeIntervalMaxMinutes: 180, // 3:00
    totalDaySleepMinutes: 200,   // 3:20
    typicalWakeupTime: '07:00',
    targetBedtime: '20:30',
  };

  it('calculates awake duration, battery, next nap and remaining naps accurately (matching 01_today_awake.html)', () => {
    const events: SleepEvent[] = [
      {
        eventType: 'WAKEUP',
        startTime: '07:10',
      },
      {
        eventType: 'NAP',
        napNumber: 1,
        startTime: '09:40',
        endTime: '10:55',
        durationMinutes: 75,
      },
    ];

    const input: ScheduleInput = {
      settings: standardSettings,
      currentTime: '13:05',
      events,
    };

    const result = calculateDaySchedule(input);

    expect(result.state).toBe('AWAKE');
    expect(result.lastWakeTime).toBe('10:55');
    expect(result.awakeDurationMinutes).toBe(130); // 10:55 -> 13:05 = 2h 10m
    expect(result.formattedAwakeDuration).toBe('2:10');
    expect(result.batteryStep).toBe(5);

    // Next nap (Nap 2)
    expect(result.nextNap).toBeDefined();
    expect(result.nextNap?.napNumber).toBe(2);
    expect(result.nextNap?.targetStartTime).toBe('13:25'); // 10:55 + 150 min (2:30)
    expect(result.nextNap?.windowStartTime).toBe('13:25');
    expect(result.nextNap?.windowEndTime).toBe('13:55'); // 10:55 + 180 min (3:00)
    expect(result.nextNap?.countdownMinutes).toBe(20); // 13:25 - 13:05 = 20 min
    expect(result.nextNap?.formattedCountdown).toBe('через ~20 мин');
    expect(result.nextNap?.plannedDurationMinutes).toBe(90); // 1h 30m
    expect(result.nextNap?.formattedDuration).toBe('1 ч 30 мин');
    expect(result.nextNap?.isBridge).toBe(false);

    // Day sleep metrics
    expect(result.completedDaySleepMinutes).toBe(75);
    expect(result.targetDaySleepMinutes).toBe(200);
    expect(result.remainingDaySleepMinutes).toBe(125);
    expect(result.formattedDaySleepProgress).toBe('1:15 / 3:20');

    // Naps count
    expect(result.completedNapsCount).toBe(1);
    expect(result.remainingNapsCount).toBe(2);
    expect(result.formattedRemainingNaps).toBe('ещё 2 из 3');

    // Bedtime
    expect(result.targetBedtime).toBe('20:30');
    expect(result.projectedBedtime).toBe('20:30');
    expect(result.isBedtimeShifted).toBe(false);
    expect(result.bedtimeStatusMessage).toBe('цель отбоя');

    // Subsequent naps (Nap 3)
    expect(result.subsequentNaps).toHaveLength(1);
    const nap3 = result.subsequentNaps![0];
    expect(nap3.napNumber).toBe(3);
    expect(nap3.isBridge).toBe(true);
    expect(nap3.plannedStartTime).toBe('17:25'); // 13:25 + 90m + 150m = 17:25
    expect(nap3.plannedEndTime).toBe('18:00'); // 17:25 + 35m = 18:00
    expect(nap3.plannedDurationMinutes).toBe(35);
  });

  it('plans next nap and subsequent naps (Nap 2 and Nap 3) in morning state with 3 naps remaining', () => {
    const events: SleepEvent[] = [
      {
        eventType: 'WAKEUP',
        startTime: '07:00',
      },
    ];

    const input: ScheduleInput = {
      settings: standardSettings,
      currentTime: '07:30',
      events,
    };

    const result = calculateDaySchedule(input);

    expect(result.state).toBe('AWAKE');
    expect(result.lastWakeTime).toBe('07:00');
    expect(result.awakeDurationMinutes).toBe(30);
    expect(result.completedNapsCount).toBe(0);
    expect(result.remainingNapsCount).toBe(3);
    expect(result.formattedRemainingNaps).toBe('ещё 3 из 3');

    // Next nap (Nap 1)
    expect(result.nextNap).toBeDefined();
    expect(result.nextNap?.napNumber).toBe(1);
    expect(result.nextNap?.isBridge).toBe(false);
    expect(result.nextNap?.targetStartTime).toBe('09:30'); // 07:00 + 150 min
    expect(result.nextNap?.windowEndTime).toBe('10:00');   // 07:00 + 180 min
    expect(result.nextNap?.plannedDurationMinutes).toBe(90);

    // Subsequent naps chain contains Nap 2 and Nap 3
    expect(result.subsequentNaps).toHaveLength(2);

    const nap2 = result.subsequentNaps![0];
    expect(nap2.napNumber).toBe(2);
    expect(nap2.isBridge).toBe(false);
    expect(nap2.plannedDurationMinutes).toBe(75);
    expect(nap2.plannedStartTime).toBe('13:30'); // 09:30 + 90m + 150m = 13:30
    expect(nap2.plannedEndTime).toBe('14:45');   // 13:30 + 75m = 14:45

    const nap3 = result.subsequentNaps![1];
    expect(nap3.napNumber).toBe(3);
    expect(nap3.isBridge).toBe(true);
    expect(nap3.plannedDurationMinutes).toBe(35);
    expect(nap3.plannedStartTime).toBe('17:15'); // 14:45 + 150m = 17:15
    expect(nap3.plannedEndTime).toBe('17:50');   // 17:15 + 35m = 17:50

    // Sum of all 3 naps equals target day sleep
    expect(
      result.nextNap!.plannedDurationMinutes +
      nap2.plannedDurationMinutes +
      nap3.plannedDurationMinutes
    ).toBe(200);

    // Bedtime fits target without shift
    expect(result.projectedBedtime).toBe('20:30');
    expect(result.isBedtimeShifted).toBe(false);
  });

  it('recalculates bedtime when baby wakes late from the final nap with no naps remaining', () => {
    // 3 of 3 naps completed. Nap 3 ended late at 18:30.
    // Target bedtime is 20:30.
    // Wake interval W_min = 150 min (2h 30m).
    // 18:30 + 150 min = 21:00 (> 20:30 target).
    const events: SleepEvent[] = [
      { eventType: 'WAKEUP', startTime: '07:00' },
      { eventType: 'NAP', napNumber: 1, startTime: '09:30', endTime: '10:45', durationMinutes: 75 },
      { eventType: 'NAP', napNumber: 2, startTime: '13:15', endTime: '14:45', durationMinutes: 90 },
      { eventType: 'NAP', napNumber: 3, startTime: '17:45', endTime: '18:30', durationMinutes: 45 },
    ];

    const input: ScheduleInput = {
      settings: standardSettings,
      currentTime: '19:00',
      events,
    };

    const result = calculateDaySchedule(input);
    expect(result.state).toBe('AWAKE');
    expect(result.completedNapsCount).toBe(3);
    expect(result.remainingNapsCount).toBe(0);
    expect(result.nextNap).toBeNull();
    expect(result.subsequentNaps).toHaveLength(0);

    // Bedtime must be shifted to 21:00 (18:30 + 150 min)
    expect(result.isBedtimeShifted).toBe(true);
    expect(result.projectedBedtime).toBe('21:00');
    expect(result.bedtimeStatusMessage).toBe('пересчитано');
    expect(result.isScheduleCrunched).toBe(true);
  });

  it('keeps target bedtime when baby wakes on time after all naps completed', () => {
    // Nap 3 ended on time at 17:50.
    // 17:50 + 150 min = 20:20 <= 20:30 target.
    const events: SleepEvent[] = [
      { eventType: 'WAKEUP', startTime: '07:00' },
      { eventType: 'NAP', napNumber: 1, startTime: '09:30', endTime: '10:45', durationMinutes: 75 },
      { eventType: 'NAP', napNumber: 2, startTime: '13:15', endTime: '14:45', durationMinutes: 90 },
      { eventType: 'NAP', napNumber: 3, startTime: '17:15', endTime: '17:50', durationMinutes: 35 },
    ];

    const input: ScheduleInput = {
      settings: standardSettings,
      currentTime: '18:10',
      events,
    };

    const result = calculateDaySchedule(input);
    expect(result.remainingNapsCount).toBe(0);
    expect(result.isBedtimeShifted).toBe(false);
    expect(result.projectedBedtime).toBe('20:30');
    expect(result.bedtimeStatusMessage).toBe('цель отбоя');
  });
});

describe('sleepEngine - (b) Sleeping State Calculations', () => {
  const standardSettings: ChildSettings = {
    napsPerDay: 3,
    wakeIntervalMinMinutes: 150,
    wakeIntervalMaxMinutes: 180,
    totalDaySleepMinutes: 200,
    typicalWakeupTime: '07:00',
    targetBedtime: '20:30',
  };

  it('calculates sleep duration timer, wake deadline and subsequent naps when child is sleeping (matching 03_today_sleeping.html)', () => {
    const events: SleepEvent[] = [
      {
        eventType: 'WAKEUP',
        startTime: '07:10',
      },
      {
        eventType: 'NAP',
        napNumber: 1,
        startTime: '09:40',
        endTime: '10:55',
        durationMinutes: 75,
      },
      {
        eventType: 'NAP',
        napNumber: 2,
        startTime: '13:22',
        endTime: null, // actively sleeping
      },
    ];

    const input: ScheduleInput = {
      settings: standardSettings,
      currentTime: '13:47',
      events,
    };

    const result = calculateDaySchedule(input);

    expect(result.state).toBe('SLEEPING');
    expect(result.sleepStartTime).toBe('13:22');
    expect(result.sleepDurationMinutes).toBe(25);
    expect(result.formattedSleepDuration).toBe('0:25');
    expect(result.currentNapNumber).toBe(2);
    expect(result.plannedCurrentNapDurationMinutes).toBe(90);

    // Wake deadline: planned end is 13:22 + 90 = 14:52
    expect(result.wakeDeadlineTime).toBe('14:52');
    expect(result.isWakeDeadlineExceeded).toBe(false);
    expect(result.wakeDeadlineMessage).toBe('Разбудить до 14:52, иначе сдвинется отбой');

    expect(result.projectedBedtime).toBe('20:30');
    expect(result.isBedtimeShifted).toBe(false);

    // Subsequent bridge nap
    expect(result.subsequentNaps).toHaveLength(1);
    expect(result.subsequentNaps![0].napNumber).toBe(3);
    expect(result.subsequentNaps![0].isBridge).toBe(true);
    expect(result.subsequentNaps![0].plannedDurationMinutes).toBe(35);
  });

  it('recalculates bedtime when nap exceeds critical deadline', () => {
    const events: SleepEvent[] = [
      {
        eventType: 'WAKEUP',
        startTime: '07:10',
      },
      {
        eventType: 'NAP',
        napNumber: 1,
        startTime: '09:40',
        endTime: '10:55',
        durationMinutes: 75,
      },
      {
        eventType: 'NAP',
        napNumber: 2,
        startTime: '13:22',
        endTime: null,
      },
    ];

    // Suppose baby is still sleeping at 15:20 (overslept past 14:52)
    const input: ScheduleInput = {
      settings: standardSettings,
      currentTime: '15:20',
      events,
    };

    const result = calculateDaySchedule(input);

    expect(result.state).toBe('SLEEPING');
    expect(result.sleepDurationMinutes).toBe(118); // 13:22 -> 15:20
    expect(result.isWakeDeadlineExceeded).toBe(true);
    // If waking right now at 15:20:
    // + 150 min wake -> 17:50
    // + 30 min bridge nap -> 18:20
    // + 150 min wake -> 20:50 (shifted from 20:30)
    expect(result.isBedtimeShifted).toBe(true);
    expect(parseTimeToMinutes(result.projectedBedtime)).toBeGreaterThan(parseTimeToMinutes('20:30'));
    expect(result.bedtimeStatusMessage).toBe('пересчитано');
  });

  it('calculates wake deadline for the last nap of the day (before night sleep)', () => {
    const events: SleepEvent[] = [
      { eventType: 'WAKEUP', startTime: '07:00' },
      { eventType: 'NAP', napNumber: 1, startTime: '09:30', endTime: '10:45', durationMinutes: 75 },
      { eventType: 'NAP', napNumber: 2, startTime: '13:15', endTime: '14:45', durationMinutes: 90 },
      { eventType: 'NAP', napNumber: 3, startTime: '17:30', endTime: null }, // 3rd and final nap
    ];

    const input: ScheduleInput = {
      settings: standardSettings,
      currentTime: '17:45',
      events,
    };

    const result = calculateDaySchedule(input);
    expect(result.state).toBe('SLEEPING');
    expect(result.currentNapNumber).toBe(3);
    // Last nap: only 1 wake interval (150 min) before bedtime (20:30)
    // Wake deadline = 20:30 - 150 min = 18:00
    expect(result.wakeDeadlineTime).toBe('18:00');
    expect(result.subsequentNaps).toHaveLength(0);
  });

  it('calculates wake deadline for Nap 1 accounting for Nap 2, Nap 3 and all intervening wake windows', () => {
    // Child woke at 07:00 and started Nap 1 at 09:35 (a bit late)
    // Settings: targetBedtime = 20:30 (1230 min), W_min = 150 min
    // Remaining naps after Nap 1 = 2 (Nap 2: 75 min, Nap 3: 35 min)
    // Required time after Nap 1 = 3 * W_min + (75 + 35) = 450 + 110 = 560 min
    // Latest wake to meet 20:30 target = 1230 - 560 = 670 (11:10)
    // Planned wake time = 09:35 + 90m = 11:05
    // wakeDeadline = min(11:05, 11:10) = 11:05
    const events: SleepEvent[] = [
      {
        eventType: 'WAKEUP',
        startTime: '07:00',
      },
      {
        eventType: 'NAP',
        napNumber: 1,
        startTime: '09:35',
        endTime: null, // actively sleeping
      },
    ];

    const input: ScheduleInput = {
      settings: standardSettings,
      currentTime: '10:00',
      events,
    };

    const result = calculateDaySchedule(input);
    expect(result.state).toBe('SLEEPING');
    expect(result.currentNapNumber).toBe(1);
    expect(result.remainingNapsCount).toBe(2);
    expect(result.wakeDeadlineTime).toBe('11:05');
    expect(result.subsequentNaps).toHaveLength(2);
    expect(result.subsequentNaps![0].napNumber).toBe(2);
    expect(result.subsequentNaps![0].isBridge).toBe(false);
    expect(result.subsequentNaps![1].napNumber).toBe(3);
    expect(result.subsequentNaps![1].isBridge).toBe(true);

    // Now test when Nap 1 started even later at 09:50:
    // Planned wake = 09:50 + 90m = 11:20
    // But latest allowed wake = 20:30 - (3 * 150 + 75 + 35) = 11:10
    // Deadline must be clamped to 11:10!
    const lateNap1Input: ScheduleInput = {
      settings: standardSettings,
      currentTime: '10:30',
      events: [
        { eventType: 'WAKEUP', startTime: '07:00' },
        { eventType: 'NAP', napNumber: 1, startTime: '09:50', endTime: null },
      ],
    };

    const lateResult = calculateDaySchedule(lateNap1Input);
    expect(lateResult.wakeDeadlineTime).toBe('11:10');
    expect(lateResult.wakeDeadlineMessage).toBe('Разбудить до 11:10, иначе сдвинется отбой');
  });

  it('supports active NIGHT_SLEEP event properly in calculateDaySchedule', () => {
    const events: SleepEvent[] = [
      { eventType: 'WAKEUP', startTime: '07:00' },
      { eventType: 'NAP', napNumber: 1, startTime: '09:30', endTime: '10:45', durationMinutes: 75 },
      { eventType: 'NAP', napNumber: 2, startTime: '13:15', endTime: '14:45', durationMinutes: 90 },
      { eventType: 'NAP', napNumber: 3, startTime: '17:15', endTime: '17:50', durationMinutes: 35 },
      { eventType: 'NIGHT_SLEEP', startTime: '20:30', endTime: null },
    ];

    const input: ScheduleInput = {
      settings: standardSettings,
      currentTime: '21:15',
      events,
    };

    const result = calculateDaySchedule(input);
    expect(result.state).toBe('SLEEPING');
    expect(result.sleepStartTime).toBe('20:30');
    expect(result.sleepDurationMinutes).toBe(45);
    expect(result.formattedSleepDuration).toBe('0:45');
    expect(result.remainingNapsCount).toBe(0);
    expect(result.subsequentNaps).toHaveLength(0);
    expect(result.currentNapNumber).toBeUndefined();
    expect(result.wakeDeadlineTime).toBeUndefined();
  });
});

describe('sleepEngine - (c) Nap Duration Distribution', () => {
  const standardSettings: ChildSettings = {
    napsPerDay: 3,
    wakeIntervalMinMinutes: 150,
    wakeIntervalMaxMinutes: 180,
    totalDaySleepMinutes: 200, // 3h 20m
    typicalWakeupTime: '07:00',
    targetBedtime: '20:30',
  };

  it('distributes 2 remaining naps into long nap (approx 1h 30m) and bridge nap (approx 35 min)', () => {
    const events: SleepEvent[] = [
      { eventType: 'WAKEUP', startTime: '07:00' },
      { eventType: 'NAP', napNumber: 1, startTime: '09:30', endTime: '10:45', durationMinutes: 75 },
    ];

    const input: ScheduleInput = {
      settings: standardSettings,
      currentTime: '11:00',
      events,
    };

    const result = calculateDaySchedule(input);
    expect(result.remainingNapsCount).toBe(2);

    // Next nap (Nap 2): long nap
    expect(result.nextNap?.napNumber).toBe(2);
    expect(result.nextNap?.isBridge).toBe(false);
    expect(result.nextNap?.plannedDurationMinutes).toBe(90);

    // Later nap (Nap 3): bridge nap
    expect(result.subsequentNaps).toHaveLength(1);
    expect(result.subsequentNaps![0].napNumber).toBe(3);
    expect(result.subsequentNaps![0].isBridge).toBe(true);
    expect(result.subsequentNaps![0].plannedDurationMinutes).toBe(35);

    // Sum of planned naps equals remaining target sleep
    expect(result.nextNap!.plannedDurationMinutes + result.subsequentNaps![0].plannedDurationMinutes).toBe(125);
  });

  it('plans single remaining nap as bridge nap when 2 of 3 naps are completed', () => {
    const events: SleepEvent[] = [
      { eventType: 'WAKEUP', startTime: '07:00' },
      { eventType: 'NAP', napNumber: 1, startTime: '09:30', endTime: '10:45', durationMinutes: 75 },
      { eventType: 'NAP', napNumber: 2, startTime: '13:15', endTime: '14:45', durationMinutes: 90 },
    ];

    const input: ScheduleInput = {
      settings: standardSettings,
      currentTime: '15:00',
      events,
    };

    const result = calculateDaySchedule(input);
    expect(result.remainingNapsCount).toBe(1);
    expect(result.nextNap?.napNumber).toBe(3);
    expect(result.nextNap?.isBridge).toBe(true);
    expect(result.nextNap?.plannedDurationMinutes).toBe(35);
    expect(result.subsequentNaps).toHaveLength(0);
  });
});

describe('sleepEngine - (d) Schedule Crunch / Adaptation', () => {
  const standardSettings: ChildSettings = {
    napsPerDay: 3,
    wakeIntervalMinMinutes: 150,
    wakeIntervalMaxMinutes: 180,
    totalDaySleepMinutes: 200,
    typicalWakeupTime: '07:00',
    targetBedtime: '20:30',
  };

  it('gracefully shrinks bridge nap when day shifts late to keep target bedtime', () => {
    // Nap 2 finished later than planned: at 15:30 (instead of 14:55)
    const events: SleepEvent[] = [
      { eventType: 'WAKEUP', startTime: '07:00' },
      { eventType: 'NAP', napNumber: 1, startTime: '09:30', endTime: '10:45', durationMinutes: 75 },
      { eventType: 'NAP', napNumber: 2, startTime: '13:45', endTime: '15:30', durationMinutes: 105 },
    ];

    // Current time is 17:00.
    // Wake interval 150 min from 15:30 means Nap 3 starts at 18:00.
    // Time from 18:00 to 20:30 target bedtime is 150 min.
    // Normally bridge nap is 35 min + 150 min wake = 185 min needed.
    // Here we have crunch: bridge nap shrinks down to 20-25 min, or bedtime shifts slightly.
    const input: ScheduleInput = {
      settings: standardSettings,
      currentTime: '17:00',
      events,
    };

    const result = calculateDaySchedule(input);
    expect(result.isScheduleCrunched).toBe(true);
    expect(result.scheduleCrunchReason).toBeDefined();
    expect(result.nextNap?.isBridge).toBe(true);
    // Bridge nap is compressed (less than the standard 35m)
    expect(result.nextNap?.plannedDurationMinutes).toBeLessThanOrEqual(30);
    expect(result.nextNap?.plannedDurationMinutes).toBeGreaterThanOrEqual(20);
  });

  it('handles extreme day delay by suggesting bedtime adjustment or dropping bridge nap', () => {
    // Nap 2 finished very late at 17:00.
    // Available time until target bedtime 20:30 is only 210 min.
    // Wake window is 150 min. A nap at 19:30 would leave only 60m before bedtime!
    const events: SleepEvent[] = [
      { eventType: 'WAKEUP', startTime: '07:00' },
      { eventType: 'NAP', napNumber: 1, startTime: '10:30', endTime: '12:00', durationMinutes: 90 },
      { eventType: 'NAP', napNumber: 2, startTime: '15:00', endTime: '17:00', durationMinutes: 120 },
    ];

    const input: ScheduleInput = {
      settings: standardSettings,
      currentTime: '17:15',
      events,
    };

    const result = calculateDaySchedule(input);
    expect(result.isScheduleCrunched).toBe(true);
    // Either projected bedtime is shifted later or bridge nap is dropped/compacted
    expect(result.scheduleCrunchReason).toBeDefined();
  });
});

describe('sleepEngine - (e) Settings Sanity Check Validator', () => {
  it('returns valid status for standard realistic child schedule', () => {
    const validSettings = {
      napsPerDay: 3,
      wakeIntervalMinMinutes: 150, // 2:30
      wakeIntervalMaxMinutes: 180, // 3:00
      totalDaySleepMinutes: 200,   // 3:20
      typicalWakeupTime: '07:00',
      targetBedtime: '20:30',
    };

    const result = validateSettings(validSettings);
    expect(result.isValid).toBe(true);
    expect(result.status).toBe('valid');
    expect(result.message).toContain('план сходится');
    expect(result.dayLengthMinutes).toBe(810); // 13h 30m
  });

  it('detects overloaded schedule when naps and wake intervals exceed day length', () => {
    // 4 naps, 3h wake intervals, 4h day sleep = 240 + 5*180 = 1140 min needed in an 800 min day
    const overloadedSettings = {
      napsPerDay: 4,
      wakeIntervalMinMinutes: 180,
      wakeIntervalMaxMinutes: 210,
      totalDaySleepMinutes: 240,
      typicalWakeupTime: '07:00',
      targetBedtime: '20:00',
    };

    const result = validateSettings(overloadedSettings);
    expect(result.isValid).toBe(false);
    expect(result.status).toBe('warning');
    expect(result.message).toContain('сдвинется');
  });

  it('detects underloaded schedule when total wake and sleep cannot fill the day', () => {
    // 1 nap of 30 min with 90 min wake in a 14 hour day (840 min)
    const underloadedSettings = {
      napsPerDay: 1,
      wakeIntervalMinMinutes: 90,
      wakeIntervalMaxMinutes: 120,
      totalDaySleepMinutes: 30,
      typicalWakeupTime: '07:00',
      targetBedtime: '21:00',
    };

    const result = validateSettings(underloadedSettings);
    expect(result.isValid).toBe(false);
    expect(result.status).toBe('warning');
    expect(result.message).toContain('длинный');
  });

  it('uses proper Russian pluralization in validateSettings messages', () => {
    const settings1Nap = {
      napsPerDay: 1,
      wakeIntervalMinMinutes: 300,
      wakeIntervalMaxMinutes: 360,
      totalDaySleepMinutes: 120,
      typicalWakeupTime: '07:00',
      targetBedtime: '20:00',
    };
    const res1 = validateSettings(settings1Nap);
    expect(res1.isValid).toBe(true);
    expect(res1.message).toContain('1 сон × интервал');

    const settings4Naps = {
      napsPerDay: 4,
      wakeIntervalMinMinutes: 100,
      wakeIntervalMaxMinutes: 140,
      totalDaySleepMinutes: 200,
      typicalWakeupTime: '07:00',
      targetBedtime: '21:00',
    };
    const res4 = validateSettings(settings4Naps);
    expect(res4.isValid).toBe(true);
    expect(res4.message).toContain('4 сна × интервал');

    const settings5Naps = {
      napsPerDay: 5,
      wakeIntervalMinMinutes: 80,
      wakeIntervalMaxMinutes: 110,
      totalDaySleepMinutes: 240,
      typicalWakeupTime: '07:00',
      targetBedtime: '21:00',
    };
    const res5 = validateSettings(settings5Naps);
    expect(res5.isValid).toBe(true);
    expect(res5.message).toContain('5 снов × интервал');
  });
});

describe('Smart Sleep Warnings System', () => {
  const baseSettings: ChildSettings = {
    napsPerDay: 3,
    wakeIntervalMinMinutes: 150, // 2h 30m
    wakeIntervalMaxMinutes: 180, // 3h 00m
    totalDaySleepMinutes: 200,   // 3h 20m
    typicalWakeupTime: '07:00',
    targetBedtime: '20:30',
  };

  it('1. OVERTIRED: triggers warning when wake duration > max + 15 min, alert when > max + 40 min', () => {
    // max is 180 min
    // 190 min: <= 195 (not overtired yet)
    const scheduleNormal = calculateDaySchedule({
      settings: baseSettings,
      currentTime: '10:10', // 190 min after 07:00
      events: [{ eventType: 'WAKEUP', startTime: '07:00' }],
    });
    expect(scheduleNormal.warnings?.some(w => w.code === 'OVERTIRED')).toBe(false);

    // 200 min: > 180 + 15 (195), <= 180 + 40 (220) -> warning
    const scheduleWarn = calculateDaySchedule({
      settings: baseSettings,
      currentTime: '10:20', // 200 min after 07:00
      events: [{ eventType: 'WAKEUP', startTime: '07:00' }],
    });
    const overtiredWarn = scheduleWarn.warnings?.find(w => w.code === 'OVERTIRED');
    expect(overtiredWarn).toBeDefined();
    expect(overtiredWarn?.severity).toBe('warning');
    expect(overtiredWarn?.title).toBe('Малыш перегуливает');
    expect(overtiredWarn?.message).toContain('Бодрствует уже');

    // 225 min: > 180 + 40 (220) -> alert
    const scheduleAlert = calculateDaySchedule({
      settings: baseSettings,
      currentTime: '10:45', // 225 min after 07:00
      events: [{ eventType: 'WAKEUP', startTime: '07:00' }],
    });
    const overtiredAlert = scheduleAlert.warnings?.find(w => w.code === 'OVERTIRED');
    expect(overtiredAlert).toBeDefined();
    expect(overtiredAlert?.severity).toBe('alert');
  });

  it('2. UNDERTIRED: triggers info when wake duration < 60% of min interval', () => {
    // min is 150 min. 60% of 150 = 90 min.
    // 80 min: < 90 min and > 0 -> info
    const scheduleUnder = calculateDaySchedule({
      settings: baseSettings,
      currentTime: '08:20', // 80 min after 07:00
      events: [{ eventType: 'WAKEUP', startTime: '07:00' }],
    });
    const undertired = scheduleUnder.warnings?.find(w => w.code === 'UNDERTIRED');
    expect(undertired).toBeDefined();
    expect(undertired?.severity).toBe('info');
    expect(undertired?.title).toBe('Малыш ещё не устал?');
    expect(undertired?.message).toContain('минимальных');

    // 100 min: >= 90 min -> no undertired warning
    const scheduleNormal = calculateDaySchedule({
      settings: baseSettings,
      currentTime: '08:40', // 100 min after 07:00
      events: [{ eventType: 'WAKEUP', startTime: '07:00' }],
    });
    expect(scheduleNormal.warnings?.some(w => w.code === 'UNDERTIRED')).toBe(false);
  });

  it('3. DAY_BUDGET_EXHAUSTED: triggers warning when completed sleep >= target and naps remain', () => {
    // totalDaySleepMinutes = 200 min.
    // 2 completed naps totaling 205 min, 1 nap remaining (napsPerDay = 3).
    const events: SleepEvent[] = [
      { eventType: 'WAKEUP', startTime: '07:00' },
      { eventType: 'NAP', napNumber: 1, startTime: '09:30', endTime: '11:15' }, // 105 min
      { eventType: 'NAP', napNumber: 2, startTime: '13:45', endTime: '15:25' }, // 100 min (total 205 >= 200)
    ];

    const schedule = calculateDaySchedule({
      settings: baseSettings,
      currentTime: '16:00',
      events,
    });

    const warning = schedule.warnings?.find(w => w.code === 'DAY_BUDGET_EXHAUSTED');
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe('warning');
    expect(warning?.title).toBe('Лимит дневного сна исчерпан');
    expect(warning?.actionType).toBe('SHORT_BRIDGE_NAP');
    expect(warning?.message).toContain('Выспано');
  });

  it('4. ABNORMALLY_LONG_NAP: triggers alert when active nap exceeds wake deadline by > 10m or exceeds max threshold', () => {
    // Active nap #1 started at 09:30.
    // Case A: sleepDurationMinutes exceeds 135 min (multi-nap baby)
    const eventsCaseA: SleepEvent[] = [
      { eventType: 'WAKEUP', startTime: '07:00' },
      { eventType: 'NAP', napNumber: 1, startTime: '09:30' }, // ongoing
    ];
    // at 11:50, duration is 140 min (> 135 min)
    const scheduleA = calculateDaySchedule({
      settings: baseSettings,
      currentTime: '11:50',
      events: eventsCaseA,
    });
    const warningA = scheduleA.warnings?.find(w => w.code === 'ABNORMALLY_LONG_NAP');
    expect(warningA).toBeDefined();
    expect(warningA?.severity).toBe('alert');
    expect(warningA?.title).toBe('Пора будить малыша');
    expect(warningA?.actionType).toBe('WAKE_NOW');

    // Case B: 1-nap baby with nap > 180 min
    const settings1Nap: ChildSettings = {
      ...baseSettings,
      napsPerDay: 1,
      totalDaySleepMinutes: 120,
      wakeIntervalMinMinutes: 240,
      wakeIntervalMaxMinutes: 300,
    };
    const eventsCaseB: SleepEvent[] = [
      { eventType: 'WAKEUP', startTime: '07:00' },
      { eventType: 'NAP', napNumber: 1, startTime: '12:00' }, // ongoing
    ];
    // 14:05: 125 min (<= 180 min, wake deadline was 14:00 so overshoot 5m <= 10m)
    const scheduleB1 = calculateDaySchedule({
      settings: settings1Nap,
      currentTime: '14:05',
      events: eventsCaseB,
    });
    expect(scheduleB1.warnings?.some(w => w.code === 'ABNORMALLY_LONG_NAP')).toBe(false);
    // at 15:10: 190 min (> 180 min)
    const scheduleB2 = calculateDaySchedule({
      settings: settings1Nap,
      currentTime: '15:10',
      events: eventsCaseB,
    });
    expect(scheduleB2.warnings?.some(w => w.code === 'ABNORMALLY_LONG_NAP')).toBe(true);
  });

  it('5. SEVERE_DAY_DEFICIT: triggers warning when all naps completed but daytime sleep < 65% of target', () => {
    // totalDaySleepMinutes = 200 min. 65% = 130 min.
    // 3 naps completed, but only total 105 min (35 + 35 + 35).
    const events: SleepEvent[] = [
      { eventType: 'WAKEUP', startTime: '07:00' },
      { eventType: 'NAP', napNumber: 1, startTime: '09:30', endTime: '10:05' }, // 35 min
      { eventType: 'NAP', napNumber: 2, startTime: '12:35', endTime: '13:10' }, // 35 min
      { eventType: 'NAP', napNumber: 3, startTime: '15:40', endTime: '16:15' }, // 35 min (total 105 < 130)
    ];

    const schedule = calculateDaySchedule({
      settings: baseSettings,
      currentTime: '17:00',
      events,
    });

    const warning = schedule.warnings?.find(w => w.code === 'SEVERE_DAY_DEFICIT');
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe('warning');
    expect(warning?.title).toBe('Дефицит дневного сна');
    expect(warning?.actionType).toBe('EARLY_BEDTIME');
    expect(warning?.message).toContain('За день малыш поспал всего');
  });

  it('6. LATE_NAP_BEDTIME_SHIFT: triggers warning when bedtime is shifted >= 30 min', () => {
    // Target bedtime 20:30. If naps ran late, bedtime shifts to 21:15 (diff = 45 min >= 30 min).
    const events: SleepEvent[] = [
      { eventType: 'WAKEUP', startTime: '07:00' },
      { eventType: 'NAP', napNumber: 1, startTime: '10:00', endTime: '11:30' },
      { eventType: 'NAP', napNumber: 2, startTime: '14:30', endTime: '16:00' },
      { eventType: 'NAP', napNumber: 3, startTime: '18:45', endTime: '19:25' }, // late bridge nap ending at 19:25
    ];
    // with final wake window 150 min (2h 30m), bedtime shifts to 21:55
    const schedule = calculateDaySchedule({
      settings: baseSettings,
      currentTime: '19:40',
      events,
    });

    expect(schedule.isBedtimeShifted).toBe(true);
    const warning = schedule.warnings?.find(w => w.code === 'LATE_NAP_BEDTIME_SHIFT');
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe('warning');
    expect(warning?.title).toContain('Отбой сдвигается');
    expect(warning?.message).toContain('позже плана');
  });

  it('7. FALSE_NIGHT_SLEEP: triggers info when night sleep starts < 18:30 or late 3rd nap > 35m', () => {
    // Condition A: Night sleep starts at 17:45 (< 18:30)
    const eventsNightEarly: SleepEvent[] = [
      { eventType: 'WAKEUP', startTime: '07:00' },
      { eventType: 'NIGHT_SLEEP', startTime: '17:45' }, // early night sleep
    ];
    const scheduleEarlyNight = calculateDaySchedule({
      settings: baseSettings,
      currentTime: '18:00',
      events: eventsNightEarly,
    });
    const warnEarlyNight = scheduleEarlyNight.warnings?.find(w => w.code === 'FALSE_NIGHT_SLEEP');
    expect(warnEarlyNight).toBeDefined();
    expect(warnEarlyNight?.severity).toBe('info');
    expect(warnEarlyNight?.title).toBe('Ранний уход в ночь?');

    // Condition B: Nap #3 starts at 18:45 (> 18:30) and lasts 40 min (> 35 min)
    const eventsLateNap: SleepEvent[] = [
      { eventType: 'WAKEUP', startTime: '07:00' },
      { eventType: 'NAP', napNumber: 1, startTime: '09:30', endTime: '11:00' },
      { eventType: 'NAP', napNumber: 2, startTime: '14:00', endTime: '15:30' },
      { eventType: 'NAP', napNumber: 3, startTime: '18:45' }, // ongoing at 19:26 (41 min)
    ];
    const scheduleLateNap = calculateDaySchedule({
      settings: baseSettings,
      currentTime: '19:26',
      events: eventsLateNap,
    });
    const warnLateNap = scheduleLateNap.warnings?.find(w => w.code === 'FALSE_NIGHT_SLEEP');
    expect(warnLateNap).toBeDefined();
    expect(warnLateNap?.severity).toBe('info');
  });

  it('8. FORGOTTEN_WAKEUP_TIMER: triggers alert when daytime nap > 210m or night sleep active after 09:30', () => {
    // Condition A: Nap active for 220 min (> 210 min / 3.5h)
    const eventsLongNap: SleepEvent[] = [
      { eventType: 'WAKEUP', startTime: '07:00' },
      { eventType: 'NAP', napNumber: 1, startTime: '10:00' }, // ongoing at 13:45 (225 min)
    ];
    const scheduleLongNap = calculateDaySchedule({
      settings: baseSettings,
      currentTime: '13:45',
      events: eventsLongNap,
    });
    const warnNap = scheduleLongNap.warnings?.find(w => w.code === 'FORGOTTEN_WAKEUP_TIMER');
    expect(warnNap).toBeDefined();
    expect(warnNap?.severity).toBe('alert');
    expect(warnNap?.actionType).toBe('SET_WAKE_TIME');
    expect(warnNap?.title).toBe('Таймер сна всё ещё включён');

    // Condition B: Night sleep still active at 10:15 (> 09:30)
    const eventsNight: SleepEvent[] = [
      { eventType: 'NIGHT_SLEEP', startTime: '21:00' }, // active from yesterday
    ];
    const scheduleNight = calculateDaySchedule({
      settings: baseSettings,
      currentTime: '10:15',
      events: eventsNight,
    });
    const warnNight = scheduleNight.warnings?.find(w => w.code === 'FORGOTTEN_WAKEUP_TIMER');
    expect(warnNight).toBeDefined();
    expect(warnNight?.severity).toBe('alert');

    // Normal night sleep at 22:00 -> no forgotten timer warning
    const scheduleNormalNight = calculateDaySchedule({
      settings: baseSettings,
      currentTime: '22:00',
      events: eventsNight,
    });
    expect(scheduleNormalNight.warnings?.some(w => w.code === 'FORGOTTEN_WAKEUP_TIMER')).toBe(false);
  });

  it('9. validateEventCollision: detects overlapping intervals, inverted times, and future events', () => {
    const existingEvents: SleepEvent[] = [
      { id: 'ev-1', eventType: 'NAP', startTime: '10:00', endTime: '11:30' },
      { id: 'ev-2', eventType: 'NAP', startTime: '14:00', endTime: '15:30' },
    ];

    // Case A: End time before start time
    const resInverted = validateEventCollision(existingEvents, {
      startTime: '13:00',
      endTime: '12:00',
      eventType: 'NAP',
    });
    expect(resInverted.hasCollision).toBe(true);
    expect(resInverted.message).toContain('Время окончания');

    // Case B: Night sleep crossing midnight is allowed
    const resNightCrossing = validateEventCollision(existingEvents, {
      startTime: '21:00',
      endTime: '07:00',
      eventType: 'NIGHT_SLEEP',
    });
    expect(resNightCrossing.hasCollision).toBe(false);

    // Case C: Event in the future relative to currentTime
    const resFuture = validateEventCollision(
      existingEvents,
      { startTime: '16:00', endTime: '17:00', eventType: 'NAP' },
      '15:00'
    );
    expect(resFuture.hasCollision).toBe(true);
    expect(resFuture.message).toContain('будущем');

    // Case D: Overlap with existing event (11:00-12:00 overlaps with 10:00-11:30)
    const resOverlap = validateEventCollision(existingEvents, {
      startTime: '11:00',
      endTime: '12:00',
      eventType: 'NAP',
    });
    expect(resOverlap.hasCollision).toBe(true);
    expect(resOverlap.conflictingEvent?.id).toBe('ev-1');
    expect(resOverlap.message).toContain('пересекается');

    // Case E: Editing an existing event without conflict with itself
    const resSelfEdit = validateEventCollision(existingEvents, {
      id: 'ev-1',
      startTime: '09:45',
      endTime: '11:15',
      eventType: 'NAP',
    });
    expect(resSelfEdit.hasCollision).toBe(false);

    // Case F: Adjacent event (touching boundary) is valid
    const resAdjacent = validateEventCollision(existingEvents, {
      startTime: '11:30',
      endTime: '12:30',
      eventType: 'NAP',
    });
    expect(resAdjacent.hasCollision).toBe(false);
  });

  it('10. sorts warnings by severity: alert first, then warning, then info', () => {
    // Construct scenario that produces alert, warning, and info
    // E.g. awake state with overtired > 40m (alert) and day budget exhausted (warning)
    const events: SleepEvent[] = [
      { eventType: 'WAKEUP', startTime: '07:00' },
      { eventType: 'NAP', napNumber: 1, startTime: '09:00', endTime: '10:45' }, // 105 min
      { eventType: 'NAP', napNumber: 2, startTime: '12:00', endTime: '13:45' }, // 105 min (total 210 >= 200)
    ];
    // currentTime: 18:00 (awake for 255 min from 13:45 -> > 180 + 40 -> alert OVERTIRED, and warning DAY_BUDGET_EXHAUSTED)
    const schedule = calculateDaySchedule({
      settings: baseSettings,
      currentTime: '18:00',
      events,
    });

    const warnings = schedule.warnings || [];
    expect(warnings.length).toBeGreaterThanOrEqual(2);

    // Verify ordering
    const severityValues: Record<WarningSeverity, number> = { alert: 0, warning: 1, info: 2 };
    for (let i = 0; i < warnings.length - 1; i++) {
      expect(severityValues[warnings[i].severity]).toBeLessThanOrEqual(
        severityValues[warnings[i + 1].severity]
      );
    }
  });

  it('11. evaluateSleepWarnings can be called directly as a pure function', () => {
    const rawSchedule = calculateDaySchedule({
      settings: baseSettings,
      currentTime: '10:20',
      events: [{ eventType: 'WAKEUP', startTime: '07:00' }],
    });
    const standaloneWarnings: SleepWarning[] = evaluateSleepWarnings(
      rawSchedule,
      baseSettings,
      [{ eventType: 'WAKEUP', startTime: '07:00' }],
      '10:20'
    );
    expect(standaloneWarnings.length).toBeGreaterThan(0);
    const code: SleepWarningCode = standaloneWarnings[0].code;
    expect(code).toBe('OVERTIRED');
  });
});

describe('Smart Sleep Warnings - Review Findings & Edge Cases', () => {
  const baseSettings: ChildSettings = {
    napsPerDay: 3,
    wakeIntervalMinMinutes: 150,
    wakeIntervalMaxMinutes: 180,
    totalDaySleepMinutes: 200,
    typicalWakeupTime: '07:00',
    targetBedtime: '20:30',
  };

  it('triggers EVENT_TIME_COLLISION in calculateDaySchedule for inverted time events (start > end)', () => {
    const events: SleepEvent[] = [
      { eventType: 'WAKEUP', startTime: '07:00' },
      { eventType: 'NAP', napNumber: 1, startTime: '13:00', endTime: '12:00' },
    ];
    const schedule = calculateDaySchedule({
      settings: baseSettings,
      currentTime: '14:00',
      events,
    });
    const warning = schedule.warnings?.find(w => w.code === 'EVENT_TIME_COLLISION');
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe('alert');
    expect(warning?.actionType).toBe('CHECK_TIME');
    expect(warning?.message).toContain('Время окончания должно быть позже времени начала');
  });

  it('does NOT trigger FALSE_NIGHT_SLEEP when baby is awake at 14:00 after waking up from yesterday night sleep', () => {
    const events: SleepEvent[] = [
      { eventType: 'NIGHT_SLEEP', startTime: '18:15', endTime: '07:00' },
      { eventType: 'WAKEUP', startTime: '07:00' },
      { eventType: 'NAP', napNumber: 1, startTime: '09:30', endTime: '11:00' },
    ];
    const schedule = calculateDaySchedule({
      settings: baseSettings,
      currentTime: '14:00',
      events,
    });
    expect(schedule.state).toBe('AWAKE');
    expect(schedule.warnings?.some(w => w.code === 'FALSE_NIGHT_SLEEP')).toBe(false);
  });

  it('validateEventCollision with a past date (yesterday) does not falsely flag startMin > currMin as in the future', () => {
    const existingEvents: SleepEvent[] = [
      { id: 'ev-today', eventType: 'NAP', startTime: '09:00', endTime: '10:30' },
    ];
    // currentTime is 10:00 (600 mins)
    // Yesterday's nap was at 14:00-15:30 (840 mins > 600 mins)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const result = validateEventCollision(
      existingEvents,
      {
        eventType: 'NAP',
        startTime: '14:00',
        endTime: '15:30',
        date: yesterday,
      },
      '10:00'
    );
    expect(result.hasCollision).toBe(false);

    // Also verify with explicit ISO currentTime
    const resultIso = validateEventCollision(
      existingEvents,
      {
        eventType: 'NAP',
        startTime: '14:00',
        endTime: '15:30',
        date: '2026-10-01',
      },
      '2026-10-02T10:00:00'
    );
    expect(resultIso.hasCollision).toBe(false);
  });

  it('active night sleep crossing midnight detects overlap at 01:00', () => {
    // Night sleep started at 21:00, currently 01:00 and still active
    const existingEvents: SleepEvent[] = [
      { id: 'night-active', eventType: 'NIGHT_SLEEP', startTime: '21:00' },
    ];

    // Attempting to log a nap at 00:30-01:00 collides with ongoing night sleep
    const result = validateEventCollision(
      existingEvents,
      {
        eventType: 'NAP',
        startTime: '00:30',
        endTime: '01:00',
      },
      '01:00'
    );
    expect(result.hasCollision).toBe(true);
    expect(result.conflictingEvent?.id).toBe('night-active');
    expect(result.message).toContain('пересекается');
  });

  it('overnight night sleep does not treat startMin as in the future when currMin <= 14:00', () => {
    // Night sleep starting at 21:00 validated at 01:00 should not be flagged as future
    const result = validateEventCollision(
      [],
      {
        eventType: 'NIGHT_SLEEP',
        startTime: '21:00',
      },
      '01:00'
    );
    expect(result.hasCollision).toBe(false);
  });

  it('guard SEVERE_DAY_DEFICIT: only triggers when schedule.state === AWAKE (not when sleeping for the night)', () => {
    const events: SleepEvent[] = [
      { eventType: 'WAKEUP', startTime: '07:00' },
      { eventType: 'NAP', napNumber: 1, startTime: '09:30', endTime: '10:05' },
      { eventType: 'NAP', napNumber: 2, startTime: '12:35', endTime: '13:10' },
      { eventType: 'NAP', napNumber: 3, startTime: '15:40', endTime: '16:15' },
      { eventType: 'NIGHT_SLEEP', startTime: '19:30' }, // already sleeping for the night
    ];
    const schedule = calculateDaySchedule({
      settings: baseSettings,
      currentTime: '20:00',
      events,
    });
    expect(schedule.state).toBe('SLEEPING');
    expect(schedule.warnings?.some(w => w.code === 'SEVERE_DAY_DEFICIT')).toBe(false);
  });

  it('aligns DAY_BUDGET_EXHAUSTED with spec: triggers before 17:00 even with 0 remaining naps', () => {
    const events: SleepEvent[] = [
      { eventType: 'WAKEUP', startTime: '06:30' },
      { eventType: 'NAP', napNumber: 1, startTime: '08:30', endTime: '10:30' }, // 120m
      { eventType: 'NAP', napNumber: 2, startTime: '12:30', endTime: '14:30' }, // 120m (total 240 >= 200)
      { eventType: 'NAP', napNumber: 3, startTime: '15:30', endTime: '16:00' }, // 30m (3/3 naps completed)
    ];
    const schedule = calculateDaySchedule({
      settings: baseSettings,
      currentTime: '16:15', // < 17:00
      events,
    });
    expect(schedule.remainingNapsCount).toBe(0);
    expect(schedule.completedDaySleepMinutes).toBeGreaterThanOrEqual(baseSettings.totalDaySleepMinutes);
    const warning = schedule.warnings?.find(w => w.code === 'DAY_BUDGET_EXHAUSTED');
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe('warning');
  });
});


