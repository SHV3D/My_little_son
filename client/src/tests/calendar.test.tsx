/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MonthGrid } from '../components/calendar/MonthGrid';
import { DayDetailCard, formatRussianDateHeader } from '../components/calendar/DayDetailCard';
import { CalendarPage } from '../pages/CalendarPage';
import App from '../App';
import { MonthSummaryResponse, DayStatusResponse } from '../api/sleepApi';

vi.mock('../hooks/useFamilySync', () => ({
  useFamilySync: () => ({
    isConnected: true,
    onlineRoles: ['Мама', 'Папа'],
    activeChildren: ['demo-child-1'],
    sendMessage: vi.fn(),
  }),
}));

vi.mock('../api/socket', () => ({
  initSocket: vi.fn(),
  getSocket: vi.fn(() => null),
  closeSocket: vi.fn(),
}));

const mockDay29Events = [
  {
    id: 'ev-wakeup-29',
    childId: 'demo-child-1',
    date: '2026-09-29',
    eventType: 'WAKEUP' as const,
    napNumber: null,
    startTime: '07:05',
    endTime: null,
    formattedStartTime: '07:05',
    formattedEndTime: null,
    durationMinutes: 0,
    formattedDuration: '',
    recordedByUserId: null,
    recordedByName: 'Мама',
    source: 'NOW',
    isOngoing: false,
    title: 'Подъём',
    subtitle: '',
  },
  {
    id: 'ev-nap1-29',
    childId: 'demo-child-1',
    date: '2026-09-29',
    eventType: 'NAP' as const,
    napNumber: 1,
    startTime: '09:35',
    endTime: '10:50',
    formattedStartTime: '09:35',
    formattedEndTime: '10:50',
    durationMinutes: 75,
    formattedDuration: '1:15',
    recordedByUserId: null,
    recordedByName: 'Мама',
    source: 'NOW',
    isOngoing: false,
    title: 'Сон 1',
    subtitle: '',
  },
  {
    id: 'ev-nap2-29',
    childId: 'demo-child-1',
    date: '2026-09-29',
    eventType: 'NAP' as const,
    napNumber: 2,
    startTime: '13:20',
    endTime: '14:45',
    formattedStartTime: '13:20',
    formattedEndTime: '14:45',
    durationMinutes: 85,
    formattedDuration: '1:25',
    recordedByUserId: null,
    recordedByName: 'Мама',
    source: 'NOW',
    isOngoing: false,
    title: 'Сон 2',
    subtitle: '',
  },
  {
    id: 'ev-nap3-29',
    childId: 'demo-child-1',
    date: '2026-09-29',
    eventType: 'NAP' as const,
    napNumber: 3,
    startTime: '17:25',
    endTime: '17:55',
    formattedStartTime: '17:25',
    formattedEndTime: '17:55',
    durationMinutes: 30,
    formattedDuration: '0:30',
    recordedByUserId: null,
    recordedByName: 'Мама',
    source: 'NOW',
    isOngoing: false,
    title: 'Сон 3',
    subtitle: '',
  },
  {
    id: 'ev-night-29',
    childId: 'demo-child-1',
    date: '2026-09-29',
    eventType: 'NIGHT_SLEEP' as const,
    napNumber: null,
    startTime: '20:35',
    endTime: null,
    formattedStartTime: '20:35',
    formattedEndTime: null,
    durationMinutes: null,
    formattedDuration: '',
    recordedByUserId: null,
    recordedByName: 'Мама',
    source: 'NOW',
    isOngoing: false,
    title: 'Ночной сон',
    subtitle: '',
  },
];

