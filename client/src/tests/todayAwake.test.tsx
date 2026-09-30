/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AwakeHeroCard } from '../components/today/AwakeHeroCard';
import { BentoMetricsGrid } from '../components/today/BentoMetricsGrid';
import { TodayAwakePage } from '../pages/TodayAwakePage';
import { DayStatusResponse } from '../api/sleepApi';

describe('AwakeHeroCard Component', () => {
  it('renders awake timer, last wake time, and battery bar with default values', () => {
    render(
      <AwakeHeroCard
        awakeDuration="2:10"
        lastWakeTime="10:55"
        intervalString="2:30–3:00"
        batteryLevel={5}
        liveTick={false}
      />
    );

    // 1. Status pill
    const pill = screen.getByTestId('awake-status-pill');
    expect(pill.textContent).toBe('Бодрствует');

    // 2. Last wake time
    const wakeTime = screen.getByTestId('last-wake-time');
    expect(wakeTime.textContent).toBe('с 10:55');

    // 3. Awake timer
    const timer = screen.getByTestId('awake-timer');
    expect(timer.textContent).toBe('2:10');

    // 4. Battery bar
    const batteryBars = screen.getAllByTestId('battery-bar');
    expect(batteryBars).toHaveLength(7);
    const activeBars = batteryBars.filter((b) => b.getAttribute('data-active') === 'true');
    expect(activeBars).toHaveLength(5);

    // 5. Wake interval
    const interval = screen.getByTestId('wake-interval');
    expect(interval.textContent).toBe('интервал 2:30–3:00');
  });

  it('normalizes prefix when lastWakeTime and intervalString already contain Russian labels', () => {
    render(
      <AwakeHeroCard
        awakeDuration="1:45"
        lastWakeTime="с 11:20"
        intervalString="интервал 2:00–2:30"
        batteryLevel={4}
        liveTick={false}
      />
    );

    expect(screen.getByTestId('last-wake-time').textContent).toBe('с 11:20');
    expect(screen.getByTestId('wake-interval').textContent).toBe('интервал 2:00–2:30');
    expect(screen.getByTestId('awake-timer').textContent).toBe('1:45');
  });

  it('supports smooth live ticking when enabled', () => {
    vi.useFakeTimers();
    render(
      <AwakeHeroCard
        awakeDuration="2:10"
        liveTick={true}
      />
    );

    const timer = screen.getByTestId('awake-timer');
    expect(timer.textContent).toBe('2:10');

    // Fast-forward by 60 seconds (1 minute) inside act()
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(timer.textContent).toBe('2:11');

    vi.useRealTimers();
  });
});

