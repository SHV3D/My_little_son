/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AwakeBatteryBar } from '../components/bento/AwakeBatteryBar';
import { DayTimelineBar, parseTimeToMinutes } from '../components/bento/DayTimelineBar';
import { BentoCard } from '../components/bento/BentoCard';
import { Header } from '../components/common/Header';
import { BottomNav } from '../components/common/BottomNav';

describe('AwakeBatteryBar Component', () => {
  it('renders exactly 7 bars with correct active/inactive classes for levels 1 to 7', () => {
    for (let level = 1; level <= 7; level++) {
      const { unmount } = render(<AwakeBatteryBar level={level} />);
      const bars = screen.getAllByTestId('battery-bar');
      expect(bars).toHaveLength(7);

      bars.forEach((bar, idx) => {
        if (idx < level) {
          expect(bar.classList.contains('active')).toBe(true);
          expect(bar.classList.contains('battery-bar-active')).toBe(true);
          expect(bar.getAttribute('data-active')).toBe('true');
        } else {
          expect(bar.classList.contains('inactive')).toBe(true);
          expect(bar.classList.contains('battery-bar-inactive')).toBe(true);
          expect(bar.getAttribute('data-active')).toBe('false');
        }
      });
      unmount();
    }
  });

  it('renders all 7 bars as inactive when level is 0', () => {
    render(<AwakeBatteryBar level={0} />);
    const bars = screen.getAllByTestId('battery-bar');
    expect(bars).toHaveLength(7);
    bars.forEach((bar) => {
      expect(bar.classList.contains('inactive')).toBe(true);
      expect(bar.getAttribute('data-active')).toBe('false');
    });
  });

  it('clamps level when exceeding 7 or below 0', () => {
    const { rerender } = render(<AwakeBatteryBar level={10} />);
    let bars = screen.getAllByTestId('battery-bar');
    expect(bars.filter((b) => b.getAttribute('data-active') === 'true')).toHaveLength(7);

    rerender(<AwakeBatteryBar level={-2} />);
    bars = screen.getAllByTestId('battery-bar');
    expect(bars.filter((b) => b.getAttribute('data-active') === 'true')).toHaveLength(0);
  });
});

describe('DayTimelineBar Component', () => {
  it('parses time strings to total minutes from midnight correctly', () => {
    expect(parseTimeToMinutes('07:00')).toBe(420);
    expect(parseTimeToMinutes('09:35')).toBe(575);
    expect(parseTimeToMinutes('10:50')).toBe(650);
    expect(parseTimeToMinutes('21:00')).toBe(1260);
    expect(parseTimeToMinutes(500)).toBe(500);
  });

  it('renders sleep intervals with calculated left and width percentages matching daytime schedule', () => {
    const testIntervals = [
      { id: 'sleep-1', start: '09:35', end: '10:50', type: 'sleep' as const, label: 'Сон 1' },
      { id: 'sleep-2', start: '13:20', end: '14:45', type: 'sleep' as const, label: 'Сон 2' },
      { id: 'sleep-3', start: '17:25', end: '17:55', type: 'planned' as const, label: 'Сон 3' },
      { id: 'night', start: '20:35', end: '21:00', type: 'night' as const, label: 'Ночной сон' },
    ];

    render(
      <DayTimelineBar
        dayStart="07:00"
        dayEnd="21:00"
        intervals={testIntervals}
      />
    );

    const blocks = screen.getAllByTestId('sleep-interval-block');
    expect(blocks).toHaveLength(4);

    // Sleep 1: (575 - 420) / 840 = 155 / 840 = 18.452%
    // Duration: 75 / 840 = 8.928%
    expect(blocks[0].getAttribute('data-left')).toBe('18.45%');
    expect(blocks[0].getAttribute('data-width')).toBe('8.93%');
    expect(blocks[0].getAttribute('data-type')).toBe('sleep');

    // Sleep 2: (800 - 420) / 840 = 380 / 840 = 45.238%
    // Duration: 85 / 840 = 10.119%
    expect(blocks[1].getAttribute('data-left')).toBe('45.24%');
    expect(blocks[1].getAttribute('data-width')).toBe('10.12%');

    // Sleep 3: (1045 - 420) / 840 = 625 / 840 = 74.404%
    // Duration: 30 / 840 = 3.571%
    expect(blocks[2].getAttribute('data-left')).toBe('74.40%');
    expect(blocks[2].getAttribute('data-width')).toBe('3.57%');
    expect(blocks[2].getAttribute('data-type')).toBe('planned');

    // Night: (1235 - 420) / 840 = 815 / 840 = 97.023%
    // Duration: 25 / 840 = 2.976%
    expect(blocks[3].getAttribute('data-left')).toBe('97.02%');
    expect(blocks[3].getAttribute('data-width')).toBe('2.98%');
    expect(blocks[3].getAttribute('data-type')).toBe('night');
  });

  it('renders time ticks for daytime reference', () => {
    render(<DayTimelineBar showTicks={true} />);
    const ticks = screen.getByTestId('timeline-ticks');
    expect(ticks).toBeDefined();
    expect(ticks.textContent).toContain('07:00');
    expect(ticks.textContent).toContain('10:30');
    expect(ticks.textContent).toContain('14:00');
    expect(ticks.textContent).toContain('17:30');
    expect(ticks.textContent).toContain('21:00');
  });
});