const mockMonthData: MonthSummaryResponse = {
  year: 2026,
  month: 9,
  childId: 'demo-child-1',
  targetDaySleepMinutes: 200,
  targetNapsCount: 3,
  targetBedtime: '20:30',
  averageDaySleepMinutes: 190,
  daysNormMetCount: 20,
  totalLoggedDays: 25,
  days: [
    {
      date: '2026-09-28',
      dayNumber: 28,
      dayOfWeek: 'Пн',
      totalDaySleepMinutes: 150,
      formattedTotalDaySleep: '2:30',
      napsCount: 2,
      targetNapsCount: 3,
      bedtime: '20:45',
      targetBedtime: '20:30',
      wakeupTime: '07:15',
      isNormMet: false,
      differenceFromNormMinutes: -50,
      formattedDifference: '−50 мин',
      events: [
        {
          id: 'ev-w28',
          childId: 'demo-child-1',
          date: '2026-09-28',
          eventType: 'WAKEUP',
          napNumber: null,
          startTime: '07:15',
          endTime: null,
          formattedStartTime: '07:15',
          formattedEndTime: null,
          durationMinutes: 0,
          formattedDuration: '',
          recordedByUserId: null,
          recordedByName: 'Мама',
          source: 'NOW',
          isOngoing: false,
          title: 'Подъём',
          subtitle: '',
        },
        {
          id: 'ev-nap1-28',
          childId: 'demo-child-1',
          date: '2026-09-28',
          eventType: 'NAP',
          napNumber: 1,
          startTime: '10:00',
          endTime: '11:15',
          formattedStartTime: '10:00',
          formattedEndTime: '11:15',
          durationMinutes: 75,
          formattedDuration: '1:15',
          recordedByUserId: null,
          recordedByName: 'Мама',
          source: 'NOW',
          isOngoing: false,
          title: 'Сон 1',
          subtitle: '',
        },
      ],
    },
    {
      date: '2026-09-29',
      dayNumber: 29,
      dayOfWeek: 'Вт',
      totalDaySleepMinutes: 190,
      formattedTotalDaySleep: '3:10',
      napsCount: 3,
      targetNapsCount: 3,
      bedtime: '20:35',
      targetBedtime: '20:30',
      wakeupTime: '07:05',
      isNormMet: true,
      differenceFromNormMinutes: -10,
      formattedDifference: '−10 мин',
      events: mockDay29Events,
    },
    {
      date: '2026-09-30',
      dayNumber: 30,
      dayOfWeek: 'Ср',
      totalDaySleepMinutes: 215,
      formattedTotalDaySleep: '3:35',
      napsCount: 3,
      targetNapsCount: 3,
      bedtime: '20:30',
      targetBedtime: '20:30',
      wakeupTime: '07:00',
      isNormMet: true,
      differenceFromNormMinutes: 15,
      formattedDifference: '+15 мин',
      events: [],
    },
  ],
};

const mockAwakeStatus = {
  date: '2026-09-29',
  currentTime: '13:05',
  state: 'AWAKE',
  schedule: {
    state: 'AWAKE',
    lastWakeTime: '10:55',
    awakeDurationMinutes: 130,
    formattedAwakeDuration: '2:10',
    batteryLevel: 5,
    wakeIntervalMinMinutes: 150,
    wakeIntervalMaxMinutes: 180,
    formattedWakeInterval: '2:30–3:00',
    currentNapNumber: 2,
    completedNapsCount: 1,
    targetNapsCount: 3,
    remainingNapsCount: 2,
    formattedRemainingNaps: 'Осталось 2 сна',
    nextNap: {
      napNumber: 2,
      targetStartTime: '13:25',
      targetEndTime: '14:50',
      targetDurationMinutes: 85,
      formattedDuration: '1 ч 25 мин',
      countdownMinutes: 20,
      formattedCountdown: 'через 20 мин',
      isOverdue: false,
    },
    subsequentNaps: [],
    projectedBedtime: '20:30',
    targetBedtime: '20:30',
    bedtimeStatusMessage: 'по графику',
    completedDaySleepMinutes: 75,
    targetDaySleepMinutes: 200,
    formattedDaySleepProgress: '1 ч 15 мин из 3 ч 20 мин',
  },
  events: [],
  child: {
    id: 'demo-child-1',
    name: 'Лев',
    birthDate: '2026-01-15',
  },
  familyMembers: [],
} as any as DayStatusResponse;

