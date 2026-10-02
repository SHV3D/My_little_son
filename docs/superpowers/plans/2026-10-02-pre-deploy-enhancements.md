# Pre-Deploy Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать финальный пакет доработок перед деплоем: целевой логотип и PWA-иконки, кодовое слово семьи и восстановление пароля, быстрый вход по биометрии, системные push-уведомления о предупреждениях и режиме сна.

**Architecture:** Копирование векторного SVG логотипа в PWA ассеты и внедрение в заголовки авторизации. Расширение схемы БД семьи полем `recovery_code` с API сброса пароля и модальным окном. Модуль биометрической аутентификации WebAuthn/localStorage с кнопкой на странице входа и переключателем в настройках. Сервис браузерных push-уведомлений с анти-спам фильтрацией и привязкой к предупреждениям движка сна.

**Tech Stack:** TypeScript, React 18, SQLite (better-sqlite3), bcryptjs, WebAuthn API, Web Notifications API, Vitest.

## Global Constraints

- Стиль и палитра: Bento Natural Design System (зеленый мох `#23372A`, лайм `#D4F27A`, слоновая кость `#ECEEE6`, контрастный текст `#1E2A20` / `#F1F4EA`).
- Поддержка светлой и темной тем для всех новых компонентов.
- Безопасность: пароли хэшируются через bcrypt, кодовое слово нормализуется (case-insensitive trim).
- Неразрывное сохранение 100% прохождения существующих тестов (`npm test`).

---

### Task 1: Logo & PWA Icons Integration and Auth Screens Branding

**Files:**
- Create/Copy: `client/public/logo.svg`, `client/public/icon.svg`, `client/public/favicon.svg`
- Modify: `client/public/manifest.json`
- Modify: `client/index.html`
- Modify: `client/src/pages/LoginPage.tsx`
- Modify: `client/src/pages/RegisterPage.tsx`
- Test: `client/src/tests/auth.test.tsx`

**Interfaces:**
- Assets: `logo/logo.svg` copied to `client/public/`.
- UI:
  * Top bar strip `<div data-testid="brand-top-strip">...My little sun...</div>` placed above the Bento grid on `LoginPage` and `RegisterPage`.
  * Dark Bento Card (`gridColumn: 'span 2'`) displays the vector logo `<img src="/logo.svg" alt="My little son" ... />` with subtitle «режим сна малыша для всей семьи».

- [ ] **Step 1: Write failing tests for top strip and logo in LoginPage and RegisterPage**

In `client/src/tests/auth.test.tsx`:
- Test that `LoginPage` renders `data-testid="brand-top-strip"` containing "My little sun".
- Test that `LoginPage` renders `data-testid="auth-logo-img"` pointing to `/logo.svg`.
- Test that `RegisterPage` renders `data-testid="brand-top-strip"` and logo.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/tests/auth.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Copy logo assets and update manifest/index.html**

- Copy `logo/logo.svg` to:
  * `client/public/logo.svg`
  * `client/public/icon.svg`
  * `client/public/favicon.svg`
- In `client/index.html`: ensure `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` and `<link rel="apple-touch-icon" href="/icon.svg" />`.
- In `client/public/manifest.json`: update name "My little son" and icon references.

- [ ] **Step 4: Update `LoginPage.tsx` and `RegisterPage.tsx`**

- In `LoginPage.tsx`:
  * Add top banner:
    ```tsx
    <div
      data-testid="brand-top-strip"
      style={{
        backgroundColor: 'var(--color-dark, #23372A)',
        color: 'var(--color-lime, #D4F27A)',
        borderRadius: '18px',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: '15px',
        letterSpacing: '1px',
        textTransform: 'uppercase',
      }}
    >
      My little sun
    </div>
    ```
  * In the main 2-column Bento card, replace plain text with:
    ```tsx
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <img
        src="/logo.svg"
        alt="My little son"
        data-testid="auth-logo-img"
        style={{ width: '64px', height: '64px', borderRadius: '16px', objectFit: 'contain' }}
      />
      <div>
        <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
          My little son
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted, #B7C4B4)', marginTop: '4px' }}>
          режим сна малыша для всей семьи
        </div>
      </div>
    </div>
    ```
- In `RegisterPage.tsx`:
  * Apply identical top strip and logo header card.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run client/src/tests/auth.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit changes**