describe('BottomNav Component', () => {
  it('renders all 3 tabs and highlights default active tab', () => {
    render(<BottomNav activeTab="today" />);
    const todayTab = screen.getByTestId('tab-today');
    const calendarTab = screen.getByTestId('tab-calendar');
    const settingsTab = screen.getByTestId('tab-settings');

    expect(todayTab).toBeDefined();
    expect(calendarTab).toBeDefined();
    expect(settingsTab).toBeDefined();

    expect(todayTab.getAttribute('data-active')).toBe('true');
    expect(calendarTab.getAttribute('data-active')).toBe('false');
    expect(settingsTab.getAttribute('data-active')).toBe('false');
  });

  it('switches active tab and invokes onSelectTab when clicking a tab', () => {
    const handleSelectTab = vi.fn();
    render(<BottomNav onSelectTab={handleSelectTab} />);

    const calendarTab = screen.getByTestId('tab-calendar');
    fireEvent.click(calendarTab);

    expect(handleSelectTab).toHaveBeenCalledWith('calendar');
    expect(calendarTab.getAttribute('data-active')).toBe('true');

    const settingsTab = screen.getByTestId('tab-settings');
    fireEvent.click(settingsTab);

    expect(handleSelectTab).toHaveBeenCalledWith('settings');
    expect(settingsTab.getAttribute('data-active')).toBe('true');
  });

  it('supports russian tab names for activeTab prop', () => {
    render(<BottomNav activeTab="Календарь" />);
    const calendarTab = screen.getByTestId('tab-calendar');
    expect(calendarTab.getAttribute('data-active')).toBe('true');
  });
});

describe('Header Component', () => {
  it('displays title and online roles correctly', () => {
    render(
      <Header
        title="Среда, 30.09"
        roles={['Мама', 'Папа']}
        isOnline={true}
      />
    );

    const titleEl = screen.getByTestId('header-title');
    expect(titleEl.textContent).toBe('Среда, 30.09');

    const rolesEl = screen.getByTestId('header-roles');
    expect(rolesEl.textContent).toContain('Мама · Папа');

    const indicator = screen.getByTestId('online-indicator');
    expect(indicator.getAttribute('data-online')).toBe('true');
  });

  it('supports single role string and offline state', () => {
    render(
      <Header
        title="Четверг, 01.10"
        roles="Мама"
        isOnline={false}
      />
    );

    expect(screen.getByTestId('header-title').textContent).toBe('Четверг, 01.10');
    expect(screen.getByTestId('header-roles').textContent).toContain('Мама');
    expect(screen.getByTestId('online-indicator').getAttribute('data-online')).toBe('false');
  });
});

describe('BentoCard Component', () => {
  it('renders variants with proper data attributes and styles', () => {
    const { rerender } = render(<BentoCard variant="dark">Dark Content</BentoCard>);
    let card = screen.getByTestId('bento-card');
    expect(card.getAttribute('data-variant')).toBe('dark');
    expect(card.textContent).toBe('Dark Content');

    rerender(<BentoCard variant="lime">Lime Content</BentoCard>);
    card = screen.getByTestId('bento-card');
    expect(card.getAttribute('data-variant')).toBe('lime');

    rerender(<BentoCard variant="white" colSpan={2}>Wide White Card</BentoCard>);
    card = screen.getByTestId('bento-card');
    expect(card.getAttribute('data-variant')).toBe('white');
    expect(card.style.gridColumn).toBe('span 2');
  });

  it('handles click events when interactive', () => {
    const handleClick = vi.fn();
    render(<BentoCard onClick={handleClick}>Clickable Card</BentoCard>);

    const card = screen.getByTestId('bento-card');
    fireEvent.click(card);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
