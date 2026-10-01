# Smart Sleep Warnings System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать умную систему из 9 предупреждений и рекомендаций по сну ребенка в Bento Natural дизайне с инлайн-валидацией коллизий и бейджами в Hero-карточках.

**Architecture:** Чистые математические функции оценки предупреждений и валидации коллизий в `shared/sleepEngine.ts`, возвращающие типизированный массив `SleepWarning[]` в `ScheduleOutput`. Bento-компонент `WarningBanner.tsx` с поддержкой светлой/темной темы, Hero-бейджи на экранах бодрствования/сна и инлайн-проверка коллизий в модальных окнах ввода.

**Tech Stack:** TypeScript, React 18, Vite, Vitest, CSS Variables (Bento Natural Palette).

## Global Constraints

- Поддержка всех 9 предупреждений из спецификации (`OVERTIRED`, `UNDERTIRED`, `DAY_BUDGET_EXHAUSTED`, `ABNORMALLY_LONG_NAP`, `SEVERE_DAY_DEFICIT`, `LATE_NAP_BEDTIME_SHIFT`, `FALSE_NIGHT_SLEEP`, `FORGOTTEN_WAKEUP_TIMER`, `EVENT_TIME_COLLISION`).
- Соответствие Bento Natural Design System: мягкие скругления (16-24px), спокойные природные тона (терракота для alert, теплый мед для warning, шалфей/лайм для info), отсутствие резких агрессивных рамок.
- 100% адаптация под светлую и темную темы через CSS-переменные.
- Неразрывная обратная совместимость существующих тестов расписания.

---

### Task 1: Sleep Engine Warning & Collision Logic with Unit Tests

**Files:**
- Modify: `shared/sleepEngine.ts`
- Test: `shared/sleepEngine.test.ts`

**Interfaces:**
- Consumes: `ScheduleOutput`, `ChildSettings`, `SleepEvent`, `BabyState`.
- Produces:
  ```typescript
  export type SleepWarningCode =
    | 'OVERTIRED'
    | 'UNDERTIRED'
    | 'DAY_BUDGET_EXHAUSTED'
    | 'ABNORMALLY_LONG_NAP'
    | 'SEVERE_DAY_DEFICIT'
    | 'LATE_NAP_BEDTIME_SHIFT'
    | 'FALSE_NIGHT_SLEEP'
    | 'FORGOTTEN_WAKEUP_TIMER'
    | 'EVENT_TIME_COLLISION';

  export type WarningSeverity = 'info' | 'warning' | 'alert';

  export interface SleepWarning {
    code: SleepWarningCode;
    severity: WarningSeverity;
    title: string;
    message: string;
    actionRecommendation?: string;
    actionType?: 'WAKE_NOW' | 'EARLY_BEDTIME' | 'SHORT_BRIDGE_NAP' | 'SET_WAKE_TIME' | 'CHECK_TIME';
  }

  export function evaluateSleepWarnings(
    schedule: ScheduleOutput,
    settings: ChildSettings,
    events: SleepEvent[],
    currentTime: string
  ): SleepWarning[];

  export function validateEventCollision(
    events: SleepEvent[],
    event: { id?: string; startTime: string; endTime?: string | null; eventType?: SleepEventType; date?: string },
    currentTime?: string
  ): { hasCollision: boolean; message?: string; conflictingEvent?: SleepEvent };
  ```

- [ ] **Step 1: Write failing unit tests for all 9 warnings and collision detection**

