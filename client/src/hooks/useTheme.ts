import { useState, useEffect, useCallback, useLayoutEffect } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface UseThemeReturn {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'mls_theme';

function getSystemPreference(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }
  return 'light';
}

function getStoredTheme(): ThemeMode {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch {
      // Fallback
    }
  }
  return 'system';
}

function applyThemeAttribute(resolved: 'light' | 'dark') {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', resolved);
  }
}

export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<ThemeMode>(getStoredTheme);
  const [systemDark, setSystemDark] = useState<boolean>(() => getSystemPreference() === 'dark');

  // Media query listener
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const update = (matches: boolean) => {
      setSystemDark(matches);
    };

    update(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      update(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, []);

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  // Use layout effect for synchronous DOM attribute application without flashing
  useLayoutEffect(() => {
    applyThemeAttribute(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback(
    (mode: ThemeMode) => {
      setThemeState(mode);
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(STORAGE_KEY, mode);
        } catch {
          // Ignore storage quota errors
        }
      }

      const nextResolved =
        mode === 'system'
          ? (getSystemPreference() === 'dark' ? 'dark' : 'light')
          : mode;
      applyThemeAttribute(nextResolved);
    },
    []
  );

  const toggleTheme = useCallback(() => {
    const nextTheme: ThemeMode = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  }, [resolvedTheme, setTheme]);

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
  };
}

export default useTheme;
