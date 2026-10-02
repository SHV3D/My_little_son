/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SanityBanner } from '../components/settings/SanityBanner';
import { AgePresetsModal } from '../components/settings/AgePresetsModal';
import { SettingsPage } from '../pages/SettingsPage';
import * as settingsApi from '../api/settingsApi';
import { ValidationResult } from '@shared/sleepEngine';

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

const mockSettingsResponse: settingsApi.SettingsResponse = {
  child: {
    id: 'demo-child-1',
    name: 'Сын',
    birthDate: '2026-01-15',
    familyId: 'demo-family-1',
  },
  settings: {
    id: 'demo-settings-1',
    childId: 'demo-child-1',
    napsPerDay: 3,
    wakeIntervalMinMinutes: 150,
    wakeIntervalMaxMinutes: 180,
    totalWakeMinutes: 600,
    totalDaySleepMinutes: 200,
    targetBedtime: '20:30',
    typicalWakeupTime: '07:00',
  },
  validation: {
    isValid: true,
    status: 'valid',
    message: '3 сна × интервал 2:30–3:00 при отбое в 20:30 — план сходится.',
    dayLengthMinutes: 810,
    minRequiredMinutes: 800,
    maxRequiredMinutes: 920,
    requiredMinutes: 860,
    differenceMinutes: -50,
  },
  family: {
    id: 'demo-family-1',
    name: 'Семья Сына',
    inviteCode: '7K4-Q9M',
    members: [
      { id: 'user-mom-1', name: 'Мама', role: 'Мама', email: 'mama@mail.ru' },
      { id: 'user-dad-1', name: 'Папа', role: 'Папа', email: 'papa@mail.ru' },
    ],
  },
};