describe('MonthGrid Component', () => {
  it('renders correct month and year title, weekday headers, and 7-column grid', () => {
    render(
      <MonthGrid
        year={2026}
        month={9}
        selectedDate="2026-09-29"
        todayDate="2026-09-30"
        daysData={mockMonthData.days}
      />
    );

    // Title
    expect(screen.getByTestId('month-title').textContent).toBe('Сентябрь 2026');

    // Weekday headers
    const weekdayHeaders = screen.getByTestId('weekday-headers');
    expect(weekdayHeaders.textContent).toContain('Пн');
    expect(weekdayHeaders.textContent).toContain('Вт');
    expect(weekdayHeaders.textContent).toContain('Ср');
    expect(weekdayHeaders.textContent).toContain('Чт');
    expect(weekdayHeaders.textContent).toContain('Пт');
    expect(weekdayHeaders.textContent).toContain('Сб');
    expect(weekdayHeaders.textContent).toContain('Вс');

    // September 2026 starts on Tuesday, so exactly 1 empty cell before the 1st
    const emptyCells = screen.getAllByTestId('empty-day-cell');
    expect(emptyCells).toHaveLength(1);

    // 30 days in September
    const dayCells = screen.getAllByTestId('day-cell');
    expect(dayCells).toHaveLength(30);

    // Legend
    expect(screen.getByTestId('month-grid-legend')).toBeDefined();
    expect(screen.getByTestId('legend-norm-met')).toBeDefined();
    expect(screen.getByTestId('legend-norm-below')).toBeDefined();
  });

  it('renders norm bar with norm-met status for day 29 and below-norm for day 28', () => {
    render(
      <MonthGrid
        year={2026}
        month={9}
        selectedDate="2026-09-29"
        todayDate="2026-09-30"
        daysData={mockMonthData.days}
      />
    );

    // Day 28: below norm
    const day28 = screen.getByRole('button', { name: /День 28/i });
    expect(day28).toBeDefined();
    const bar28 = day28.querySelector('[data-testid="norm-bar"]');
    expect(bar28?.getAttribute('data-norm-met')).toBe('false');

    // Day 29: norm met and selected
    const day29 = screen.getByRole('button', { name: /Выбран день 29/i });
    expect(day29).toBeDefined();
    expect(day29.getAttribute('aria-pressed')).toBe('true');
    const bar29 = day29.querySelector('[data-testid="norm-bar"]');
    expect(bar29?.getAttribute('data-norm-met')).toBe('true');

    // Day 30: today
    const day30 = screen.getByRole('button', { name: /Сегодня, день 30/i });
    expect(day30).toBeDefined();
    expect(day30.textContent).toContain('сегодня');

  });

  it('triggers onSelectDate when a day cell is clicked', () => {
    const handleSelect = vi.fn();
    render(
      <MonthGrid
        year={2026}
        month={9}
        selectedDate="2026-09-29"
        todayDate="2026-09-30"
        daysData={mockMonthData.days}
        onSelectDate={handleSelect}
      />
    );

    const day28 = screen.getByRole('button', { name: /День 28/i });
    fireEvent.click(day28);

    expect(handleSelect).toHaveBeenCalledWith('2026-09-28');
  });
});

