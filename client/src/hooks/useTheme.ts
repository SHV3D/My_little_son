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
    const bg = resolved === 'dark' ? '#142017' : '#ECEEE6';

    // Update body and html background so iOS Safari safe-area bottom bar recolors
    if (document.body) {
      document.body.style.backgroundColor = bg;
    }
    if (document.documentElement) {
      document.documentElement.style.backgroundColor = bg;
    }

    // Update meta theme-color for iOS Safari top bar, URL field, and tab bar
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    if (metas.length > 0) {
      metas.forEach((meta) => {
        meta.setAttribute('content', bg);
      });
    } else {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      meta.setAttribute('content', bg);
      document.head.appendChild(meta);
    }
  }
}

export function triggerThemeTransition(
  nextResolved: 'light' | 'dark',
  apply: () => void
): void {
  // Capture click origin for the radial reveal
  const clickX = (window as any).__themeTransitionX;
  const clickY = (window as any).__themeTransitionY;
  const ox = typeof clickX === 'number' ? `${clickX}px` : '50%';
  const oy = typeof clickY === 'number' ? `${clickY}px` : '50%';

  // Set CSS custom properties for the circle origin
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--theme-transition-x', ox);
    document.documentElement.style.setProperty('--theme-transition-y', oy);
  }

  if (
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    typeof (document as any).startViewTransition === 'function'
  ) {
    try {
      (document as any).startViewTransition(() => {
        apply();
      });
    } catch {
      apply();
    }
  } else {
    apply();
  }

  // Spawn shimmer ring overlay
  if (typeof document !== 'undefined' && document.body) {
    const beam = document.createElement('div');
    beam.className = 'theme-wave-beam';
    beam.setAttribute('data-target-theme', nextResolved);
    beam.style.setProperty('--theme-transition-x', ox);
    beam.style.setProperty('--theme-transition-y', oy);
    document.body.appendChild(beam);

    setTimeout(() => {
      if (beam.parentNode) {
        beam.parentNode.removeChild(beam);
      }
    }, 850);

    // Spawn sparkle particles bursting outward
    const sparkleCount = 8;
    const centerX = typeof clickX === 'number' ? clickX : window.innerWidth / 2;
    const centerY = typeof clickY === 'number' ? clickY : window.innerHeight / 2;

    for (let i = 0; i < sparkleCount; i++) {
      const sparkle = document.createElement('div');
      sparkle.className = 'theme-sparkle';
      sparkle.setAttribute('data-target-theme', nextResolved);

      const angle = (Math.PI * 2 * i) / sparkleCount + (Math.random() - 0.5) * 0.4;
      const distance = 50 + Math.random() * 80;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const duration = 0.4 + Math.random() * 0.35;

      sparkle.style.setProperty('--sx', `${centerX}px`);
      sparkle.style.setProperty('--sy', `${centerY}px`);
      sparkle.style.setProperty('--dx', `${dx}px`);
      sparkle.style.setProperty('--dy', `${dy}px`);
      sparkle.style.setProperty('--sparkle-duration', `${duration}s`);
      sparkle.style.left = '0';
      sparkle.style.top = '0';

      document.body.appendChild(sparkle);

      setTimeout(() => {
        if (sparkle.parentNode) {
          sparkle.parentNode.removeChild(sparkle);
        }
      }, duration * 1000 + 100);
    }
  }

  // Clean up stored coordinates
  delete (window as any).__themeTransitionX;
  delete (window as any).__themeTransitionY;
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
      const nextResolved =
        mode === 'system'
          ? (getSystemPreference() === 'dark' ? 'dark' : 'light')
          : mode;

      triggerThemeTransition(nextResolved, () => {
        setThemeState(mode);
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            localStorage.setItem(STORAGE_KEY, mode);
          } catch {
            // Ignore storage quota errors
          }
        }
        applyThemeAttribute(nextResolved);
      });
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
