# Auth Polish, Interactive Theme Bento Card & Wave Theme Transition Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Выполнить 5 пожеланий пользователя: увеличить высоту плашки «My little sun» и уменьшить отступ под ней, сделать блок с месяцем кликабельным переключателем темы (с иконками солнца/луны), удалить демо-кнопки Мама/Папа, увеличить логотип без изменения размера контейнера, и реализовать красивую анимацию смены темы бегущей сверху вниз волной по всему приложению.

**Architecture:**
1. В `LoginPage.tsx` и `RegisterPage.tsx`: плашка «My little sun» получает большую высоту и уменьшенный нижний отступ; демо-кнопки удаляются; карточка логотипа сохраняет фиксированную высоту 150px, а размер картинки увеличивается до 124px; карточка месяца преобразуется в интерактивную кнопку с переключением иконки Луна/Солнце.
2. В `useTheme.ts` и `theme.css`: интеграция View Transitions API (`document.startViewTransition`) со шторкой `clip-path: inset(0 0 100% 0) -> inset(0 0 0 0)` и световой волной `.theme-wave-beam`, пробегающей сверху вниз по экрану при смене темы на любом экране (Header, Settings, Auth).

**Tech Stack:** React 18, TypeScript, CSS (View Transitions API & Keyframe Animations), Vitest.

## Global Constraints

- Сохранение дизайн-системы Bento Natural (цвета `--bg-primary`, `--text-primary`, `--color-lime`, `--color-dark`, радиусы скругления).
- Никаких всплывающих полос прокрутки браузера (`overflow: hidden; height: 100%`).
- Полное прохождение всех тестов сьюта (`npm test`).
- Сборка без ошибок (`npm run build`).

---

### Task 1: Auth Branding Polish & Demo Buttons Removal

**Files:**
- Modify: `client/src/pages/LoginPage.tsx`
- Modify: `client/src/pages/RegisterPage.tsx`
- Modify: `client/src/tests/auth.test.tsx`

**Interfaces:**
- `LoginPage.tsx`:
  - `data-testid="brand-top-strip"`: `padding: '14px 18px'`, `minHeight: '48px'`, `fontSize: '16px'`, `letterSpacing: '1.2px'`, `marginBottom: '4px'`.
  - Logo card: `padding: '10px'`, `minHeight: '150px'`.
  - Logo image `data-testid="auth-logo-img"`: `width: '124px'`, `height: '124px'`, `borderRadius: '24px'`.
  - Remove buttons `[data-testid="quick-login-mama"]` and `[data-testid="quick-login-papa"]`.
- `RegisterPage.tsx`:
  - `data-testid="brand-top-strip"`: `padding: '14px 18px'`, `minHeight: '48px'`, `fontSize: '16px'`, `letterSpacing: '1.2px'`, `marginBottom: '4px'`.

- [ ] **Step 1: Write failing tests for removed demo buttons and enlarged logo**

In `client/src/tests/auth.test.tsx`:
- Replace demo buttons tests with assertions that `quick-login-mama` and `quick-login-papa` are NOT present.
- Assert logo image has enlarged dimensions (124px width/height).
- Assert top strip has updated styling.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run client/src/tests/auth.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Update `LoginPage.tsx` and `RegisterPage.tsx`**

- In `LoginPage.tsx`:
  * Update `data-testid="brand-top-strip"` style:
    ```tsx
    padding: '14px 18px',
    minHeight: '48px',
    fontSize: '16px',
    letterSpacing: '1.2px',
    marginBottom: '4px',
    borderRadius: '20px',
    ```
  * In the dark Bento card (`gridColumn: 'span 2'`):
    ```tsx
    padding: '10px',
    minHeight: '150px',
    ```
    And image:
    ```tsx
    style={{ width: '124px', height: '124px', borderRadius: '24px', objectFit: 'contain' }}
    ```
  * Remove `handleQuickDemo` and the two buttons `quick-login-mama` and `quick-login-papa`.
- In `RegisterPage.tsx`:
  * Update `data-testid="brand-top-strip"` with matching `padding: '14px 18px'`, `marginBottom: '4px'`, `fontSize: '16px'`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run client/src/tests/auth.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add client/src/pages/LoginPage.tsx client/src/pages/RegisterPage.tsx client/src/tests/auth.test.tsx