describe('DayDetailCard Component', () => {
  it('formats Russian date header correctly', () => {
    expect(formatRussianDateHeader('2026-09-29')).toBe('Вторник, 29 сентября');
    expect(formatRussianDateHeader('2026-09-28')).toBe('Понедельник, 28 сентября');
  });

  it('renders 3 summary cards with day sleep, naps count, and bedtime', () => {
    const handleEdit = vi.fn();
    render(
      <DayDetailCard
        day={mockMonthData.days[1]} // Day 29
        date="2026-09-29"
        onEditClick={handleEdit}
      />
    );

    // Title & Edit button
    expect(screen.getByTestId('day-detail-title').textContent).toBe('Вторник, 29 сентября');
    const editBtn = screen.getByTestId('edit-day-btn');
    fireEvent.click(editBtn);
    expect(handleEdit).toHaveBeenCalledTimes(1);

    // Card 1: Днём
    expect(screen.getByTestId('day-sleep-duration').textContent).toBe('3:10');
    expect(screen.getByTestId('day-sleep-diff').textContent).toBe('−10 мин');

    // Card 2: Снов
    expect(screen.getByTestId('naps-count').textContent).toBe('3 / 3');
    expect(screen.getByTestId('naps-status').textContent).toBe('по плану');

    // Card 3: Отбой
    expect(screen.getByTestId('bedtime-value').textContent).toBe('20:35');
    expect(screen.getByTestId('bedtime-target').textContent).toBe('цель 20:30');
  });

  it('renders daily timeline with sleep intervals and night sleep matching mockup', () => {
    render(
      <DayDetailCard
        day={mockMonthData.days[1]} // Day 29
        date="2026-09-29"
      />
    );

    // Timeline bar
    expect(screen.getByTestId('day-timeline-bar')).toBeDefined();
    const blocks = screen.getAllByTestId('sleep-interval-block');
    // 3 naps + 1 night sleep = 4 intervals
    expect(blocks).toHaveLength(4);

    // Nap 1: 09:35 - 10:50 => 18.45%, 8.93%
    expect(blocks[0].getAttribute('data-type')).toBe('sleep');
    expect(blocks[0].getAttribute('data-left')).toBe('18.45%');
    expect(blocks[0].getAttribute('data-width')).toBe('8.93%');

    // Nap 2: 13:20 - 14:45 => 45.24%, 10.12%
    expect(blocks[1].getAttribute('data-type')).toBe('sleep');
    expect(blocks[1].getAttribute('data-left')).toBe('45.24%');
    expect(blocks[1].getAttribute('data-width')).toBe('10.12%');

    // Nap 3: 17:25 - 17:55 => 74.40%, 3.57%
    expect(blocks[2].getAttribute('data-type')).toBe('sleep');
    expect(blocks[2].getAttribute('data-left')).toBe('74.40%');
    expect(blocks[2].getAttribute('data-width')).toBe('3.57%');

    // Night sleep: 20:35 => 97.02%, 2.98%
    expect(blocks[3].getAttribute('data-type')).toBe('night');
    expect(blocks[3].getAttribute('data-left')).toBe('97.02%');
    expect(blocks[3].getAttribute('data-width')).toBe('2.98%');

    // Time ticks
    const ticks = screen.getByTestId('timeline-ticks');
    expect(ticks.textContent).toContain('07:00');
    expect(ticks.textContent).toContain('10:30');
    expect(ticks.textContent).toContain('14:00');
    expect(ticks.textContent).toContain('17:30');
    expect(ticks.textContent).toContain('21:00');

    // Event list rows
    const eventRows = screen.getAllByTestId('day-event-row');
    expect(eventRows).toHaveLength(5);

    expect(eventRows[0].textContent).toContain('Подъём');
    expect(eventRows[0].textContent).toContain('07:05');

    expect(eventRows[1].textContent).toContain('Сон 1');
    expect(eventRows[1].textContent).toContain('09:35 – 10:50 · 1:15');

    expect(eventRows[2].textContent).toContain('Сон 2');
    expect(eventRows[2].textContent).toContain('13:20 – 14:45 · 1:25');

    expect(eventRows[3].textContent).toContain('Сон 3');
    expect(eventRows[3].textContent).toContain('17:25 – 17:55 · 0:30');

    expect(eventRows[4].textContent).toContain('Ночной сон');
    expect(eventRows[4].textContent).toContain('20:35');
  });

  it('triggers onEventClick when clicking an event row in DayDetailCard', () => {
    const handleEventClick = vi.fn();
    render(
      <DayDetailCard
        day={mockMonthData.days[1]}
        date="2026-09-29"
        onEventClick={handleEventClick}
      />
    );

    const eventRows = screen.getAllByTestId('day-event-row');
    expect(eventRows.length).toBeGreaterThan(0);

    fireEvent.click(eventRows[1]);
    expect(handleEventClick).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ev-nap1-29',
      })
    );
  });

  it('triggers onEventClick when clicking "Изменить" button with events present and no onEditClick', () => {
    const handleEventClick = vi.fn();
    render(
      <DayDetailCard
        day={mockMonthData.days[1]}
        date="2026-09-29"
        onEventClick={handleEventClick}
      />
    );

    const editBtn = screen.getByTestId('edit-day-btn');
    fireEvent.click(editBtn);
    expect(handleEventClick).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ev-wakeup-29',
      })
    );
  });
});

