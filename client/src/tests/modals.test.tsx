/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SleepActionModal } from '../components/modals/SleepActionModal';
import { RetroactiveSleepModal } from '../components/modals/RetroactiveSleepModal';
import { EditSleepModal } from '../components/modals/EditSleepModal';
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

  it('reopening SleepActionModal with a new currentTime refreshes nowTime and selectedTime correctly', () => {
    const { rerender } = render(
      <SleepActionModal
        isOpen={true}
        type="FELL_ASLEEP"
        currentTime="13:05"
        defaultOffsetMinutes={15}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    // Initially displays 13:05 and 12:50
    expect(screen.getByTestId('action-now-time').textContent).toBe('13:05');
    const input = screen.getByTestId('manual-time-input') as HTMLInputElement;
    expect(input.value).toBe('12:50');
    expect(screen.getByTestId('action-save-btn').textContent).toBe('Сохранить: уснул в 12:50');

    // Close the modal
    rerender(
      <SleepActionModal
        isOpen={false}
        type="FELL_ASLEEP"
        currentTime="13:05"
        defaultOffsetMinutes={15}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.queryByTestId('sleep-action-modal')).toBeNull();

    // Reopen modal with new currentTime: 14:20
    rerender(
      <SleepActionModal
        isOpen={true}
        type="FELL_ASLEEP"
        currentTime="14:20"
        defaultOffsetMinutes={15}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    // Refreshed state should show 14:20 and 14:05 (14:20 - 15 min)
    expect(screen.getByTestId('action-now-time').textContent).toBe('14:20');
    const updatedInput = screen.getByTestId('manual-time-input') as HTMLInputElement;
    expect(updatedInput.value).toBe('14:05');
    expect(screen.getByTestId('action-save-btn').textContent).toBe('Сохранить: уснул в 14:05');
    expect(screen.getByTestId('offset-chip-15').getAttribute('data-active')).toBe('true');
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

  it('triggers onClose on swipe down when container scroll is at top', () => {
    const handleClose = vi.fn();
    render(
      <RetroactiveSleepModal
        isOpen={true}
        onClose={handleClose}
        onSave={vi.fn()}
      />
    );

    const modal = screen.getByTestId('retroactive-modal');
    Object.defineProperty(modal, 'scrollTop', { value: 0, writable: true });

    fireEvent.touchStart(modal, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(modal, { touches: [{ clientY: 180 }] });
    fireEvent.touchEnd(modal);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('does not trigger onClose on swipe down when container is scrolled down unless touched on drag handle', () => {
    const handleClose = vi.fn();
    render(
      <RetroactiveSleepModal
        isOpen={true}
        onClose={handleClose}
        onSave={vi.fn()}
      />
    );

    const modal = screen.getByTestId('retroactive-modal');
    Object.defineProperty(modal, 'scrollTop', { value: 80, writable: true });

    // Touch inside modal body (not drag handle) while scrolled down
    const dateInput = screen.getByTestId('retroactive-date');
    fireEvent.touchStart(dateInput, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(dateInput, { touches: [{ clientY: 190 }] });
    fireEvent.touchEnd(modal);

    expect(handleClose).not.toHaveBeenCalled();

    // Now touch on drag handle even while scrolled down
    const dragHandle = screen.getByTestId('modal-drag-handle');
    fireEvent.touchStart(dragHandle, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(dragHandle, { touches: [{ clientY: 190 }] });
    fireEvent.touchEnd(modal);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('displays collision warning and disables save button when time interval overlaps with existingEvents', () => {
    const existingEvents = [
      {
        id: 'ev-1',
        eventType: 'NAP' as const,
        startTime: '10:00',
        endTime: '11:30',
        date: '2026-09-30',
      },
    ];

    const handleSave = vi.fn();
    render(
      <RetroactiveSleepModal
        isOpen={true}
        currentDate="2026-09-30"
        defaultStartTime="10:30"
        defaultEndTime="12:00"
        existingEvents={existingEvents}
        onClose={vi.fn()}
        onSave={handleSave}
      />
    );

    const warning = screen.getByTestId('retroactive-collision-warning');
    expect(warning).toBeDefined();
    expect(warning.textContent).toContain('пересекается');
    expect(warning.getAttribute('role')).toBe('alert');
    expect(warning.getAttribute('aria-live')).toBe('polite');

    const saveBtn = screen.getByTestId('retroactive-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);

    fireEvent.click(saveBtn);
    expect(handleSave).not.toHaveBeenCalled();
  });

  it('does not display collision warning and allows save when interval is non-overlapping', () => {
    const existingEvents = [
      {
        id: 'ev-1',
        eventType: 'NAP' as const,
        startTime: '10:00',
        endTime: '11:30',
        date: '2026-09-30',
      },
    ];

    const handleSave = vi.fn();
    render(
      <RetroactiveSleepModal
        isOpen={true}
        currentDate="2026-09-30"
        defaultStartTime="12:00"
        defaultEndTime="13:30"
        existingEvents={existingEvents}
        onClose={vi.fn()}
        onSave={handleSave}
      />
    );

    expect(screen.queryByTestId('retroactive-collision-warning')).toBeNull();

    const saveBtn = screen.getByTestId('retroactive-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);

    fireEvent.click(saveBtn);
    expect(handleSave).toHaveBeenCalledTimes(1);
  });
});

describe('EditSleepModal Component', () => {
  const mockEvent = {
    id: 'ev-test-1',
    title: 'Сон 1 · 1:15',
    author: 'Мама',
    time: '09:40 – 10:55',
    eventType: 'NAP' as const,
    startTime: '09:40',
    endTime: '10:55',
    date: '2026-09-30',
  };

  it('renders modal with event values when open', () => {
    render(
      <EditSleepModal
        isOpen={true}
        event={mockEvent}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByTestId('edit-sleep-modal')).toBeDefined();
    expect(screen.getByTestId('edit-sleep-title').textContent).toBe('Редактировать запись');
    expect(screen.getByDisplayValue('09:40')).toBeDefined();
    expect(screen.getByDisplayValue('10:55')).toBeDefined();
    expect(screen.getByTestId('edit-sleep-duration-preview').textContent).toContain('1 ч 15 мин');
  });

  it('submits updated values on Save click', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(
      <EditSleepModal
        isOpen={true}
        event={mockEvent}
        onClose={vi.fn()}
        onSave={handleSave}
        onDelete={vi.fn()}
      />
    );

    const saveBtn = screen.getByTestId('edit-sleep-save-btn');
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    expect(handleSave).toHaveBeenCalledWith('ev-test-1', expect.objectContaining({
      eventType: 'NAP',
      startTime: '09:40',
      endTime: '10:55',
      date: '2026-09-30',
      napNumber: 1,
    }));
  });

  it('allows changing fields before saving', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(
      <EditSleepModal
        isOpen={true}
        event={mockEvent}
        onClose={vi.fn()}
        onSave={handleSave}
        onDelete={vi.fn()}
      />
    );

    const startInput = screen.getByTestId('edit-sleep-start-time');
    const endInput = screen.getByTestId('edit-sleep-end-time');
    act(() => {
      fireEvent.change(startInput, { target: { value: '10:00' } });
      fireEvent.change(endInput, { target: { value: '11:30' } });
    });

    expect(screen.getByTestId('edit-sleep-duration-preview').textContent).toContain('1 ч 30 мин');

    const saveBtn = screen.getByTestId('edit-sleep-save-btn');
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    expect(handleSave).toHaveBeenCalledWith('ev-test-1', expect.objectContaining({
      eventType: 'NAP',
      startTime: '10:00',
      endTime: '11:30',
    }));
  });

  it('requires two-step confirmation to delete', async () => {
    const handleDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <EditSleepModal
        isOpen={true}
        event={mockEvent}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={handleDelete}
      />
    );

    const deleteBtn = screen.getByTestId('edit-sleep-delete-btn');
    expect(deleteBtn.textContent).toBe('Удалить запись');
    act(() => {
      fireEvent.click(deleteBtn);
    });

    // Second click should be confirmation
    expect(screen.getByTestId('edit-sleep-delete-btn').textContent).toBe('Точно удалить?');
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-sleep-delete-btn'));
    });
    expect(handleDelete).toHaveBeenCalledWith('ev-test-1');
  });

  it('switches event type and hides end time for WAKEUP', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(
      <EditSleepModal
        isOpen={true}
        event={mockEvent}
        onClose={vi.fn()}
        onSave={handleSave}
        onDelete={vi.fn()}
      />
    );

    // Switch to WAKEUP
    act(() => {
      fireEvent.click(screen.getByTestId('edit-sleep-type-wakeup'));
    });
    expect(screen.queryByTestId('edit-sleep-end-time')).toBeNull();
    expect(screen.getByTestId('edit-sleep-duration-preview').textContent).toContain('Момент пробуждения');

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-sleep-save-btn'));
    });
    expect(handleSave).toHaveBeenCalledWith('ev-test-1', expect.objectContaining({
      eventType: 'WAKEUP',
      startTime: '09:40',
      endTime: null,
      napNumber: null,
    }));
  });

  it('toggles ongoing sleep, disabling end time and updating preview', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(
      <EditSleepModal
        isOpen={true}
        event={mockEvent}
        onClose={vi.fn()}
        onSave={handleSave}
        onDelete={vi.fn()}
      />
    );

    const toggle = screen.getByTestId('edit-sleep-ongoing-toggle');
    act(() => {
      fireEvent.click(toggle);
    });

    expect((screen.getByTestId('edit-sleep-end-time') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByTestId('edit-sleep-duration-preview').textContent).toContain('Сон идёт');

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-sleep-save-btn'));
    });
    expect(handleSave).toHaveBeenCalledWith('ev-test-1', expect.objectContaining({
      eventType: 'NAP',
      startTime: '09:40',
      endTime: null,
    }));
  });

  it('allows picking nap number for NAP events', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(
      <EditSleepModal
        isOpen={true}
        event={mockEvent}
        onClose={vi.fn()}
        onSave={handleSave}
        onDelete={vi.fn()}
      />
    );

    const nap3 = screen.getByTestId('edit-sleep-nap-number-3');
    act(() => {
      fireEvent.click(nap3);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-sleep-save-btn'));
    });
    expect(handleSave).toHaveBeenCalledWith('ev-test-1', expect.objectContaining({
      eventType: 'NAP',
      napNumber: 3,
    }));
  });

  it('parses time from time string when startTime/endTime are not explicit in event', () => {
    const stringTimeEvent = {
      id: 'ev-test-2',
      title: 'Сон 2 · 1:30',
      author: 'Папа',
      time: '14:15 – 15:45',
    };

    render(
      <EditSleepModal
        isOpen={true}
        event={stringTimeEvent}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue('14:15')).toBeDefined();
    expect(screen.getByDisplayValue('15:45')).toBeDefined();
    expect(screen.getByTestId('edit-sleep-duration-preview').textContent).toContain('1 ч 30 мин');
  });

  it('triggers onClose when close button or backdrop is clicked', () => {
    const handleClose = vi.fn();
    render(
      <EditSleepModal
        isOpen={true}
        event={mockEvent}
        onClose={handleClose}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    act(() => {
      fireEvent.click(screen.getByTestId('edit-sleep-close-btn'));
    });
    expect(handleClose).toHaveBeenCalledTimes(1);

    act(() => {
      fireEvent.click(screen.getByTestId('edit-sleep-modal-backdrop'));
    });
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <EditSleepModal
        isOpen={false}
        event={mockEvent}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('displays collision warning and disables save when editing event to overlap with another event', () => {
    const existingEvents = [
      {
        id: 'ev-test-1',
        eventType: 'NAP' as const,
        startTime: '09:40',
        endTime: '10:55',
        date: '2026-09-30',
      },
      {
        id: 'ev-test-2',
        eventType: 'NAP' as const,
        startTime: '14:00',
        endTime: '15:30',
        date: '2026-09-30',
      },
    ];

    const handleSave = vi.fn();
    render(
      <EditSleepModal
        isOpen={true}
        event={mockEvent}
        existingEvents={existingEvents}
        onClose={vi.fn()}
        onSave={handleSave}
        onDelete={vi.fn()}
      />
    );

    // Editing mockEvent (ev-test-1) without moving it should not collide with itself!
    expect(screen.queryByTestId('edit-collision-warning')).toBeNull();
    const saveBtn = screen.getByTestId('edit-sleep-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);

    // Now change time to collide with ev-test-2 (14:00 - 15:30)
    const startInput = screen.getByTestId('edit-sleep-start-time');
    const endInput = screen.getByTestId('edit-sleep-end-time');
    act(() => {
      fireEvent.change(startInput, { target: { value: '14:30' } });
      fireEvent.change(endInput, { target: { value: '16:00' } });
    });

    const warning = screen.getByTestId('edit-collision-warning');
    expect(warning).toBeDefined();
    expect(warning.textContent).toContain('пересекается');
    expect(warning.getAttribute('role')).toBe('alert');
    expect(warning.getAttribute('aria-live')).toBe('polite');
    expect((screen.getByTestId('edit-sleep-save-btn') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByTestId('edit-sleep-save-btn'));
    expect(handleSave).not.toHaveBeenCalled();
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

  it('App preserves payload.time when confirming with source: "NOW"', async () => {
    let capturedBody: any = null;
    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (typeof url === 'string' && url.includes('/api/sleep/fell-asleep')) {
        if (init?.body) {
          capturedBody = JSON.parse(init.body as string);
        }
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

    const fellAsleepBtn = await screen.findByTestId('fell-asleep-btn');
    fireEvent.click(fellAsleepBtn);

    const nowBtn = screen.getByTestId('action-now-btn');
    await act(async () => {
      fireEvent.click(nowBtn);
    });

    expect(capturedBody).toEqual({
      childId: 'demo-child-1',
      time: '13:05',
      source: 'NOW',
    });
  });

  it('TodayAwakePage preserves payload.time when confirming with source: "NOW"', async () => {
    let capturedBody: any = null;
    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (typeof url === 'string' && url.includes('/api/sleep/fell-asleep')) {
        if (init?.body) {
          capturedBody = JSON.parse(init.body as string);
        }
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

    render(<TodayAwakePage initialData={mockAwakeStatus} />);

    const fellAsleepBtn = screen.getByTestId('fell-asleep-btn');
    fireEvent.click(fellAsleepBtn);

    const nowBtn = screen.getByTestId('action-now-btn');
    await act(async () => {
      fireEvent.click(nowBtn);
    });

    expect(capturedBody).toEqual({
      childId: 'demo-child-1',
      time: '13:05',
      source: 'NOW',
    });
  });

  it('TodaySleepingPage preserves payload.time when confirming with source: "NOW"', async () => {
    let capturedBody: any = null;
    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (typeof url === 'string' && url.includes('/api/sleep/woke-up')) {
        if (init?.body) {
          capturedBody = JSON.parse(init.body as string);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSleepingStatus),
      });
    });

    render(<TodaySleepingPage initialData={mockSleepingStatus} />);

    const wokeUpBtn = screen.getByTestId('woke-up-btn');
    fireEvent.click(wokeUpBtn);

    const nowBtn = screen.getByTestId('action-now-btn');
    await act(async () => {
      fireEvent.click(nowBtn);
    });

    expect(capturedBody).toEqual({
      childId: 'demo-child-1',
      time: '13:30',
      source: 'NOW',
    });
  });

  it('App opens EditSleepModal from TodaySleepingPage and updates event via PUT API', async () => {
    let putUrl = '';
    let putBody: any = null;
    const statusWithEvents: DayStatusResponse = {
      ...mockSleepingStatus,
      events: [
        {
          id: 'ev-nap-1',
          childId: 'demo-child-1',
          date: '2026-09-30',
          eventType: 'NAP',
          napNumber: 1,
          startTime: '09:30',
          endTime: '10:45',
          formattedStartTime: '09:30',
          formattedEndTime: '10:45',
          durationMinutes: 75,
          formattedDuration: '1:15',
          recordedByUserId: 'u1',
          recordedByName: 'Мама',
          source: 'NOW',
          isOngoing: false,
          title: 'Сон 1 · 1:15',
          subtitle: '09:30 – 10:45',
        },
      ],
    };

    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (typeof url === 'string' && url.includes('/api/sleep/events/ev-nap-1') && init?.method === 'PUT') {
        putUrl = url;
        putBody = JSON.parse(init.body as string);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ event: { id: 'ev-nap-1' }, status: statusWithEvents }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(statusWithEvents),
      });
    });

    await act(async () => {
      render(<App />);
    });

    const dayLogItem = await screen.findByText('Сон 1 · 1:15');
    await act(async () => {
      fireEvent.click(dayLogItem);
    });

    // Edit modal should open
    expect(screen.getByTestId('edit-sleep-modal')).toBeDefined();
    expect(screen.getByDisplayValue('09:30')).toBeDefined();

    // Click Save
    const saveBtn = screen.getByTestId('edit-sleep-save-btn');
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(putUrl).toContain('/api/sleep/events/ev-nap-1');
    expect(putBody).toEqual(
      expect.objectContaining({
        eventType: 'NAP',
        startTime: '09:30',
        endTime: '10:45',
      })
    );
  });

  it('App opens EditSleepModal from TodaySleepingPage and deletes event via DELETE API', async () => {
    let deleteUrl = '';
    const statusWithEvents: DayStatusResponse = {
      ...mockSleepingStatus,
      events: [
        {
          id: 'ev-nap-1',
          childId: 'demo-child-1',
          date: '2026-09-30',
          eventType: 'NAP',
          napNumber: 1,
          startTime: '09:30',
          endTime: '10:45',
          formattedStartTime: '09:30',
          formattedEndTime: '10:45',
          durationMinutes: 75,
          formattedDuration: '1:15',
          recordedByUserId: 'u1',
          recordedByName: 'Мама',
          source: 'NOW',
          isOngoing: false,
          title: 'Сон 1 · 1:15',
          subtitle: '09:30 – 10:45',
        },
      ],
    };

    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (typeof url === 'string' && url.includes('/api/sleep/events/ev-nap-1') && init?.method === 'DELETE') {
        deleteUrl = url;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, id: 'ev-nap-1' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(statusWithEvents),
      });
    });

    await act(async () => {
      render(<App />);
    });

    const dayLogItem = await screen.findByText('Сон 1 · 1:15');
    await act(async () => {
      fireEvent.click(dayLogItem);
    });

    // Edit modal should open
    expect(screen.getByTestId('edit-sleep-modal')).toBeDefined();

    // Click Delete once -> confirmation
    const deleteBtn = screen.getByTestId('edit-sleep-delete-btn');
    await act(async () => {
      fireEvent.click(deleteBtn);
    });
    expect(screen.getByTestId('edit-sleep-delete-btn').textContent).toContain('Точно удалить?');

    // Click Delete again -> triggers delete API
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-sleep-delete-btn'));
    });

    expect(deleteUrl).toContain('/api/sleep/events/ev-nap-1');
  });
});