git commit -m "fix(auth): enlarge logo, polish top brand strip, and remove demo login buttons"
```

---

### Task 2: Clickable Theme Toggle Bento Card on Login Page

**Files:**
- Modify: `client/src/pages/LoginPage.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/tests/auth.test.tsx`

**Interfaces:**
- `LoginPageProps`:
  ```typescript
  export interface LoginPageProps {
    theme?: 'light' | 'dark';
    onToggleTheme?: () => void;
    // ...
  }
  ```
- Bento moon card replaced with interactive button:
  ```tsx
  <button
    type="button"
    data-testid="auth-theme-toggle-btn"
    aria-label={currentTheme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
    onClick={handleToggleTheme}
    style={{
      flexGrow: 1,
      borderRadius: '24px',
      backgroundColor: currentTheme === 'dark' ? '#2E4233' : '#D4F27A',
      color: currentTheme === 'dark' ? '#D4F27A' : '#1E2A20',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: 0,
      cursor: 'pointer',
      transition: 'transform 0.15s, background-color 0.25s, color 0.25s',
    }}
  >
    {currentTheme === 'dark' ? (
      /* Sun SVG icon */
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ) : (
      /* Moon SVG icon */
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      </svg>
    )}
  </button>
  ```
- In `App.tsx`: pass `theme={resolvedTheme}` and `onToggleTheme={toggleTheme}` to `<LoginPage>`.

- [ ] **Step 1: Write failing tests for auth theme toggle**

In `client/src/tests/auth.test.tsx`:
- Test that `LoginPage` renders `auth-theme-toggle-btn` with moon icon when theme is light.
- Test that clicking `auth-theme-toggle-btn` invokes `onToggleTheme`.
- Test that when theme is dark, sun icon is rendered with corresponding aria-label.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run client/src/tests/auth.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Update `LoginPage.tsx` and `App.tsx`**

- In `LoginPage.tsx`:
  * Accept `theme?: 'light' | 'dark'` and `onToggleTheme?: () => void`.
  * Fallback to internal `useTheme()` if props are omitted.
  * Render `<button type="button" data-testid="auth-theme-toggle-btn">` in place of the static `<div>`.
  * Render Sun icon when dark, Moon icon when light.
- In `App.tsx`:
  * Pass `theme={resolvedTheme}` and `onToggleTheme={toggleTheme}` to `<LoginPage>`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run client/src/tests/auth.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add client/src/pages/LoginPage.tsx client/src/App.tsx client/src/tests/auth.test.tsx
git commit -m "feat(auth): make moon bento card an interactive theme toggle with sun and moon icons"
```

---

### Task 3: Top-to-Bottom Wave Theme Transition Across App

**Files:**
- Modify: `client/src/hooks/useTheme.ts`
- Modify: `client/src/styles/theme.css`
- Test: `client/src/tests/bento.test.tsx`

**Interfaces:**
- In `useTheme.ts`:
  - When `toggleTheme` or `setTheme` changes theme:
    - If `document.startViewTransition` is supported, execute DOM theme change inside transition callback.
    - Spawn a temporary luminous wave beam (`.theme-wave-beam`) that sweeps from top to bottom across the screen for 0.6s.
- In `theme.css`:
  - Add View Transitions styling:
    ```css
    ::view-transition-old(root) {
      animation: none;
      z-index: 1;
    }
    ::view-transition-new(root) {
      animation: theme-wave-down 0.6s cubic-bezier(0.25, 1, 0.5, 1) forwards;
      z-index: 2;
    }
    @keyframes theme-wave-down {
      from {
        clip-path: inset(0 0 100% 0);
      }
      to {
        clip-path: inset(0 0 0 0);
      }
    }
    ```
  - Add `.theme-wave-beam` styling:
    ```css
    .theme-wave-beam {
      position: fixed;
      top: -120px;
      left: 0;
      right: 0;
      height: 120px;
      pointer-events: none;
      z-index: 99999;
      background: linear-gradient(180deg, rgba(212, 242, 122, 0) 0%, rgba(212, 242, 122, 0.45) 50%, rgba(255, 255, 255, 0.85) 100%);
      box-shadow: 0 10px 30px rgba(212, 242, 122, 0.45);
      animation: theme-wave-sweep 0.6s cubic-bezier(0.25, 1, 0.5, 1) forwards;
    }
    .theme-wave-beam[data-target-theme="dark"] {
      background: linear-gradient(180deg, rgba(14, 23, 17, 0) 0%, rgba(35, 55, 42, 0.5) 50%, rgba(14, 23, 17, 0.95) 100%);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
    }
    @keyframes theme-wave-sweep {
      0% {
        transform: translateY(0);
        opacity: 0.9;
      }
      100% {
        transform: translateY(calc(100vh + 160px));
        opacity: 0;
      }
    }
    ```
  - Smooth transitions on background and text colors:
    ```css
    * {
      transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease, box-shadow 0.3s ease;
    }
    ```

- [ ] **Step 1: Write test for theme wave styles and transition execution**

In `client/src/tests/bento.test.tsx`:
- Test that `theme.css` contains `theme-wave-down` keyframes and `.theme-wave-beam` wave styles.
- Test that `useTheme` dispatches theme update smoothly.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run client/src/tests/bento.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Update `useTheme.ts` and `theme.css`**

- In `useTheme.ts`:
  * Implement `triggerThemeTransition(nextResolved: 'light' | 'dark', apply: () => void)`:
    - Wraps `apply()` in `document.startViewTransition` if available.
    - Appends `.theme-wave-beam` element with `data-target-theme` and cleans up after 650ms.
  * Integrate into `setTheme` and `toggleTheme`.
- In `theme.css`:
  * Add the `@keyframes theme-wave-down`, View Transitions pseudo-selectors, and `@keyframes theme-wave-sweep` with `.theme-wave-beam`.
  * Ensure `@media (prefers-reduced-motion: reduce)` disables animations.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run client/src/tests/bento.test.tsx`
Expected: PASS.
Run: `npm test` (all 15 suites pass)
Run: `npm run build` (0 errors)

- [ ] **Step 5: Commit changes**

```bash
git add client/src/hooks/useTheme.ts client/src/styles/theme.css client/src/tests/
git commit -m "feat(ui): add top-to-bottom wave theme transition with view transitions and luminous wave beam"
```
