/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { useTheme } from '../hooks/useTheme';
import { Header } from '../components/common/Header';
import { SettingsPage } from '../pages/SettingsPage';

describe('useTheme hook', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('defaults to system theme and applies data-theme attribute', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toMatch(/light|dark/);
    expect(document.documentElement.getAttribute('data-theme')).toMatch(/light|dark/);
  });

  it('persists selected theme to localStorage and toggles correctly', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('dark');
    });
    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(localStorage.getItem('mls_theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');
    expect(localStorage.getItem('mls_theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('loads saved theme from localStorage on initial render', () => {
    localStorage.setItem('mls_theme', 'dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('responds to matchMedia changes when theme is system', () => {
    let listener: ((e: MediaQueryListEvent) => void) | null = null;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_type, cb) => {
        listener = cb;
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('light');

    act(() => {
      if (listener) {
        listener({ matches: true } as MediaQueryListEvent);
      }
    });

    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

describe('Header theme toggle', () => {
  it('renders theme-toggle-btn with correct icon and aria-label for light theme', () => {
    const handleToggle = vi.fn();
    render(<Header theme="light" onToggleTheme={handleToggle} />);

    const btn = screen.getByTestId('theme-toggle-btn');
    expect(btn).toBeDefined();
    expect(btn.getAttribute('aria-label')).toBe('Включить тёмную тему');

    fireEvent.click(btn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('renders theme-toggle-btn with correct icon and aria-label for dark theme', () => {
    const handleToggle = vi.fn();
    render(<Header theme="dark" onToggleTheme={handleToggle} />);

    const btn = screen.getByTestId('theme-toggle-btn');
    expect(btn).toBeDefined();
    expect(btn.getAttribute('aria-label')).toBe('Включить светлую тему');

    fireEvent.click(btn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsPage theme settings', () => {
  it('renders theme settings card with light, dark, and system options', () => {
    const handleThemeChange = vi.fn();
    render(
      <SettingsPage
        theme="light"
        onThemeChange={handleThemeChange}
      />
    );

    const card = screen.getByTestId('theme-settings-card');
    expect(card).toBeDefined();
    expect(card.textContent).toContain('Оформление');

    const lightBtn = screen.getByTestId('theme-option-light');
    const darkBtn = screen.getByTestId('theme-option-dark');
    const systemBtn = screen.getByTestId('theme-option-system');

    expect(lightBtn.textContent).toContain('Светлая');
    expect(darkBtn.textContent).toContain('Тёмная');
    expect(systemBtn.textContent).toContain('Системная');

    fireEvent.click(darkBtn);
    expect(handleThemeChange).toHaveBeenCalledWith('dark');

    fireEvent.click(systemBtn);
    expect(handleThemeChange).toHaveBeenCalledWith('system');

    fireEvent.click(lightBtn);
    expect(handleThemeChange).toHaveBeenCalledWith('light');
  });
});
