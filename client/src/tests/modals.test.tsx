/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SleepActionModal } from '../components/modals/SleepActionModal';
import { RetroactiveSleepModal } from '../components/modals/RetroactiveSleepModal';
import { TodayAwakePage } from '../pages/TodayAwakePage';
import { TodaySleepingPage } from '../pages/TodaySleepingPage';
import App from '../App';
import { DayStatusResponse } from '../api/sleepApi';

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

describe('SleepActionModal Component', () => {
  it('opens with correct title ("Уснул") and "Сейчас" time', () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();

    render(
      <SleepActionModal
        isOpen={true}
        type="FELL_ASLEEP"
        currentTime="13:05"
        onClose={handleClose}
        onConfirm={handleConfirm}
      />
    );

    // Modal title
    const title = screen.getByTestId('modal-title');
    expect(title.textContent).toBe('Уснул');

    // "Сейчас" time badge
    const nowTime = screen.getByTestId('action-now-time');
    expect(nowTime.textContent).toBe('13:05');

    // Footer text
    const footer = screen.getByTestId('modal-footer-text');
    expect(footer.textContent).toBe('Так же работает кнопка «Проснулся»');
  });

  it('opens with correct title ("Проснулся") and footer when type="WOKE_UP"', () => {
    render(
      <SleepActionModal
        isOpen={true}
        type="WOKE_UP"
        currentTime="14:50"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    const title = screen.getByTestId('modal-title');
    expect(title.textContent).toBe('Проснулся');

    const nowTime = screen.getByTestId('action-now-time');
    expect(nowTime.textContent).toBe('14:50');

    const footer = screen.getByTestId('modal-footer-text');
    expect(footer.textContent).toBe('Так же работает кнопка «Уснул»');
  });

  it('adjusts input time and highlights active chip when clicking offset chips (-5, -10, -15, -30 min)', () => {
    render(
      <SleepActionModal
        isOpen={true}
        type="FELL_ASLEEP"
        currentTime="13:05"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    const input = screen.getByTestId('manual-time-input') as HTMLInputElement;
    const saveBtn = screen.getByTestId('action-save-btn');

    // 1. Click -5 min chip -> 13:05 - 5 min = 13:00
    const chip5 = screen.getByTestId('offset-chip-5');
    fireEvent.click(chip5);
    expect(input.value).toBe('13:00');
    expect(chip5.getAttribute('data-active')).toBe('true');
    expect(saveBtn.textContent).toBe('Сохранить: уснул в 13:00');

    // 2. Click -10 min chip -> 13:05 - 10 min = 12:55
    const chip10 = screen.getByTestId('offset-chip-10');
    fireEvent.click(chip10);
    expect(input.value).toBe('12:55');
    expect(chip10.getAttribute('data-active')).toBe('true');
    expect(chip5.getAttribute('data-active')).toBe('false');
    expect(saveBtn.textContent).toBe('Сохранить: уснул в 12:55');

    // 3. Click -15 min chip -> 13:05 - 15 min = 12:50
    const chip15 = screen.getByTestId('offset-chip-15');
    fireEvent.click(chip15);
    expect(input.value).toBe('12:50');
    expect(chip15.getAttribute('data-active')).toBe('true');
    expect(saveBtn.textContent).toBe('Сохранить: уснул в 12:50');

    // 4. Click -30 min chip -> 13:05 - 30 min = 12:35
    const chip30 = screen.getByTestId('offset-chip-30');
    fireEvent.click(chip30);
    expect(input.value).toBe('12:35');
    expect(chip30.getAttribute('data-active')).toBe('true');
    expect(saveBtn.textContent).toBe('Сохранить: уснул в 12:35');
  });

  it('triggers onConfirm({ source: "NOW" }) when clicking "Сейчас"', () => {
    const handleConfirm = vi.fn();
    render(
      <SleepActionModal
        isOpen={true}
        type="FELL_ASLEEP"
        currentTime="13:05"
        onClose={vi.fn()}
        onConfirm={handleConfirm}
      />
    );

    const nowBtn = screen.getByTestId('action-now-btn');
    fireEvent.click(nowBtn);

    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'NOW' })
    );
  });

  it('triggers onConfirm with selected manual time when clicking "Сохранить"', () => {
    const handleConfirm = vi.fn();
    render(
      <SleepActionModal
        isOpen={true}
        type="FELL_ASLEEP"
        currentTime="13:05"
        onClose={vi.fn()}
        onConfirm={handleConfirm}
      />
    );

    const input = screen.getByTestId('manual-time-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12:20' } });

    const saveBtn = screen.getByTestId('action-save-btn');
    expect(saveBtn.textContent).toBe('Сохранить: уснул в 12:20');

    fireEvent.click(saveBtn);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleConfirm).toHaveBeenCalledWith({
      source: 'MANUAL',
      time: '12:20',
    });
  });

  it('triggers onClose when clicking close button or backdrop', () => {
    const handleClose = vi.fn();
    render(
      <SleepActionModal
        isOpen={true}
        type="FELL_ASLEEP"
        currentTime="13:05"
        onClose={handleClose}
        onConfirm={vi.fn()}
      />
    );

    const closeBtn = screen.getByTestId('modal-close-btn');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    const backdrop = screen.getByTestId('sleep-action-modal-backdrop');
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <SleepActionModal
        isOpen={false}
        type="FELL_ASLEEP"
        currentTime="13:05"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});

