/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SleepingHeroCard } from '../components/today/SleepingHeroCard';
import { DayLogsList, DayLogRecord } from '../components/today/DayLogsList';
import { TodaySleepingPage } from '../pages/TodaySleepingPage';
import { DayStatusResponse } from '../api/sleepApi';

describe('SleepingHeroCard Component', () => {
  it('renders sleep timer, start time, nap number, and planned duration', () => {
    render(
      <SleepingHeroCard
        napNumber={2}
        sleepStartTime="13:22"
        sleepDuration="0:25"
        plannedDurationMinutes={90}
        plannedDurationText="1 ч 30 мин"
        batteryLevel={2}
        liveTick={false}
      />
    );

    // 1. Status pill
    const pill = screen.getByTestId('sleeping-status-pill');
    expect(pill.textContent).toContain('Спит · сон 2');

    // 2. Start time
    const startTime = screen.getByTestId('sleep-start-time');
    expect(startTime.textContent).toBe('уснул в 13:22');

    // 3. Sleep timer
    const timer = screen.getByTestId('sleep-timer');
    expect(timer.textContent).toBe('0:25');

    // 4. Battery bar
    const batteryBars = screen.getAllByTestId('battery-bar');
    expect(batteryBars).toHaveLength(7);
    const activeBars = batteryBars.filter((b) => b.getAttribute('data-active') === 'true');
    expect(activeBars).toHaveLength(2);

    // 5. Planned sleep duration
    const plannedDuration = screen.getByTestId('sleep-planned-duration');
    expect(plannedDuration.textContent).toBe('план сна 1 ч 30 мин');
  });

  it('normalizes prefix when start time already contains Russian label', () => {
    render(
      <SleepingHeroCard
        napNumber="сон 3"
        sleepStartTime="уснул в 15:40"
        sleepDuration="0:10"
        plannedDurationText="план сна 40 мин"
        liveTick={false}
      />
    );

    expect(screen.getByTestId('sleep-start-time').textContent).toBe('уснул в 15:40');
    expect(screen.getByTestId('sleeping-status-pill').textContent).toContain('Спит · сон 3');
    expect(screen.getByTestId('sleep-planned-duration').textContent).toBe('план сна 40 мин');
    expect(screen.getByTestId('sleep-timer').textContent).toBe('0:10');
  });

  it('supports smooth live ticking when enabled', () => {
    vi.useFakeTimers();
    render(
      <SleepingHeroCard
        sleepDuration="0:25"
        liveTick={true}
      />
    );

    const timer = screen.getByTestId('sleep-timer');
    expect(timer.textContent).toBe('0:25');

    // Advance 60 seconds (1 minute)
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(timer.textContent).toBe('0:26');

    vi.useRealTimers();
  });
});

describe('DayLogsList Component', () => {
  it('renders default day events with authors and times', () => {
    render(<DayLogsList />);

    const list = screen.getByTestId('day-logs-list');
    expect(list).toBeDefined();

    expect(screen.getByTestId('day-logs-title').textContent).toBe('Записи за день');

    const items = screen.getAllByTestId('day-log-item');
    expect(items).toHaveLength(3);

    const titles = screen.getAllByTestId('day-log-event-title');
    expect(titles[0].textContent).toBe('Подъём');
    expect(titles[1].textContent).toBe('Сон 1 · 1:15');
    expect(titles[2].textContent).toBe('Сон 2 · идёт');

    const authors = screen.getAllByTestId('day-log-author');
    expect(authors[0].textContent).toBe('Мама');
    expect(authors[1].textContent).toBe('Папа');
    expect(authors[2].textContent).toBe('Мама');

    const times = screen.getAllByTestId('day-log-time');
    expect(times[0].textContent).toBe('07:10');
    expect(times[1].textContent).toBe('09:40 – 10:55');
    expect(times[2].textContent).toBe('13:22 – …');
  });

  it('renders custom day records and handles row click', () => {
    const customRecords: DayLogRecord[] = [
      { id: 'c1', title: 'Подъём', author: 'Папа', time: '06:45', eventType: 'WAKEUP' },
      { id: 'c2', title: 'Сон 1 · 1:30', author: 'Мама', time: '09:15 – 10:45', eventType: 'NAP' },
    ];
    const handleRecordClick = vi.fn();

    render(
      <DayLogsList
        records={customRecords}
        onRecordClick={handleRecordClick}
      />
    );

    const items = screen.getAllByTestId('day-log-item');
    expect(items).toHaveLength(2);

    fireEvent.click(items[1]);
    expect(handleRecordClick).toHaveBeenCalledWith(customRecords[1]);
  });

  it('triggers onAddRetroactiveClick when clicking "+ Добавить сон задним числом"', () => {
    const handleAddRetroactive = vi.fn();
    render(<DayLogsList onAddRetroactiveClick={handleAddRetroactive} />);

    const addBtn = screen.getByTestId('add-retroactive-sleep-btn');
    expect(addBtn).toBeDefined();
    expect(addBtn.textContent).toContain('+ Добавить сон задним числом');

    fireEvent.click(addBtn);
    expect(handleAddRetroactive).toHaveBeenCalledTimes(1);
  });
});