```bash
git add client/public/ client/index.html client/src/pages/LoginPage.tsx client/src/pages/RegisterPage.tsx client/src/tests/auth.test.tsx
git commit -m "feat(branding): add target logo, pwa favicon, and top brand strip to auth pages"
```

---

### Task 2: Family Secret Word & Password Recovery Flow

**Files:**
- Modify: `server/src/db/schema.sql`
- Modify: `server/src/db/database.ts`
- Modify: `server/src/services/authService.ts`
- Modify: `server/src/routes/authRoutes.ts`
- Modify: `client/src/api/authApi.ts`
- Create: `client/src/components/modals/PasswordResetModal.tsx`
- Modify: `client/src/pages/RegisterPage.tsx`
- Modify: `client/src/pages/LoginPage.tsx`
- Test: `server/src/tests/api.test.ts`, `client/src/tests/auth.test.tsx`

**Interfaces:**
- DB: `families.recovery_code TEXT`
- Server API:
  `POST /api/auth/reset-password`: `{ email: string, recoveryCode: string, newPassword: string } => { success: boolean; message: string }`
- Client API:
  `resetPasswordApi(data: ResetPasswordInput): Promise<{ success: boolean; message: string }>`
- UI:
  * In `RegisterPage.tsx`: Input «Кодовое слово семьи» + explanation badge.
  * In `LoginPage.tsx`: Clicking «Забыли пароль?» opens `PasswordResetModal`.

- [ ] **Step 1: Write failing tests for password reset API and recovery code registration**

In `server/src/tests/api.test.ts`:
- Test registration stores `recoveryCode`.
- Test `POST /api/auth/reset-password` succeeds with correct email and recovery code.
- Test `POST /api/auth/reset-password` fails with wrong recovery code (400).
- Test `POST /api/auth/reset-password` fails with nonexistent email (404).

- [ ] **Step 2: Run server test to verify it fails**