In `shared/sleepEngine.test.ts`, add test suite `describe('Smart Sleep Warnings System', () => { ... })`:
- Test 1: `OVERTIRED`: Triggers when awake duration exceeds `wakeIntervalMaxMinutes + 15` min.
- Test 2: `UNDERTIRED`: Triggers when awake duration is < 60% of `wakeIntervalMinMinutes`.
- Test 3: `DAY_BUDGET_EXHAUSTED`: Triggers when completed day sleep reaches target sleep and daytime naps remain.
- Test 4: `ABNORMALLY_LONG_NAP`: Triggers when active nap exceeds wake deadline by > 10 min or exceeds 135 min.
- Test 5: `SEVERE_DAY_DEFICIT`: Triggers when all naps completed but total daytime sleep is < 65% of target.
- Test 6: `LATE_NAP_BEDTIME_SHIFT`: Triggers when bedtime is shifted by >= 30 min from target.
- Test 7: `FALSE_NIGHT_SLEEP`: Triggers when night sleep starts before 18:30 or 3rd/4th evening nap starts after 18:30 and exceeds 35 min.
- Test 8: `FORGOTTEN_WAKEUP_TIMER`: Triggers when daytime nap exceeds 210 min (3.5h) or night sleep is active after 09:30.
- Test 9: `EVENT_TIME_COLLISION`: `validateEventCollision` detects overlapping events, start > end, and events in the future.
- Test 10: Sort order by severity: `alert` first, then `warning`, then `info`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/sleepEngine.test.ts`
Expected: FAIL (functions and types not found).

- [ ] **Step 3: Implement warning evaluation and collision validation in `shared/sleepEngine.ts`**

Add types, implement `evaluateSleepWarnings` and `validateEventCollision`, and call `evaluateSleepWarnings` at the end of `calculateDaySchedule` to populate `schedule.warnings`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run shared/sleepEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add shared/sleepEngine.ts shared/sleepEngine.test.ts
git commit -m "feat(engine): implement smart sleep warnings evaluation and collision detection"
```

---

### Task 2: Bento Warning Banner Component (`WarningBanner.tsx`)

**Files:**
- Create: `client/src/components/common/WarningBanner.tsx`
- Test: `client/src/tests/warnings.test.tsx`

**Interfaces:**
- Consumes: `SleepWarning`, `SleepWarningCode`, `WarningSeverity`.
- Produces:
  ```typescript
  export interface WarningBannerProps {
    warnings?: SleepWarning[];
    onAction?: (warning: SleepWarning) => void;
    onDismiss?: (code: SleepWarningCode) => void;
    className?: string;
    style?: React.CSSProperties;
  }
  export const WarningBanner: React.FC<WarningBannerProps>;
  ```

- [ ] **Step 1: Write failing component tests for WarningBanner**