describe('TodaySleepingPage Component', () => {
  const mockSleepingData: DayStatusResponse = {
    date: '2026-09-30',
    currentTime: '13:47',
    state: 'SLEEPING',
    schedule: {
      state: 'SLEEPING',
      sleepDurationMinutes: 25,
      formattedSleepDuration: '0:25',
      sleepStartTime: '13:22',
      currentNapNumber: 2,
      plannedCurrentNapDurationMinutes: 90,
      wakeDeadlineTime: '14:52',
      isWakeDeadlineExceeded: false,
      wakeDeadlineMessage: 'Разбудить до 14:52, иначе сдвинется отбой',
      targetBedtime: '20:30',
      projectedBedtime: '20:25',
      isBedtimeShifted: true,
      bedtimeStatusMessage: 'пересчитано',
      completedNapsCount: 1,
      targetNapsCount: 3,
      remainingNapsCount: 1,
      completedDaySleepMinutes: 75,
      targetDaySleepMinutes: 200,
      remainingDaySleepMinutes: 125,
      formattedDaySleepProgress: '1:15 / 3:20',
      formattedRemainingNaps: 'ещё 1 из 3',
      isScheduleCrunched: false,
      subsequentNaps: [
        {
          napNumber: 3,
          isBridge: true,
          plannedStartTime: '17:20',
          plannedEndTime: '17:55',
          plannedDurationMinutes: 35,
          formattedDuration: '35 мин',
          formattedWindow: '17:20 – 17:55',
        },
      ],
    },
    events: [
      {
        id: 'e1',
        childId: 'c1',
        date: '2026-09-30',
        eventType: 'WAKEUP',
        napNumber: null,
        startTime: '07:10',
        endTime: null,
        formattedStartTime: '07:10',
        formattedEndTime: null,
        durationMinutes: null,
        formattedDuration: '',
        recordedByUserId: 'u1',
        recordedByName: 'Мама',
        source: 'NOW',
        isOngoing: false,
        title: 'Подъём',
        subtitle: '07:10',
      },
      {
        id: 'e2',
        childId: 'c1',
        date: '2026-09-30',
        eventType: 'NAP',
        napNumber: 1,
        startTime: '09:40',
        endTime: '10:55',
        formattedStartTime: '09:40',
        formattedEndTime: '10:55',
        durationMinutes: 75,
        formattedDuration: '1:15',
        recordedByUserId: 'u2',
        recordedByName: 'Папа',
        source: 'MANUAL',
        isOngoing: false,
        title: 'Сон 1 · 1:15',
        subtitle: '09:40 – 10:55',
      },
      {
        id: 'e3',
        childId: 'c1',
        date: '2026-09-30',
        eventType: 'NAP',
        napNumber: 2,
        startTime: '13:22',
        endTime: null,
        formattedStartTime: '13:22',
        formattedEndTime: null,
        durationMinutes: 25,
        formattedDuration: '0:25',
        recordedByUserId: 'u1',
        recordedByName: 'Мама',
        source: 'NOW',
        isOngoing: true,
        title: 'Сон 2 · идёт',
        subtitle: '13:22 – …',
      },
    ],
    child: { id: 'demo-child-1', name: 'Малыш', birthDate: null },
    familyMembers: [
      { id: 'u1', name: 'Мама', role: 'MOM' },
      { id: 'u2', name: 'Папа', role: 'DAD' },
    ],
  };

  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSleepingData),
      })
    );
  });

  it('renders full Today Sleeping screen with Header, Sleeping Hero, Wake Deadline, Bedtime, Subsequent nap, Button, and Logs', () => {
    render(<TodaySleepingPage initialData={mockSleepingData} />);

    // Screen wrapper
    expect(screen.getByTestId('today-sleeping-page')).toBeDefined();

    // Header
    expect(screen.getByTestId('app-header')).toBeDefined();
    expect(screen.getByTestId('header-title').textContent).toBe('Среда, 30.09');
    expect(screen.getByTestId('header-roles').textContent).toContain('Мама');

    // Sleeping Hero Card
    expect(screen.getByTestId('sleeping-hero-card')).toBeDefined();
    expect(screen.getByTestId('sleeping-status-pill').textContent).toContain('Спит · сон 2');
    expect(screen.getByTestId('sleep-start-time').textContent).toBe('уснул в 13:22');
    expect(screen.getByTestId('sleep-timer').textContent).toBe('0:25');

    // Wake deadline card
    const wakeDeadlineCard = screen.getByTestId('card-wake-deadline');
    expect(wakeDeadlineCard.textContent).toContain('Разбудить до');
    expect(screen.getByTestId('wake-deadline-time').textContent).toBe('14:52');
    expect(screen.getByTestId('wake-deadline-subtext').textContent).toBe('иначе сдвинется отбой');

    // Bedtime card
    const bedtimeCard = screen.getByTestId('card-bedtime');
    expect(bedtimeCard.textContent).toContain('Ночной сон');
    expect(screen.getByTestId('bedtime-time').textContent).toBe('20:25');
    expect(screen.getByTestId('bedtime-status').textContent).toBe('пересчитано');

    // Subsequent nap card
    const subsequentCard = screen.getByTestId('card-subsequent-nap');
    expect(subsequentCard.textContent).toContain('Потом: сон 3');
    expect(screen.getByTestId('subsequent-nap-details').textContent).toBe('17:20 – 17:55 · 35 мин');

    // Big Action Button "Проснулся"
    const wokeUpBtn = screen.getByTestId('woke-up-btn');
    expect(wokeUpBtn.textContent).toContain('Проснулся');

    // Day Logs List
    expect(screen.getByTestId('day-logs-list')).toBeDefined();
    const logItems = screen.getAllByTestId('day-log-item');
    expect(logItems).toHaveLength(3);

    // Bottom Navigation
    expect(screen.getByTestId('bottom-nav')).toBeDefined();
    expect(screen.getByTestId('tab-today').getAttribute('data-active')).toBe('true');
  });

  it('triggers onWokeUpClick when clicking "Проснулся" button', () => {
    const handleWokeUp = vi.fn();
    render(
      <TodaySleepingPage
        initialData={mockSleepingData}
        onWokeUpClick={handleWokeUp}
      />
    );

    const wokeUpBtn = screen.getByTestId('woke-up-btn');
    fireEvent.click(wokeUpBtn);
    expect(handleWokeUp).toHaveBeenCalledTimes(1);
  });

  it('invokes onSelectTab when bottom navigation tab is pressed', () => {
    const handleSelectTab = vi.fn();
    render(
      <TodaySleepingPage
        initialData={mockSleepingData}
        onSelectTab={handleSelectTab}
      />
    );

    const settingsTab = screen.getByTestId('tab-settings');
    fireEvent.click(settingsTab);
    expect(handleSelectTab).toHaveBeenCalledWith('settings');
  });

  it('invokes onAddRetroactiveClick when clicking "+ Добавить сон задним числом"', () => {
    const handleAddRetroactive = vi.fn();
    render(
      <TodaySleepingPage
        initialData={mockSleepingData}
        onAddRetroactiveClick={handleAddRetroactive}
      />
    );

    const addBtn = screen.getByTestId('add-retroactive-sleep-btn');
    fireEvent.click(addBtn);
    expect(handleAddRetroactive).toHaveBeenCalledTimes(1);
  });

  it('triggers onEditRecord when clicking a day log item in TodaySleepingPage', () => {
    const handleEditRecord = vi.fn();
    render(
      <TodaySleepingPage
        initialData={mockSleepingData}
        onEditRecord={handleEditRecord}
      />
    );

    const logItems = screen.getAllByTestId('day-log-item');
    expect(logItems).toHaveLength(3);

    fireEvent.click(logItems[1]);
    expect(handleEditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'e2',
        title: 'Сон 1 · 1:15',
      })
    );
  });

  it('renders "Пора будить" badge when wake deadline is exceeded or abnormally long nap warning exists', async () => {
    const exceededData: DayStatusResponse = {
      ...mockSleepingData,
      schedule: {
        ...mockSleepingData.schedule!,
        isWakeDeadlineExceeded: true,
      },
    };

    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(exceededData),
      })
    );

    await act(async () => {
      render(<TodaySleepingPage initialData={exceededData} />);
    });

    const badge = screen.getByTestId('sleeping-wake-now-badge');
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain('Пора будить');
    expect(badge.getAttribute('role')).toBe('status');
  });

  it('does not render "Пора будить" badge when wake deadline is not exceeded', async () => {
    await act(async () => {
      render(<TodaySleepingPage initialData={mockSleepingData} />);
    });

    expect(screen.queryByTestId('sleeping-wake-now-badge')).toBeNull();
  });

  it('renders WarningBanner when schedule has warnings and handles dismiss on TodaySleepingPage', async () => {
    const dataWithWarnings: DayStatusResponse = {
      ...mockSleepingData,
      schedule: {
        ...mockSleepingData.schedule!,
        warnings: [
          {
            code: 'ABNORMALLY_LONG_NAP',
            severity: 'alert',
            title: 'Слишком длинный сон',
            message: 'Дневной сон длится уже 2 ч 10 мин.',
            actionRecommendation: 'Пора будить ребёнка.',
            actionType: 'WAKE_NOW',
          },
        ],
      },
    };

    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(dataWithWarnings),
      })
    );

    await act(async () => {
      render(<TodaySleepingPage initialData={dataWithWarnings} />);
    });

    const banner = screen.getByTestId('warning-banner');
    expect(banner).toBeDefined();
    expect(banner.textContent).toContain('Слишком длинный сон');

    // Dismiss banner
    const dismissBtn = screen.getByTestId('warning-banner-close');
    fireEvent.click(dismissBtn);

    expect(screen.queryByTestId('warning-banner')).toBeNull();
  });

  it('triggers action when clicking action button on WarningBanner in TodaySleepingPage', async () => {
    const handleWokeUp = vi.fn();
    const dataWithWarnings: DayStatusResponse = {
      ...mockSleepingData,
      schedule: {
        ...mockSleepingData.schedule!,
        warnings: [
          {
            code: 'ABNORMALLY_LONG_NAP',
            severity: 'alert',
            title: 'Слишком длинный сон',
            message: 'Дневной сон длится уже 2 ч 10 мин.',
            actionRecommendation: 'Пора будить ребёнка.',
            actionType: 'WAKE_NOW',
          },
        ],
      },
    };

    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(dataWithWarnings),
      })
    );

    await act(async () => {
      render(
        <TodaySleepingPage
          initialData={dataWithWarnings}
          onWokeUpClick={handleWokeUp}
        />
      );
    });

    const actionBtn = screen.getByTestId('warning-banner-action');
    fireEvent.click(actionBtn);

    expect(handleWokeUp).toHaveBeenCalledTimes(1);
  });
});
