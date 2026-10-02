# Layout Fixes and Navigation Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Устранить 6 замечаний по верстке: оставить только логотип без надписей в блоке авторизации, включить скролл формы регистрации, убрать двойной скролл браузера, зафиксировать Header и BottomNav при скролле, добавить Header в Настройки и выровнять кнопки BottomNav.

**Architecture:** Единая архитектура viewport-контейнера: `html, body, #root, .mobile-viewport-wrapper` имеют фиксированную высоту (`height: 100dvh` на мобильных, `92vh` на десктопе) и `overflow: hidden`. Внутри контейнера: `<Header>` (`flex-shrink: 0`) сверху, `<BottomNav>` (`flex-shrink: 0; height: 88px`) снизу, а между ними скроллится `.screen-content` (`flex: 1 1 auto; overflow-y: auto`).

**Tech Stack:** TypeScript, React 18, CSS, Vitest.

## Global Constraints

- Полное устранение скролла страницы браузера (скролл исключительно внутри контейнера приложения).
- Header и BottomNav зафиксированы на всех страницах (Сегодня, Календарь, Настройки).
- Кнопки BottomNav не сплющиваются (`flex-shrink: 0; min-height: 88px;`).
- В блоке логотипа на страницах входа и регистрации остается ТОЛЬКО логотип без текста.
- 100% прохождение существующих тестов (`npm test`).

---

### Task 1: Auth Pages Fixes: Pure Logo in Card and Scrollable Registration Page

**Files:**
- Modify: `client/src/pages/LoginPage.tsx`
- Modify: `client/src/pages/RegisterPage.tsx`
- Test: `client/src/tests/auth.test.tsx`

**Interfaces:**
- `LoginPage.tsx`: In the 2-column dark Bento card, remove text, center the logo image `[data-testid="auth-logo-img"]`.
- `RegisterPage.tsx`: Wrap contents in a scrollable container with `flex: 1; overflow-y: auto;` so all fields scroll down to submit.

- [ ] **Step 1: Write failing tests for pure logo and scrollable register container**

In `client/src/tests/auth.test.tsx`:
- Test that the logo card on `LoginPage` does not contain the text "My little son" or "режим сна малыша", and only renders the logo image `[data-testid="auth-logo-img"]`.
- Test that `RegisterPage` renders all fields inside a scrollable `.screen-content` container.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/tests/auth.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Update `LoginPage.tsx` and `RegisterPage.tsx`**

- In `LoginPage.tsx`:
  * In the dark Bento card (`gridColumn: 'span 2'`), remove the text divs, center the logo image:
    ```tsx
    <section
      style={{
        gridColumn: 'span 2',
        backgroundColor: '#23372A',
        color: '#F1F4EA',
        borderRadius: '28px',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '150px',
      }}
    >
      <img
        src="/logo.svg"
        alt="Logo"
        data-testid="auth-logo-img"
        style={{ width: '88px', height: '88px', borderRadius: '20px', objectFit: 'contain' }}
      />
    </section>
    ```
- In `RegisterPage.tsx`:
  * Make `.register-screen` a fixed container (`height: 100%; overflow: hidden; display: flex; flex-direction: column;`).
  * Wrap all header, form, and footer elements inside a `<div className="screen-content" style={{ flexGrow: 1, overflowY: 'auto', padding: '16px 16px 32px' }}>`.
  * In the logo header, render only the logo without redundant text.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run client/src/tests/auth.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add client/src/pages/LoginPage.tsx client/src/pages/RegisterPage.tsx client/src/tests/auth.test.tsx