In `client/src/tests/warnings.test.tsx`:
- Test renders nothing when `warnings` is empty or undefined.
- Test renders alert card with correct title, message, and action button.
- Test renders warning card with warm honey styling and recommendation.
- Test renders info card with sage styling.
- Test clicking action button invokes `onAction(warning)`.
- Test clicking close button invokes `onDismiss(warning.code)`.
- Test cycles through multiple warnings or shows highest severity first.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/tests/warnings.test.tsx`
Expected: FAIL (WarningBanner not found).

- [ ] **Step 3: Implement `WarningBanner.tsx`**

- Container: Bento card with border radius `20px`, padding `14px 16px`, backdrop blur.
- Styling tokens:
  * `alert`: background `var(--warning-alert-bg, rgba(234, 163, 146, 0.14))`, border `1px solid var(--warning-alert-border, #EAA392)`, text `var(--warning-alert-text, #78291B)`. Dark theme: soft luminous terracotta.
  * `warning`: background `var(--warning-warn-bg, rgba(228, 192, 120, 0.16))`, border `1px solid var(--warning-warn-border, #E4C078)`, text `var(--warning-warn-text, #6C4E13)`. Dark theme: warm amber glow.
  * `info`: background `var(--warning-info-bg, rgba(212, 242, 122, 0.16))`, border `1px solid var(--warning-info-border, #C4DCA0)`, text `var(--warning-info-text, #2A4833)`.
- Header row with icon badge, title (15px/600), and dismiss button `✕` (`aria-label="Закрыть"`).
- Body: message (13px/400) with clear numbers.
- Recommendation action chip/button if `actionRecommendation` is present.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/tests/warnings.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add client/src/components/common/WarningBanner.tsx client/src/tests/warnings.test.tsx client/src/styles/theme.css
git commit -m "feat(ui): add Bento WarningBanner component with severity styles and action callbacks"
```

---

### Task 3: Hero Card Badges & Modals Collision Validation

**Files:**
- Modify: `client/src/components/today/AwakeHeroCard.tsx`
- Modify: `client/src/pages/TodaySleepingPage.tsx`
- Modify: `client/src/components/modals/RetroactiveSleepModal.tsx`
- Modify: `client/src/components/modals/EditSleepModal.tsx`
- Test: `client/src/tests/modals.test.tsx`

**Interfaces:**
- Consumes: `validateEventCollision`, `SleepWarning`.
- Produces: Visual hero badges on awake/sleeping screens and instant collision error banner in modals.

- [ ] **Step 1: Write failing tests for collision validation in modals**

In `client/src/tests/modals.test.tsx`:
- Test `RetroactiveSleepModal`: Entering a time interval that overlaps with an existing event displays collision warning badge and prevents saving.
- Test `EditSleepModal`: Entering an end time before start time displays invalid interval warning.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/tests/modals.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement validation in modals and Hero badge adaptations**

- In `RetroactiveSleepModal.tsx`:
  * Accept optional `existingEvents?: SleepEvent[]`.
  * Compute `collision = validateEventCollision(existingEvents, { startTime, endTime, eventType })`.
  * Show friendly inline collision warning box if collision detected.
  * Disable save button if collision or invalid time range.
- In `EditSleepModal.tsx`:
  * Accept optional `existingEvents?: SleepEvent[]`.
  * Compute `collision = validateEventCollision(existingEvents, { id: event.id, startTime, endTime, eventType })`.
  * Show friendly collision box if detected.
- In `AwakeHeroCard.tsx`:
  * If `isOvertired` or overtired warning present, render amber/terracotta badge «Перегул +X мин» next to or below awake timer.
- In `TodaySleepingPage.tsx`:
  * If `wakeDeadlineExceeded` or abnormally long nap, highlight timer area with «Пора будить».

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/tests/modals.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add client/src/components/modals/RetroactiveSleepModal.tsx client/src/components/modals/EditSleepModal.tsx client/src/components/today/AwakeHeroCard.tsx client/src/pages/TodaySleepingPage.tsx client/src/tests/modals.test.tsx
git commit -m "feat(ui): add collision validation to sleep modals and overtired badges to hero cards"
```

---

### Task 4: Screen Integration & End-to-End Verification

**Files:**
- Modify: `client/src/pages/TodayAwakePage.tsx`
- Modify: `client/src/pages/TodaySleepingPage.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/api/sleepApi.ts`
- Test: `client/src/tests/todayAwake.test.tsx`, `client/src/tests/todaySleeping.test.tsx`

**Interfaces:**
- Connects warnings from `DayStatusResponse.schedule.warnings` to `WarningBanner`.
- Dispatches quick actions:
  * `WAKE_NOW`: opens `SleepActionModal(type='WOKE_UP')` or `SleepActionModal(type='FELL_ASLEEP')`.
  * `SET_WAKE_TIME`: opens `SleepActionModal(type='WOKE_UP')`.

- [ ] **Step 1: Write integration tests for WarningBanner on Today screens**

In `client/src/tests/todayAwake.test.tsx` and `client/src/tests/todaySleeping.test.tsx`:
- Test that `TodayAwakePage` renders `WarningBanner` when schedule has warnings.
- Test that dismissing a warning hides it from the screen for the session.
- Test that clicking action button opens appropriate modal or action.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run client/src/tests/todayAwake.test.tsx client/src/tests/todaySleeping.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement screen integration in `TodayAwakePage`, `TodaySleepingPage`, and `App.tsx`**

- In `TodayAwakePage.tsx`:
  * Render `<WarningBanner warnings={activeWarnings} onDismiss={handleDismiss} onAction={handleAction} />` between Hero card and BentoMetricsGrid.
- In `TodaySleepingPage.tsx`:
  * Render `<WarningBanner ... />` below SleepingHeroCard.
- In `App.tsx`:
  * Pass `events` to `RetroactiveSleepModal` and `EditSleepModal` for collision checking.
- Maintain dismissed warning codes in state `dismissedWarnings: Set<SleepWarningCode>`.

- [ ] **Step 4: Run full test suite to verify 100% pass rate**

Run: `npm test`
Expected: All tests pass (>= 175 tests).

- [ ] **Step 5: Run production build check**

Run: `npm run build`
Expected: Build succeeds with 0 TypeScript errors.

- [ ] **Step 6: Commit changes**

```bash
git add client/src/pages/TodayAwakePage.tsx client/src/pages/TodaySleepingPage.tsx client/src/App.tsx client/src/api/sleepApi.ts client/src/tests/
git commit -m "feat(ui): complete screen integration of smart sleep warnings and quick action handlers"
```