describe('CalendarPage Component', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/calendar/month')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMonthData),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  it('renders header, MonthGrid, DayDetailCard, and BottomNav', () => {
    render(
      <CalendarPage
        initialYear={2026}
        initialMonth={9}
        initialSelectedDate="2026-09-29"
        initialData={mockMonthData}
      />
    );

    // Title
    expect(screen.getByTestId('calendar-title').textContent).toBe('Календарь');

    // Month grid
    expect(screen.getByTestId('month-grid')).toBeDefined();
    expect(screen.getByTestId('month-title').textContent).toBe('Сентябрь 2026');

    // Selected Day Detail
    expect(screen.getByTestId('day-detail-title').textContent).toBe('Вторник, 29 сентября');
    expect(screen.getByTestId('day-sleep-duration').textContent).toBe('3:10');

    // Bottom navigation
    expect(screen.getByTestId('bottom-nav')).toBeDefined();
  });

  it('selecting another day updates selected state and DayDetailCard', () => {
    render(
      <CalendarPage
        initialYear={2026}
        initialMonth={9}
        initialSelectedDate="2026-09-29"
        initialData={mockMonthData}
      />
    );

    // Initial selected day is 29
    expect(screen.getByTestId('day-detail-title').textContent).toBe('Вторник, 29 сентября');

    // Click Day 28
    const day28 = screen.getByRole('button', { name: /День 28/i });
    fireEvent.click(day28);

    // DayDetailCard now reflects Day 28
    expect(screen.getByTestId('day-detail-title').textContent).toBe('Понедельник, 28 сентября');
    expect(screen.getByTestId('day-sleep-duration').textContent).toBe('2:30');
    expect(screen.getByTestId('naps-count').textContent).toBe('2 / 3');
  });

  it('navigates next and previous month correctly', async () => {
    render(
      <CalendarPage
        initialYear={2026}
        initialMonth={9}
        initialSelectedDate="2026-09-29"
        initialData={mockMonthData}
      />
    );

    // Click next month
    const nextBtn = screen.getByTestId('next-month-btn');
    await act(async () => {
      fireEvent.click(nextBtn);
    });

    expect(screen.getByTestId('month-title').textContent).toBe('Октябрь 2026');

    // Click prev month twice (October -> September -> August)
    const prevBtn = screen.getByTestId('prev-month-btn');
    await act(async () => {
      fireEvent.click(prevBtn);
    });
    expect(screen.getByTestId('month-title').textContent).toBe('Сентябрь 2026');

    await act(async () => {
      fireEvent.click(prevBtn);
    });
    expect(screen.getByTestId('month-title').textContent).toBe('Август 2026');
  });

  it('passes onEditRecord to DayDetailCard and triggers it on row click', () => {
    const handleEditRecord = vi.fn();
    render(
      <CalendarPage
        initialYear={2026}
        initialMonth={9}
        initialSelectedDate="2026-09-29"
        initialData={mockMonthData}
        onEditRecord={handleEditRecord}
      />
    );

    const eventRows = screen.getAllByTestId('day-event-row');
    expect(eventRows.length).toBeGreaterThan(0);

    fireEvent.click(eventRows[1]);
    expect(handleEditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ev-nap1-29',
      })
    );
  });
});

describe('App Tab Navigation to Calendar and Edit Modal Integration', () => {
  beforeEach(() => {
    localStorage.setItem('auth_token', 'mock-token');
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/sleep/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAwakeStatus),
        });
      }
      if (typeof url === 'string' && url.includes('/api/calendar/month')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMonthData),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  it('switches between Today and Calendar tab when clicking BottomNav', async () => {
    render(<App />);

    // Initially in Today tab
    const fellAsleepBtn = await screen.findByTestId('fell-asleep-btn');
    expect(fellAsleepBtn).toBeDefined();

    // Click "Календарь" in BottomNav
    const calendarTab = screen.getByTestId('tab-calendar');
    await act(async () => {
      fireEvent.click(calendarTab);
    });

    // CalendarPage is displayed
    expect(screen.getByTestId('calendar-page')).toBeDefined();
    expect(screen.getByTestId('calendar-title').textContent).toBe('Календарь');

    // Click "Сегодня" tab to go back
    const todayTab = screen.getByTestId('tab-today');
    await act(async () => {
      fireEvent.click(todayTab);
    });

    // Today tab is displayed again
    expect(screen.getByTestId('fell-asleep-btn')).toBeDefined();
  });

  it('opens EditSleepModal when clicking an event row in CalendarPage through App', async () => {
    render(<App />);

    // Switch to Calendar tab
    const calendarTab = screen.getByTestId('tab-calendar');
    await act(async () => {
      fireEvent.click(calendarTab);
    });

    const eventRows = await screen.findAllByTestId('day-event-row');
    expect(eventRows.length).toBeGreaterThan(0);

    // Click Nap 1 event row
    await act(async () => {
      fireEvent.click(eventRows[1]);
    });

    // Edit modal should open
    expect(screen.getByTestId('edit-sleep-modal')).toBeDefined();
    expect(screen.getByTestId('edit-sleep-title').textContent).toContain('Редактировать запись');
    expect(screen.getByDisplayValue('09:35')).toBeDefined();
  });
});