describe('BentoMetricsGrid Component', () => {
  it('renders next nap time, bedtime, daytime progress bar, naps status squares, and subsequent nap', () => {
    render(
      <BentoMetricsGrid
        nextNapTime="13:25"
        nextNapCountdown="через ~20 мин"
        nextNapDuration="1 ч 30 мин"
        bedtime="20:30"
        bedtimeStatus="цель отбоя"
        daySleepCurrent="1:15"
        daySleepTarget="3:20"
        daySleepPercent={38}
        completedNapsCount={1}
        totalNapsCount={3}
        remainingNapsText="ещё 2 из 3"
        subsequentNapTitle="Потом: сон 3"
        subsequentNapDetails="17:25 – 18:00 · 35 мин"
      />
    );

    // Card 1: Next nap
    const cardNextNap = screen.getByTestId('card-next-nap');
    expect(cardNextNap.textContent).toContain('Следующий сон');
    expect(screen.getByTestId('next-nap-time').textContent).toBe('13:25');
    expect(screen.getByTestId('next-nap-subtext').textContent).toBe('через ~20 мин · 1 ч 30 мин');

    // Card 2: Bedtime
    const cardBedtime = screen.getByTestId('card-bedtime');
    expect(cardBedtime.textContent).toContain('Ночной сон');
    expect(screen.getByTestId('bedtime-time').textContent).toBe('20:30');
    expect(screen.getByTestId('bedtime-status').textContent).toBe('цель отбоя');

    // Card 3: Day sleep progress
    const cardDaySleep = screen.getByTestId('card-day-sleep');
    expect(cardDaySleep.textContent).toContain('Днём');
    expect(screen.getByTestId('day-sleep-text').textContent).toContain('1:15');
    expect(screen.getByTestId('day-sleep-text').textContent).toContain('/ 3:20');
    const progressFill = screen.getByTestId('day-sleep-progress-fill');
    expect(progressFill.style.width).toBe('38%');

    // Card 4: Remaining naps status squares
    const cardRemaining = screen.getByTestId('card-remaining-naps');
    expect(cardRemaining.textContent).toContain('Осталось снов');
    expect(screen.getByTestId('remaining-naps-text').textContent).toBe('ещё 2 из 3');
    const statusBoxes = screen.getAllByTestId('nap-status-box');
    expect(statusBoxes).toHaveLength(3);
    expect(statusBoxes[0].getAttribute('data-status')).toBe('completed');
    expect(statusBoxes[1].getAttribute('data-status')).toBe('remaining');
    expect(statusBoxes[2].getAttribute('data-status')).toBe('remaining');

    // Card 5: Subsequent nap
    const cardSubsequent = screen.getByTestId('card-subsequent-nap');
    expect(cardSubsequent).toBeDefined();
    expect(screen.getByTestId('subsequent-nap-title').textContent).toBe('Потом: сон 3');
    expect(screen.getByTestId('subsequent-nap-details').textContent).toBe('17:25 – 18:00 · 35 мин');
  });

  it('renders custom values and shifted bedtime correctly', () => {
    render(
      <BentoMetricsGrid
        nextNapTime="14:10"
        nextNapCountdown="сейчас"
        nextNapDuration="1 ч 15 мин"
        bedtime="21:15"
        bedtimeStatus="пересчитано"
        daySleepCurrent="2:00"
        daySleepTarget="3:00"
        daySleepPercent={67}
        completedNapsCount={2}
        totalNapsCount={3}
        remainingNapsText="ещё 1 из 3"
        subsequentNapTitle="Потом: сон 3"
        subsequentNapDetails="18:00 – 18:35 · 35 мин"
      />
    );

    expect(screen.getByTestId('next-nap-time').textContent).toBe('14:10');
    expect(screen.getByTestId('next-nap-subtext').textContent).toBe('сейчас · 1 ч 15 мин');
    expect(screen.getByTestId('bedtime-time').textContent).toBe('21:15');
    expect(screen.getByTestId('bedtime-status').textContent).toBe('пересчитано');

    const statusBoxes = screen.getAllByTestId('nap-status-box');
    expect(statusBoxes[0].getAttribute('data-status')).toBe('completed');
    expect(statusBoxes[1].getAttribute('data-status')).toBe('completed');
    expect(statusBoxes[2].getAttribute('data-status')).toBe('remaining');
    expect(screen.getByTestId('day-sleep-progress-fill').style.width).toBe('67%');
  });
});

