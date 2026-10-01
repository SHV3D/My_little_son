/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WarningBanner } from '../components/common/WarningBanner';
import { SleepWarning } from '@shared/sleepEngine';

describe('WarningBanner Component', () => {
  it('renders nothing when warnings is undefined or empty', () => {
    const { container: emptyContainer } = render(<WarningBanner warnings={[]} />);
    expect(emptyContainer.firstChild).toBeNull();

    const { container: undefContainer } = render(<WarningBanner />);
    expect(undefContainer.firstChild).toBeNull();
  });

  it('renders alert card with correct title, message, badge, advice text, action button and a11y roles', () => {
    const alertWarning: SleepWarning = {
      code: 'OVERTIRED',
      severity: 'alert',
      title: 'Сильный перегул',
      message: 'Малыш бодрствует 3:45, превышение на 45 мин.',
      actionRecommendation: 'Уложите спать как можно скорее',
      actionType: 'EARLY_BEDTIME',
    };

    render(<WarningBanner warnings={[alertWarning]} />);

    const banner = screen.getByTestId('warning-banner');
    expect(banner).toBeDefined();
    expect(banner.getAttribute('data-severity')).toBe('alert');
    expect(banner.getAttribute('role')).toBe('alert');
    expect(banner.getAttribute('aria-live')).toBe('assertive');

    const badge = screen.getByTestId('warning-banner-badge');
    expect(badge.textContent).toBe('Внимание');

    const title = screen.getByTestId('warning-banner-title');
    expect(title.textContent).toBe('Сильный перегул');

    const message = screen.getByTestId('warning-banner-message');
    expect(message.textContent).toContain('Малыш бодрствует 3:45');

    const advice = screen.getByTestId('warning-banner-recommendation');
    expect(advice.textContent).toContain('Уложите спать как можно скорее');

    const actionBtn = screen.getByTestId('warning-banner-action');
    expect(actionBtn.textContent).toContain('Уложить раньше');

    const closeBtn = screen.getByTestId('warning-banner-close');
    expect(closeBtn).toBeDefined();
  });

  it('renders warning card with correct badge, role, and severity', () => {
    const warnWarning: SleepWarning = {
      code: 'LATE_NAP_BEDTIME_SHIFT',
      severity: 'warning',
      title: 'Сдвиг отбоя',
      message: 'Последний сон начался позже обычного.',
      actionRecommendation: 'Сократите вечерний сон',
      actionType: 'SHORT_BRIDGE_NAP',
    };

    render(<WarningBanner warnings={[warnWarning]} />);

    const banner = screen.getByTestId('warning-banner');
    expect(banner.getAttribute('data-severity')).toBe('warning');
    expect(banner.getAttribute('role')).toBe('status');
    expect(banner.getAttribute('aria-live')).toBe('polite');

    const badge = screen.getByTestId('warning-banner-badge');
    expect(badge.textContent).toBe('Важно');

    const advice = screen.getByTestId('warning-banner-recommendation');
    expect(advice.textContent).toContain('Сократите вечерний сон');

    const actionBtn = screen.getByTestId('warning-banner-action');
    expect(actionBtn.textContent).toContain('Короткий мостик');
  });

  it('renders info card with correct badge, role, advice, and severity', () => {
    const infoWarning: SleepWarning = {
      code: 'UNDERTIRED',
      severity: 'info',
      title: 'Мало бодрствовал',
      message: 'Время бодрствования меньше нормы.',
      actionRecommendation: 'Продлите активные игры',
    };

    render(<WarningBanner warnings={[infoWarning]} />);

    const banner = screen.getByTestId('warning-banner');
    expect(banner.getAttribute('data-severity')).toBe('info');
    expect(banner.getAttribute('role')).toBe('status');
    expect(banner.getAttribute('aria-live')).toBe('polite');

    const badge = screen.getByTestId('warning-banner-badge');
    expect(badge.textContent).toBe('Совет');

    const advice = screen.getByTestId('warning-banner-recommendation');
    expect(advice.textContent).toContain('Продлите активные игры');
    expect(screen.queryByTestId('warning-banner-action')).toBeNull();
  });

  it('applies --warning-warn-* token styles and proper fallbacks for warning severity', () => {
    const warnWarning: SleepWarning = {
      code: 'LATE_NAP_BEDTIME_SHIFT',
      severity: 'warning',
      title: 'Сдвиг отбоя',
      message: 'Последний сон начался позже обычного.',
    };

    render(<WarningBanner warnings={[warnWarning]} />);
    const banner = screen.getByTestId('warning-banner');

    expect(banner.style.background).toContain('--warning-warn-bg');
    expect(banner.style.borderColor || banner.style.border).toContain('--warning-warn-border');
    expect(banner.style.color).toContain('--warning-warn-text');
  });

  it('calls onAction with the active warning when action button is clicked', () => {
    const onAction = vi.fn();
    const warning: SleepWarning = {
      code: 'ABNORMALLY_LONG_NAP',
      severity: 'alert',
      title: 'Слишком длинный сон',
      message: 'Сон длится более 2 ч 15 мин.',
      actionRecommendation: 'Разбудить сейчас',
      actionType: 'WAKE_NOW',
    };

    render(<WarningBanner warnings={[warning]} onAction={onAction} />);

    const actionBtn = screen.getByTestId('warning-banner-action');
    fireEvent.click(actionBtn);

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(warning);
  });

  it('calls onDismiss with warning code when close button is clicked', () => {
    const onDismiss = vi.fn();
    const warning: SleepWarning = {
      code: 'FORGOTTEN_WAKEUP_TIMER',
      severity: 'alert',
      title: 'Таймер сна всё ещё включён',
      message: 'Возможно, вы забыли отметить пробуждение?',
      actionRecommendation: 'Указать время',
      actionType: 'SET_WAKE_TIME',
    };

    render(<WarningBanner warnings={[warning]} onDismiss={onDismiss} />);

    const closeBtn = screen.getByTestId('warning-banner-close');
    fireEvent.click(closeBtn);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith('FORGOTTEN_WAKEUP_TIMER');
  });

  it('prioritizes the highest severity warning when multiple are passed (alert > warning > info)', () => {
    const warnings: SleepWarning[] = [
      {
        code: 'UNDERTIRED',
        severity: 'info',
        title: 'Совет по бодрствованию',
        message: 'Мало бодрствовал.',
      },
      {
        code: 'OVERTIRED',
        severity: 'alert',
        title: 'Критический перегул',
        message: 'Бодрствует слишком долго.',
      },
      {
        code: 'LATE_NAP_BEDTIME_SHIFT',
        severity: 'warning',
        title: 'Предупреждение об отбое',
        message: 'Сдвиг отбоя.',
      },
    ];

    render(<WarningBanner warnings={warnings} />);

    // Should prioritize the alert
    const banner = screen.getByTestId('warning-banner');
    expect(banner.getAttribute('data-severity')).toBe('alert');
    expect(screen.getByTestId('warning-banner-title').textContent).toBe('Критический перегул');
  });

  it('displays counter and allows cycling through multiple warnings', () => {
    const warnings: SleepWarning[] = [
      {
        code: 'OVERTIRED',
        severity: 'alert',
        title: 'Предупреждение 1',
        message: 'Сообщение 1',
      },
      {
        code: 'DAY_BUDGET_EXHAUSTED',
        severity: 'warning',
        title: 'Предупреждение 2',
        message: 'Сообщение 2',
      },
    ];

    render(<WarningBanner warnings={warnings} />);

    // Counter pill
    const counter = screen.getByTestId('warning-banner-counter');
    expect(counter.textContent).toContain('1 / 2');

    // Next button
    const nextBtn = screen.getByTestId('warning-banner-next');
    fireEvent.click(nextBtn);

    expect(screen.getByTestId('warning-banner-title').textContent).toBe('Предупреждение 2');
    expect(counter.textContent).toContain('2 / 2');

    // Prev button
    const prevBtn = screen.getByTestId('warning-banner-prev');
    fireEvent.click(prevBtn);

    expect(screen.getByTestId('warning-banner-title').textContent).toBe('Предупреждение 1');
  });

  it('does not render counter or prev/next buttons when only a single warning is present', () => {
    const singleWarning: SleepWarning = {
      code: 'DAY_BUDGET_EXHAUSTED',
      severity: 'warning',
      title: 'Лимит дневного сна исчерпан',
      message: 'Все запланированные часы дневного сна уже использованы.',
    };

    render(<WarningBanner warnings={[singleWarning]} />);

    expect(screen.queryByTestId('warning-banner-counter')).toBeNull();
    expect(screen.queryByTestId('warning-banner-prev')).toBeNull();
    expect(screen.queryByTestId('warning-banner-next')).toBeNull();
  });

  it('does not render action button if neither actionRecommendation nor actionType is provided', () => {
    const noActionWarning: SleepWarning = {
      code: 'SEVERE_DAY_DEFICIT',
      severity: 'warning',
      title: 'Дефицит дневного сна',
      message: 'Суммарный дневной сон ниже нормы.',
    };

    render(<WarningBanner warnings={[noActionWarning]} />);

    expect(screen.queryByTestId('warning-banner-action')).toBeNull();
    expect(screen.queryByTestId('warning-banner-recommendation')).toBeNull();
  });

  it('renders concise action button labels for each actionType', () => {
    const testCases: Array<{ actionType: SleepWarning['actionType']; expectedLabel: string }> = [
      { actionType: 'WAKE_NOW', expectedLabel: 'Разбудить сейчас' },
      { actionType: 'SET_WAKE_TIME', expectedLabel: 'Указать время пробуждения' },
      { actionType: 'SHORT_BRIDGE_NAP', expectedLabel: 'Короткий мостик' },
      { actionType: 'EARLY_BEDTIME', expectedLabel: 'Уложить раньше' },
      { actionType: 'CHECK_TIME', expectedLabel: 'Проверить время' },
    ];

    for (const { actionType, expectedLabel } of testCases) {
      const { unmount } = render(
        <WarningBanner
          warnings={[
            {
              code: 'OVERTIRED',
              severity: 'warning',
              title: 'Тест',
              message: 'Тест',
              actionType,
            },
          ]}
        />
      );
      const actionBtn = screen.getByTestId('warning-banner-action');
      expect(actionBtn.textContent).toContain(expectedLabel);
      unmount();
    }
  });

  it('renders default fallback action button text for different actionTypes if actionRecommendation is absent', () => {
    const { unmount } = render(
      <WarningBanner
        warnings={[
          {
            code: 'ABNORMALLY_LONG_NAP',
            severity: 'alert',
            title: 'Тест',
            message: 'Тест',
            actionType: 'WAKE_NOW',
          },
        ]}
      />
    );
    expect(screen.getByTestId('warning-banner-action').textContent).toContain('Разбудить сейчас');
    unmount();

    render(
      <WarningBanner
        warnings={[
          {
            code: 'FORGOTTEN_WAKEUP_TIMER',
            severity: 'alert',
            title: 'Тест',
            message: 'Тест',
            actionType: 'SET_WAKE_TIME',
          },
        ]}
      />
    );
    expect(screen.getByTestId('warning-banner-action').textContent).toContain('Указать время пробуждения');
  });

  it('merges custom className and style props into container', () => {
    const warning: SleepWarning = {
      code: 'OVERTIRED',
      severity: 'alert',
      title: 'Перегул',
      message: 'Тест',
    };

    render(
      <WarningBanner
        warnings={[warning]}
        className="my-custom-class"
        style={{ marginTop: '20px' }}
      />
    );

    const banner = screen.getByTestId('warning-banner');
    expect(banner.classList.contains('my-custom-class')).toBe(true);
    expect(banner.style.marginTop).toBe('20px');
  });
});