git commit -m "fix(auth): display pure logo without text and enable smooth scrolling on register page"
```

---

### Task 2: Fixed Header & Unsquished Fixed BottomNav Architecture

**Files:**
- Modify: `client/src/components/common/BottomNav.tsx`
- Modify: `client/src/pages/TodayAwakePage.tsx`
- Modify: `client/src/pages/TodaySleepingPage.tsx`
- Modify: `client/src/pages/CalendarPage.tsx`
- Modify: `client/src/pages/SettingsPage.tsx`
- Test: `client/src/tests/bento.test.tsx`, `client/src/tests/todayAwake.test.tsx`, `client/src/tests/calendar.test.tsx`, `client/src/tests/settings.test.tsx`

**Interfaces:**
- `BottomNav.tsx`:
  * Container style: `flexShrink: 0; minHeight: 88px; height: 88px; width: 100%;`
  * Tab button style: `minHeight: 52px; height: 52px;`
- On `TodayAwakePage`, `TodaySleepingPage`, `CalendarPage`, `SettingsPage`:
  * Layout:
    ```tsx
    <div className="mobile-viewport-wrapper">
      <Header ... style={{ flexShrink: 0 }} />
      <div className="screen-content" style={{ flex: '1 1 auto', overflowY: 'auto' }}>
        {/* Scrollable page body */}
      </div>
      <BottomNav ... style={{ flexShrink: 0 }} />
    </div>
    ```
  * In `SettingsPage.tsx`:
    * Render `<Header title="Настройки" roles={['Мама', 'Папа']} isOnline={true} theme={theme} onToggleTheme={...} />`.
    * Remove the huge `padding: '56px 16px 24px'` and use standard `padding: '16px'`.

- [ ] **Step 1: Write failing tests for fixed header, settings header, and unsquished nav**

In `client/src/tests/settings.test.tsx`:
- Test that `SettingsPage` renders `<Header />` with title "Настройки".
In `client/src/tests/bento.test.tsx`:
- Test that `BottomNav` has `flexShrink: 0` and `height: 88px`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run client/src/tests/settings.test.tsx client/src/tests/bento.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Update `BottomNav.tsx` and all 4 pages**

- In `BottomNav.tsx`:
  * Set container `flexShrink: 0`, `height: '88px'`, `minHeight: '88px'`.
  * Set buttons `minHeight: '52px'`, `height: '52px'`.
- In `TodayAwakePage.tsx` & `TodaySleepingPage.tsx`:
  * Move `<Header>` outside of `.screen-content`, directly above it with `flexShrink: 0`.
- In `CalendarPage.tsx`:
  * Move `<Header>` outside of `.screen-content`, directly above it with `flexShrink: 0`.
- In `SettingsPage.tsx`:
  * Import and render `<Header title="Настройки" roles={['Мама', 'Папа']} isOnline={true} theme={currentTheme} onToggleTheme={...} style={{ flexShrink: 0 }} />` directly above `.screen-content`.
  * Adjust `.screen-content` padding to standard `16px 16px 24px`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run client/src/tests/settings.test.tsx client/src/tests/bento.test.tsx client/src/tests/todayAwake.test.tsx client/src/tests/calendar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add client/src/components/common/BottomNav.tsx client/src/pages/ client/src/tests/
git commit -m "fix(layout): fix header at top and bottom nav at bottom with scrollable content between them"
```

---

### Task 3: Container-Only Scrolling (Eliminate Browser Window Scrollbar)

**Files:**
- Modify: `client/src/index.css`
- Modify: `client/src/styles/theme.css`
- Modify: `client/src/pages/TodayAwakePage.tsx`, `TodaySleepingPage.tsx`, `CalendarPage.tsx`, `SettingsPage.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`
- Test: `client/src/tests/bento.test.tsx`

**Interfaces:**
- Global CSS:
  * `html, body`: `overflow: hidden; height: 100%; height: 100dvh; margin: 0; padding: 0;`
  * Desktop `@media (min-width: 480px)`:
    `body { overflow: hidden; height: 100vh; height: 100dvh; display: flex; justify-content: center; align-items: center; padding: 0; margin: 0; }`
    `#root { width: 430px; height: 92vh; max-height: 920px; overflow: hidden; border-radius: 36px; }`
    `.mobile-viewport-wrapper { width: 100%; height: 100%; overflow: hidden; }`
  * Remove conflicting inline `minHeight: '100vh'` across all pages.

- [ ] **Step 1: Write tests verifying overflow and container sizing**

In `client/src/tests/bento.test.tsx`:
- Test that `.mobile-viewport-wrapper` has `overflow: hidden` and `height: 100%` (or fixed viewport bounds).

- [ ] **Step 2: Update `index.css`, `theme.css`, and page wrapper styles**

- In `client/src/index.css`:
  * Ensure `html, body` have `overflow: hidden` and `height: 100%`.
  * `#root` has `overflow: hidden`.
- In `client/src/styles/theme.css`:
  * In `@media (min-width: 480px)`:
    Set `body { padding: 0; margin: 0; overflow: hidden; height: 100vh; }`.
    Set `#root { width: 430px; height: 92vh; max-height: 920px; overflow: hidden; }`.
    Set `.mobile-viewport-wrapper { width: 100%; height: 100%; overflow: hidden; }`.
- In `TodayAwakePage.tsx`, `TodaySleepingPage.tsx`, `CalendarPage.tsx`, `SettingsPage.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`:
  * Change inline style from `minHeight: '100vh'` to `height: '100%', overflow: 'hidden'`.

- [ ] **Step 3: Run full test suite and build**

Run: `npm test`
Expected: 100% pass across all 15 test files.
Run: `npm run build`
Expected: 0 errors.

- [ ] **Step 4: Commit changes**

```bash
git add client/src/index.css client/src/styles/theme.css client/src/pages/ client/src/tests/
git commit -m "fix(viewport): eliminate browser scrollbars and enforce strict container-only scrolling"
```