Run: `npx vitest run server/src/tests/api.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement database and backend logic**

- In `server/src/db/schema.sql`:
  Add `recovery_code TEXT` to `families`.
- In `server/src/db/database.ts`:
  In `initDatabase`, run migration `ALTER TABLE families ADD COLUMN recovery_code TEXT;` if column doesn't exist. Update seed data with default recovery code `'солнышко'`.
- In `server/src/services/authService.ts`:
  Update `register()` to store `recoveryCode` on family.
  Implement `resetPassword(email, recoveryCode, newPassword)`.
- In `server/src/routes/authRoutes.ts`:
  Add `POST /api/auth/reset-password`.

- [ ] **Step 4: Create PasswordResetModal and integrate in client**

- Create `client/src/components/modals/PasswordResetModal.tsx`:
  * Slide-up bottom sheet with backdrop.
  * Inputs: Email, Кодовое слово семьи, Новый пароль.
  * Call `resetPasswordApi`.
  * Success message with «Войти с новым паролем».
- In `RegisterPage.tsx`:
  * Add «Кодовое слово» input with notice: *«Используется для восстановления доступа. Обязательно запомните его — без него восстановить пароль будет невозможно.»*
  * Pass `recoveryCode` to `registerApi`.
- In `LoginPage.tsx`:
  * Open `PasswordResetModal` when clicking «Забыли пароль?».

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run server/src/tests/api.test.ts client/src/tests/auth.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit changes**

```bash
git add server/src/ client/src/
git commit -m "feat(auth): implement family recovery code and password reset flow"
```

---

### Task 3: Biometric Authentication (Login & Settings)

**Files:**
- Create: `client/src/utils/biometrics.ts`
- Modify: `client/src/pages/LoginPage.tsx`
- Modify: `client/src/pages/SettingsPage.tsx`
- Test: `client/src/tests/auth.test.tsx`, `client/src/tests/settings.test.tsx`

**Interfaces:**
- `biometrics.ts`:
  * `isBiometricsAvailable(): Promise<boolean>`
  * `hasSavedBiometrics(): boolean`
  * `registerBiometrics(user: AuthUser, token: string): Promise<boolean>`
  * `authenticateWithBiometrics(): Promise<{ token: string; user: AuthUser } | null>`
  * `disableBiometrics(): void`
- UI:
  * `LoginPage`: 56×56px square button with fingerprint/FaceID icon next to «Войти».
  * `SettingsPage`: Section «Безопасность» with toggle «Вход по биометрии (Face ID / отпечаток)».

- [ ] **Step 1: Write failing tests for biometrics helpers and UI triggers**

- In `client/src/tests/auth.test.tsx`:
  * Test that `LoginPage` renders biometric login button `[data-testid="biometric-login-btn"]`.
  * Test clicking biometric button invokes biometric authentication and logs in user when saved credentials exist.
- In `client/src/tests/settings.test.tsx`:
  * Test that `SettingsPage` renders biometric setup card `[data-testid="biometrics-settings-card"]`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run client/src/tests/auth.test.tsx client/src/tests/settings.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `client/src/utils/biometrics.ts`**

- Use WebAuthn credentials when available, with resilient fallback using securely stored credentials in localStorage for local development / testing.
- Export all required methods.

- [ ] **Step 4: Integrate biometrics on `LoginPage.tsx` and `SettingsPage.tsx`**

- On `LoginPage.tsx`:
  * Next to `<button type="submit">Войти</button>`, add:
    ```tsx
    <button
      type="button"
      data-testid="biometric-login-btn"
      onClick={handleBiometricLogin}
      aria-label="Войти по биометрии"
      style={{
        width: '56px',
        height: '56px',
        borderRadius: '20px',
        backgroundColor: 'var(--color-white, #FFFFFF)',
        border: '1px solid var(--color-border, #E3E7DA)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <BiometricIcon />
    </button>
    ```
- On `SettingsPage.tsx`:
  * Add Bento card «Безопасность» with toggle switch «Вход по Face ID / отпечатку».

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run client/src/tests/auth.test.tsx client/src/tests/settings.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit changes**

```bash
git add client/src/utils/biometrics.ts client/src/pages/LoginPage.tsx client/src/pages/SettingsPage.tsx client/src/tests/
git commit -m "feat(auth): implement biometric login and settings management"
```

---

### Task 4: Push Notifications & Smart Warnings Integration

**Files:**
- Create: `client/src/services/pushNotificationService.ts`
- Modify: `client/src/pages/SettingsPage.tsx`
- Modify: `client/src/App.tsx`
- Test: `client/src/tests/settings.test.tsx`, `client/src/tests/notifications.test.ts`

**Interfaces:**
- `pushNotificationService.ts`:
  * `requestNotificationPermission(): Promise<NotificationPermission>`
  * `isPushNotificationsEnabled(): boolean`
  * `setPushNotificationsEnabled(enabled: boolean): void`
  * `checkAndDispatchScheduleNotifications(status: DayStatusResponse): void`
- Triggers:
  * "Пора спать": when awake duration approaches window or countdown is <= 0.
  * "Пора будить": when wake deadline exceeded or `ABNORMALLY_LONG_NAP`.
  * Active smart warnings: `OVERTIRED`, `DAY_BUDGET_EXHAUSTED`, `FORGOTTEN_WAKEUP_TIMER`.
  * 15-minute debounce/anti-spam per warning code.

- [ ] **Step 1: Write failing unit tests for push notification service**

Create `client/src/tests/notifications.test.ts`:
- Test permission request and storage toggle.
- Test dispatching notification for overtired and wake deadline exceeded.
- Test 15-minute anti-spam throttle prevents duplicate sends.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/tests/notifications.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `client/src/services/pushNotificationService.ts`**

- Check `Notification.permission === 'granted'`.
- Build message payload with title, body, and icon `/icon.svg`.
- Anti-spam map: `lastNotifiedMap = new Map<string, number>()`.
- Export service functions.

- [ ] **Step 4: Integrate in SettingsPage and App.tsx**

- In `SettingsPage.tsx`:
  * Add Bento card «Уведомления»:
    Toggle «Push-уведомления» with explanation *«Напоминания о приближении сна, времени пробуждения и предупреждениях о перегуле»*.
- In `App.tsx`:
  * In status change listener / useEffect, call `checkAndDispatchScheduleNotifications(status)`.

- [ ] **Step 5: Run full test suite and build verification**

Run: `npm test`
Expected: 100% pass across all test suites (> 215 tests).
Run: `npm run build`
Expected: 0 errors across server and client.

- [ ] **Step 6: Commit changes**

```bash
git add client/src/services/pushNotificationService.ts client/src/pages/SettingsPage.tsx client/src/App.tsx client/src/tests/
git commit -m "feat(notifications): add push notifications for sleep milestones and smart warnings"
```