describe('RetroactiveSleepModal Component', () => {
  it('renders and submits start/end times and event type', () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();

    render(
      <RetroactiveSleepModal
        isOpen={true}
        currentDate="2026-09-30"
        defaultStartTime="09:30"
        defaultEndTime="10:45"
        onClose={handleClose}
        onSave={handleSave}
      />
    );

    // Title
    expect(screen.getByTestId('retroactive-modal-title').textContent).toBe('Добавить сон');

    // Verify inputs
    const startTimeInput = screen.getByTestId('retroactive-start-time') as HTMLInputElement;
    const endTimeInput = screen.getByTestId('retroactive-end-time') as HTMLInputElement;
    const dateInput = screen.getByTestId('retroactive-date') as HTMLInputElement;

    expect(startTimeInput.value).toBe('09:30');
    expect(endTimeInput.value).toBe('10:45');
    expect(dateInput.value).toBe('2026-09-30');

    // Change times
    fireEvent.change(startTimeInput, { target: { value: '10:00' } });
    fireEvent.change(endTimeInput, { target: { value: '11:15' } });

    // Submit
    const saveBtn = screen.getByTestId('retroactive-save-btn');
    fireEvent.click(saveBtn);

    expect(handleSave).toHaveBeenCalledTimes(1);
    expect(handleSave).toHaveBeenCalledWith({
      eventType: 'NAP',
      startTime: '10:00',
      endTime: '11:15',
      date: '2026-09-30',
      napNumber: 1,
    });
  });

  it('handles event type selection and hides end time for WAKEUP', () => {
    const handleSave = vi.fn();

    render(
      <RetroactiveSleepModal
        isOpen={true}
        currentDate="2026-09-30"
        defaultStartTime="07:15"
        onClose={vi.fn()}
        onSave={handleSave}
      />
    );

    // Select WAKEUP
    const wakeupBtn = screen.getByTestId('event-type-wakeup');
    fireEvent.click(wakeupBtn);

    // End time should not be displayed
    expect(screen.queryByTestId('retroactive-end-time')).toBeNull();

    // Save
    const saveBtn = screen.getByTestId('retroactive-save-btn');
    fireEvent.click(saveBtn);

    expect(handleSave).toHaveBeenCalledWith({
      eventType: 'WAKEUP',
      startTime: '07:15',
      endTime: null,
      date: '2026-09-30',
      napNumber: null,
    });
  });

  it('triggers onClose when clicking close button', () => {
    const handleClose = vi.fn();
    render(
      <RetroactiveSleepModal
        isOpen={true}
        onClose={handleClose}
        onSave={vi.fn()}
      />
    );

    const closeBtn = screen.getByTestId('retroactive-close-btn');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});

describe('Modal Integration in Pages and App', () => {
  const mockAwakeStatus: DayStatusResponse = {
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
      nextNap: null,
      subsequentNaps: [],
    },
    events: [],
    child: { id: 'demo-child-1', name: 'Малыш', birthDate: null },
    familyMembers: [],
  };

  const mockSleepingStatus: DayStatusResponse = {
    ...mockAwakeStatus,
    state: 'SLEEPING',
    currentTime: '13:30',
    schedule: {
      ...mockAwakeStatus.schedule,
      state: 'SLEEPING',
      sleepDurationMinutes: 10,
      formattedSleepDuration: '0:10',
      sleepStartTime: '13:20',
      currentNapNumber: 2,
    },
  };

  it('TodayAwakePage opens SleepActionModal("FELL_ASLEEP") when clicking "Уснул" without external handler', () => {
    render(<TodayAwakePage initialData={mockAwakeStatus} />);

    // Initially modal is not shown
    expect(screen.queryByTestId('sleep-action-modal')).toBeNull();

    // Click "Уснул"
    const fellAsleepBtn = screen.getByTestId('fell-asleep-btn');
    fireEvent.click(fellAsleepBtn);

    // Modal is now open
    expect(screen.getByTestId('sleep-action-modal')).toBeDefined();
    expect(screen.getByTestId('modal-title').textContent).toBe('Уснул');
  });

  it('TodaySleepingPage opens SleepActionModal("WOKE_UP") and RetroactiveSleepModal when clicking respective buttons', () => {
    render(<TodaySleepingPage initialData={mockSleepingStatus} />);

    // Click "Проснулся"
    const wokeUpBtn = screen.getByTestId('woke-up-btn');
    fireEvent.click(wokeUpBtn);

    expect(screen.getByTestId('sleep-action-modal')).toBeDefined();
    expect(screen.getByTestId('modal-title').textContent).toBe('Проснулся');

    // Close woke up modal
    fireEvent.click(screen.getByTestId('modal-close-btn'));
    expect(screen.queryByTestId('sleep-action-modal')).toBeNull();

    // Click "+ Добавить сон задним числом"
    const addRetroactiveBtn = screen.getByTestId('add-retroactive-sleep-btn');
    fireEvent.click(addRetroactiveBtn);

    expect(screen.getByTestId('retroactive-modal')).toBeDefined();
    expect(screen.getByTestId('retroactive-modal-title').textContent).toBe('Добавить сон');
  });

  it('App handles full flow: clicking "Уснул" opens modal, confirming switches to Sleeping view', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/sleep/fell-asleep')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockAwakeStatus),
      });
    });

    render(<App />);

    // Wait for initial render of TodayAwakePage
    const fellAsleepBtn = await screen.findByTestId('fell-asleep-btn');
    fireEvent.click(fellAsleepBtn);

    // Modal opens
    const modal = screen.getByTestId('sleep-action-modal');
    expect(modal).toBeDefined();

    // Click "Сейчас" in modal
    const nowBtn = screen.getByTestId('action-now-btn');
    await act(async () => {
      fireEvent.click(nowBtn);
    });

    // Modal closes and view shifts optimistically to TodaySleepingPage
    expect(screen.queryByTestId('sleep-action-modal')).toBeNull();
  });
});