describe('TodayAwakePage Component', () => {
  const mockInitialData: DayStatusResponse = {
    date: '2026-09-30',
    currentTime: '13:05',
    state: 'AWAKE',
    schedule: {
      state: 'AWAKE',
      awakeDurationMinutes: 130,
      formattedAwakeDuration: '2:10',
      lastWakeTime: '10:55',
      batteryStep: 5,
      targetBedtime: '20:30',
      projectedBedtime: '20:30',
      isBedtimeShifted: false,
      bedtimeStatusMessage: 'цель отбоя',
      completedNapsCount: 1,
      targetNapsCount: 3,
      remainingNapsCount: 2,
      completedDaySleepMinutes: 75,
      targetDaySleepMinutes: 200,
      remainingDaySleepMinutes: 125,
      formattedDaySleepProgress: '1:15 / 3:20',
      formattedRemainingNaps: 'ещё 2 из 3',
      isScheduleCrunched: false,
      nextNap: {
        napNumber: 2,
        isBridge: false,
        targetStartTime: '13:25',
        windowStartTime: '13:25',
        windowEndTime: '13:55',
        countdownMinutes: 20,
        formattedCountdown: 'через ~20 мин',
        plannedDurationMinutes: 90,
        formattedDuration: '1 ч 30 мин',
        formattedWindow: '13:25 – 13:55',
      },
      subsequentNaps: [
        {
          napNumber: 3,
          isBridge: true,
          plannedStartTime: '17:25',
          plannedEndTime: '18:00',
          plannedDurationMinutes: 35,
          formattedDuration: '35 мин',
          formattedWindow: '17:25 – 18:00',
        },
      ],
    },
    events: [],
    child: { id: 'demo-child-1', name: 'Малыш', birthDate: null },
    familyMembers: [
      { id: 'u1', name: 'Мама', role: 'MOM' },
      { id: 'u2', name: 'Папа', role: 'DAD' },
    ],
  };

  beforeEach(() => {
    // Mock global fetch to return status data
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockInitialData),
      })
    );
  });

  it('renders full Today Awake screen with Header, Bento blocks, Action button, and BottomNav', () => {
    render(<TodayAwakePage initialData={mockInitialData} />);

    // Screen wrapper
    expect(screen.getByTestId('today-awake-page')).toBeDefined();

    // Header
    expect(screen.getByTestId('app-header')).toBeDefined();
    expect(screen.getByTestId('header-title').textContent).toBe('Среда, 30.09');
    expect(screen.getByTestId('header-roles').textContent).toContain('Мама · Папа');

    // Awake Hero Card
    expect(screen.getByTestId('awake-hero-card')).toBeDefined();
    expect(screen.getByTestId('awake-timer').textContent).toBe('2:10');
    expect(screen.getByTestId('last-wake-time').textContent).toBe('с 10:55');

    // Bento Metrics Grid
    expect(screen.getByTestId('bento-metrics-grid')).toBeDefined();
    expect(screen.getByTestId('next-nap-time').textContent).toBe('13:25');
    expect(screen.getByTestId('bedtime-time').textContent).toBe('20:30');
    expect(screen.getByTestId('day-sleep-text').textContent).toContain('1:15');
    expect(screen.getByTestId('remaining-naps-text').textContent).toBe('ещё 2 из 3');
    expect(screen.getByTestId('subsequent-nap-title').textContent).toBe('Потом: сон 3');

    // Bottom Navigation
    expect(screen.getByTestId('bottom-nav')).toBeDefined();
    expect(screen.getByTestId('tab-today').getAttribute('data-active')).toBe('true');
  });

  it('triggers onFellAsleepClick when clicking the big "Уснул" button', () => {
    const handleFellAsleep = vi.fn();
    render(
      <TodayAwakePage
        initialData={mockInitialData}
        onFellAsleepClick={handleFellAsleep}
      />
    );

    const fellAsleepBtn = screen.getByTestId('fell-asleep-btn');
    expect(fellAsleepBtn).toBeDefined();
    expect(fellAsleepBtn.textContent).toContain('Уснул');

    fireEvent.click(fellAsleepBtn);
    expect(handleFellAsleep).toHaveBeenCalledTimes(1);
  });

  it('invokes onSelectTab when bottom navigation tab is pressed', () => {
    const handleSelectTab = vi.fn();
    render(
      <TodayAwakePage
        initialData={mockInitialData}
        onSelectTab={handleSelectTab}
      />
    );

    const calendarTab = screen.getByTestId('tab-calendar');
    fireEvent.click(calendarTab);
    expect(handleSelectTab).toHaveBeenCalledWith('calendar');
  });

  it('triggers onEditRecord when clicking a day log item in TodayAwakePage', async () => {
    const handleEditRecord = vi.fn();
    const dataWithEvents: DayStatusResponse = {
      ...mockInitialData,
      events: [
        {
          id: 'ev-wake-1',
          childId: 'demo-child-1',
          date: '2026-09-30',
          eventType: 'WAKEUP',
          napNumber: null,
          startTime: '07:00',
          endTime: null,
          formattedStartTime: '07:00',
          formattedEndTime: null,
          durationMinutes: null,
          formattedDuration: '',
          recordedByUserId: 'u1',
          recordedByName: 'Мама',
          source: 'NOW',
          isOngoing: false,
          title: 'Подъём',
          subtitle: '07:00',
        },
      ],
    };

    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(dataWithEvents),
      })
    );

    await act(async () => {
      render(
        <TodayAwakePage
          initialData={dataWithEvents}
          onEditRecord={handleEditRecord}
        />
      );
    });

    const logItems = screen.getAllByTestId('day-log-item');
    expect(logItems.length).toBeGreaterThan(0);

    fireEvent.click(logItems[0]);
    expect(handleEditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ev-wake-1',
      })
    );
  });
});