describe('SanityBanner Component', () => {
  it('renders valid banner with checkmark and message', () => {
    const validResult: ValidationResult = {
      isValid: true,
      status: 'valid',
      message: '3 сна × интервал 2:30–3:00 при отбое в 20:30 — план сходится.',
      dayLengthMinutes: 810,
      minRequiredMinutes: 800,
      maxRequiredMinutes: 920,
      requiredMinutes: 860,
      differenceMinutes: -50,
    };

    render(<SanityBanner validation={validResult} />);

    expect(screen.getByTestId('sanity-banner')).toBeDefined();
    expect(screen.getByTestId('sanity-icon-valid')).toBeDefined();
    expect(screen.getByTestId('sanity-message').textContent).toContain('3 сна × интервал 2:30–3:00 при отбое в 20:30 — план сходится.');
  });

  it('renders warning banner with warning icon when invalid', () => {
    const warningResult: ValidationResult = {
      isValid: false,
      status: 'warning',
      message: 'При таких интервалах отбой сдвинется позже 20:30.',
      dayLengthMinutes: 700,
      minRequiredMinutes: 800,
      maxRequiredMinutes: 920,
      requiredMinutes: 860,
      differenceMinutes: -160,
    };

    render(<SanityBanner validation={warningResult} />);

    expect(screen.getByTestId('sanity-banner')).toBeDefined();
    expect(screen.getByTestId('sanity-icon-warning')).toBeDefined();
    expect(screen.getByTestId('sanity-message').textContent).toContain('При таких интервалах отбой сдвинется позже 20:30.');
  });

  it('returns null when validation is null or undefined', () => {
    const { container } = render(<SanityBanner validation={null} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('AgePresetsModal Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <AgePresetsModal isOpen={false} onClose={vi.fn()} onSelectPreset={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders presets when isOpen is true and handles selection', () => {
    const handleSelect = vi.fn();
    const handleClose = vi.fn();

    render(
      <AgePresetsModal
        isOpen={true}
        onClose={handleClose}
        onSelectPreset={handleSelect}
        currentNaps={3}
      />
    );

    expect(screen.getByTestId('age-presets-modal')).toBeDefined();
    expect(screen.getByText('Возрастные нормы')).toBeDefined();

    // Check all age presets
    expect(screen.getByText('3–5 месяцев')).toBeDefined();
    expect(screen.getByText('6–8 месяцев')).toBeDefined();
    expect(screen.getByText('9–11 месяцев')).toBeDefined();
    expect(screen.getByText('12–18 месяцев')).toBeDefined();

    // Select 9-11 months preset
    fireEvent.click(screen.getByTestId('preset-card-9-11m'));
    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '9-11m',
        napsPerDay: 2,
        wakeIntervalMinMinutes: 180,
      })
    );
  });

  it('calls onClose when clicking close button', () => {
    const handleClose = vi.fn();
    render(
      <AgePresetsModal
        isOpen={true}
        onClose={handleClose}
        onSelectPreset={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('close-presets-modal'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsPage Component', () => {
  beforeEach(() => {
    vi.spyOn(settingsApi, 'fetchSettings').mockResolvedValue(mockSettingsResponse);
    vi.spyOn(settingsApi, 'updateSettingsApi').mockImplementation(async (payload) => ({
      ...mockSettingsResponse,
      settings: {
        ...mockSettingsResponse.settings,
        ...payload,
      },
    }));
  });

  it('renders all sections and initial data correctly', async () => {
    render(<SettingsPage childId="demo-child-1" />);

    await waitFor(() => {
      const input = screen.getByTestId('child-name-input') as HTMLInputElement;
      expect(input.value).toBe('Сын');
    });

    expect(screen.getByTestId('section-child')).toBeDefined();
    expect(screen.getByTestId('section-routine')).toBeDefined();
    expect(screen.getByTestId('section-family')).toBeDefined();

    expect(screen.getByTestId('naps-count-value').textContent).toBe('3');
    expect(screen.getByTestId('bedtime-value').textContent).toBe('20:30');
    expect(screen.getByTestId('total-day-sleep-value').textContent).toBe('3 ч 20 м');
    expect(screen.getByTestId('total-wake-value').textContent).toBe('10 ч 00 м');

    // Family members
    expect(screen.getByTestId('family-member-mom')).toBeDefined();
    expect(screen.getByTestId('family-member-dad')).toBeDefined();
  });

  it('increments and decrements naps count and triggers auto-save', async () => {
    const updateSpy = vi.spyOn(settingsApi, 'updateSettingsApi');
    render(<SettingsPage childId="demo-child-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('naps-count-value').textContent).toBe('3');
    });

    // Increment
    await act(async () => {
      fireEvent.click(screen.getByTestId('naps-increment'));
    });
    expect(screen.getByTestId('naps-count-value').textContent).toBe('4');
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ napsPerDay: 4 }),
      'demo-child-1'
    );

    // Decrement
    await act(async () => {
      fireEvent.click(screen.getByTestId('naps-decrement'));
    });
    expect(screen.getByTestId('naps-count-value').textContent).toBe('3');
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ napsPerDay: 3 }),
      'demo-child-1'
    );
  });

  it('opens and closes age presets modal and applies selected preset', async () => {
    const updateSpy = vi.spyOn(settingsApi, 'updateSettingsApi');
    render(<SettingsPage childId="demo-child-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('btn-age-presets')).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-age-presets'));
    });
    expect(screen.getByTestId('age-presets-modal')).toBeDefined();

    // Select 12-18m preset (1 nap)
    await act(async () => {
      fireEvent.click(screen.getByTestId('preset-card-12-18m'));
    });
    expect(screen.queryByTestId('age-presets-modal')).toBeNull();

    expect(screen.getByTestId('naps-count-value').textContent).toBe('1');
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        napsPerDay: 1,
        wakeIntervalMinMinutes: 270,
        wakeIntervalMaxMinutes: 330,
        totalDaySleepMinutes: 135,
        totalWakeMinutes: 690,
      }),
      'demo-child-1'
    );
  });

  it('handles child name changes on blur', async () => {
    const updateSpy = vi.spyOn(settingsApi, 'updateSettingsApi');
    render(<SettingsPage childId="demo-child-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('child-name-input')).toBeDefined();
    });

    const input = screen.getByTestId('child-name-input');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Лев' } });
      fireEvent.blur(input);
    });

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ childName: 'Лев' }),
      'demo-child-1'
    );
  });

  it('copies invite code and shows feedback on clicking invite button', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });

    render(<SettingsPage childId="demo-child-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('btn-invite-family')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('btn-invite-family'));

    expect(writeTextMock).toHaveBeenCalledWith('7K4-Q9M');
    await waitFor(() => {
      expect(screen.getByTestId('invite-copy-feedback').textContent).toBe('Код 7K4-Q9M скопирован!');
    });
  });

  it('renders biometrics security card and toggles biometric authentication', async () => {
    localStorage.clear();

    render(<SettingsPage childId="demo-child-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('biometrics-settings-card')).toBeDefined();
    });

    const toggleBtn = screen.getByTestId('biometrics-toggle-btn');
    expect(toggleBtn).toBeDefined();
    expect(toggleBtn.getAttribute('role')).toBe('switch');
    expect(toggleBtn.getAttribute('aria-checked')).toBe('false');
    expect(toggleBtn.textContent).toBe('Включить');

    // Toggle on
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    expect(toggleBtn.textContent).toBe('Включено');
    expect(toggleBtn.getAttribute('aria-checked')).toBe('true');
    expect(localStorage.getItem('mls_biometrics_enabled')).toBe('true');

    // Toggle off
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    expect(toggleBtn.textContent).toBe('Включить');
    expect(toggleBtn.getAttribute('aria-checked')).toBe('false');
    expect(localStorage.getItem('mls_biometrics_enabled')).toBeNull();
  });

  it('renders notifications card and toggles push notifications', async () => {
    localStorage.clear();

    class MockNotification {
      static permission: NotificationPermission = 'granted';
      static requestPermission = vi.fn(async () => 'granted' as NotificationPermission);
    }
    (window as any).Notification = MockNotification;

    render(<SettingsPage childId="demo-child-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('notifications-settings-card')).toBeDefined();
    });

    const toggleBtn = screen.getByTestId('push-notifications-toggle-btn');
    expect(toggleBtn).toBeDefined();
    expect(toggleBtn.getAttribute('role')).toBe('switch');
    expect(toggleBtn.getAttribute('aria-checked')).toBe('false');
    expect(toggleBtn.textContent).toBe('Включить');

    // Toggle on
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    expect(MockNotification.requestPermission).toHaveBeenCalled();
    expect(toggleBtn.textContent).toBe('Включено');
    expect(toggleBtn.getAttribute('aria-checked')).toBe('true');
    expect(localStorage.getItem('mls_push_notifications_enabled')).toBe('true');

    // Toggle off
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    expect(toggleBtn.textContent).toBe('Включить');
    expect(toggleBtn.getAttribute('aria-checked')).toBe('false');
    expect(localStorage.getItem('mls_push_notifications_enabled')).toBe('false');
  });

  it('shows hint when push notification permission is denied', async () => {
    localStorage.clear();

    class MockNotification {
      static permission: NotificationPermission = 'denied';
      static requestPermission = vi.fn(async () => 'denied' as NotificationPermission);
    }
    (window as any).Notification = MockNotification;

    render(<SettingsPage childId="demo-child-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('notifications-settings-card')).toBeDefined();
    });

    const toggleBtn = screen.getByTestId('push-notifications-toggle-btn');

    // Try to toggle on with denied permission
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    expect(MockNotification.requestPermission).toHaveBeenCalled();
    expect(toggleBtn.textContent).toBe('Включить');
    expect(toggleBtn.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByTestId('notifications-hint')).toBeDefined();
    expect(screen.getByTestId('notifications-hint').textContent).toContain(
      'Разрешите уведомления в настройках браузера'
    );
  });
});
