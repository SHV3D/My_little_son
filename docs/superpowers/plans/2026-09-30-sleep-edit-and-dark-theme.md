# Редактирование записей о сне и Тёмная тема — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить возможность редактирования записей о сне с пересчетом расписания и WebSocket-синхронизацией, а также полноценную тёмную тему с сохранением настроек и быстрым переключателем.

**Architecture:** На бэкенде добавляется сервис и `PUT` эндпоинт для обновления событий сна с рассылкой WebSocket `SLEEP_STATUS_CHANGED`. На фронтенде создается шторка `EditSleepModal`, интегрируемая в списки событий на экранах «Сегодня» и «Календарь». Для тёмной темы вводятся CSS-переменные темы в `theme.css`, хук `useTheme` с `localStorage` и поддержкой системной темы, а также кнопка быстрого переключения в `Header` и блок в «Настройках».

**Tech Stack:** React 19, TypeScript, Express, SQLite (better-sqlite3), WebSocket (ws), CSS Variables, Vitest.

## Global Constraints

- Сохранять строгую визуальную гармонию Bento Natural и шрифт `Geologica`.
- Тёмная тема использует природные глубокие оттенки (`#142017`, `#223427`, `#1A281E`, `#F1F4EA`, `#D4F27A`), без кислотных цветов и без резкого чисто чёрного `#000000`.
- Все существующие 135 тестов должны продолжать успешно проходить без регрессий.
- Все команды PowerShell на Windows выполняются без недопустимых синтаксических конструкций (использовать `;` вместо `&&`).

---

### Task 1: Backend Update Sleep Event API & WebSocket Broadcast

**Files:**
- Modify: `server/src/services/sleepService.ts`
- Modify: `server/src/routes/sleepRoutes.ts`
- Test: `server/src/tests/api.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface UpdateSleepEventInput {
    eventType?: 'WAKEUP' | 'NAP' | 'NIGHT_SLEEP';
    startTime?: string;
    endTime?: string | null;
    napNumber?: number | null;
    date?: string;
  }
  export function updateSleepEvent(
    eventId: string,
    childId: string,
    input: UpdateSleepEventInput
  ): { event: FormattedSleepEvent; status: DayStatusResponse };
  ```
- Endpoint: `PUT /api/sleep/events/:id` -> 200 OK with `{ event, status }` and broadcasts `SLEEP_STATUS_CHANGED` (`action: 'UPDATE_EVENT'`).

- [ ] **Step 1: Write integration tests for updating sleep events**

In `server/src/tests/api.test.ts`, add test cases for `PUT /api/sleep/events/:id`:
```typescript
  it('PUT /api/sleep/events/:id updates start and end time and recalculates status', async () => {
    // 1. Get current status to find an event ID
    const statusRes = await request(app).get('/api/sleep/status?childId=demo-child-1');
    expect(statusRes.status).toBe(200);
    const nap = statusRes.body.events.find((e: any) => e.eventType === 'NAP' && e.endTime);
    expect(nap).toBeDefined();

    // 2. Update the event
    const updateRes = await request(app)
      .put(`/api/sleep/events/${nap.id}`)
      .send({
        startTime: '10:00',
        endTime: '11:30',
        eventType: 'NAP',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.event).toBeDefined();
    expect(updateRes.body.event.durationMinutes).toBe(90);
    expect(updateRes.body.event.formattedDuration).toContain('1:30');
    expect(updateRes.body.status).toBeDefined();
  });

  it('PUT /api/sleep/events/:id returns 404 for nonexistent event', async () => {
    const res = await request(app)
      .put('/api/sleep/events/nonexistent-id')
      .send({ startTime: '10:00' });
    expect(res.status).toBe(404);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/src/tests/api.test.ts`  
Expected: FAIL with 404 on `PUT /api/sleep/events/:id` (route not implemented).

- [ ] **Step 3: Implement `updateSleepEvent` in `sleepService.ts` and route in `sleepRoutes.ts`**

In `server/src/services/sleepService.ts`:
```typescript
export interface UpdateSleepEventInput {
  eventType?: 'WAKEUP' | 'NAP' | 'NIGHT_SLEEP';
  startTime?: string;
  endTime?: string | null;
  napNumber?: number | null;
  date?: string;
}

export function updateSleepEvent(
  eventId: string,
  childId: string,
  input: UpdateSleepEventInput
): { event: FormattedSleepEvent; status: DayStatusResponse } {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM sleep_events WHERE id = ? AND child_id = ?').get(eventId, childId) as DbSleepEvent | undefined;
  if (!existing) {
    throw new Error('Запись о сне не найдена');
  }

  const effectiveDate = input.date || existing.date;
  const effectiveType = input.eventType || existing.event_type;
  const effectiveStartIso = input.startTime ? normalizeToIso(effectiveDate, input.startTime) : existing.start_time;

  let effectiveEndIso: string | null = existing.end_time;
  if (input.endTime !== undefined) {
    effectiveEndIso = input.endTime ? normalizeToIso(effectiveDate, input.endTime) : null;
  }

  let durationMinutes: number | null = null;
  if (effectiveEndIso) {
    const startMin = parseTimeToMinutes(effectiveStartIso);
    const endMin = parseTimeToMinutes(effectiveEndIso);
    let diff = endMin - startMin;
    if (diff < 0) diff += 1440;
    durationMinutes = diff;
  }

  const napNumber = input.napNumber !== undefined ? input.napNumber : existing.nap_number;

  db.prepare(`
    UPDATE sleep_events
    SET date = ?,
        event_type = ?,
        start_time = ?,
        end_time = ?,
        duration_minutes = ?,
        nap_number = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND child_id = ?
  `).run(effectiveDate, effectiveType, effectiveStartIso, effectiveEndIso, durationMinutes, napNumber, eventId, childId);

  const updatedRaw = db.prepare('SELECT * FROM sleep_events WHERE id = ?').get(eventId) as DbSleepEvent;
  const formatted = formatEventForUi(updatedRaw);
  const status = getDayStatus(childId, effectiveDate);

  return { event: formatted, status };
}
```

In `server/src/routes/sleepRoutes.ts`:
Add `updateSleepEvent` to imports from `../services/sleepService`.
Add route:
```typescript
router.put('/events/:id', (req: Request, res: Response) => {
  try {
    const childId = (req.query.childId as string) || req.user?.childId || 'demo-child-1';
    const eventId = req.params.id;
    const result = updateSleepEvent(eventId, childId, {
      eventType: req.body.eventType,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      napNumber: req.body.napNumber,
      date: req.body.date,
    });

    const familyId = req.user?.familyId || getFamilyIdForChild(childId);
    if (familyId) {
      broadcastToFamily(familyId, {
        type: 'SLEEP_STATUS_CHANGED',
        payload: {
          childId,
          eventId,
          action: 'UPDATE_EVENT',
          timestamp: new Date().toISOString(),
          result,
        },
      });
    }

    res.json(result);
  } catch (err: any) {
    const status = err.message === 'Запись о сне не найдена' ? 404 : 400;
    res.status(status).json({ error: err.message || 'Ошибка обновления записи' });
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/src/tests/api.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add server/src/services/sleepService.ts server/src/routes/sleepRoutes.ts server/src/tests/api.test.ts
git commit -m "feat(api): add PUT /api/sleep/events/:id endpoint with WebSocket broadcast"
```

---

### Task 2: Client Sleep API & Edit Modal (`EditSleepModal.tsx`)

**Files:**
- Modify: `client/src/api/sleepApi.ts`
- Create: `client/src/components/modals/EditSleepModal.tsx`
- Test: `client/src/tests/modals.test.tsx`

**Interfaces:**
- Produces:
  ```typescript
  export async function updateSleepEventApi(
    eventId: string,
    data: UpdateSleepEventInput,
    childId?: string
  ): Promise<{ event: FormattedSleepEvent; status: DayStatusResponse }>;
  ```
  and `EditSleepModal` component.

- [ ] **Step 1: Write component tests for `EditSleepModal`**

In `client/src/tests/modals.test.tsx`, add tests:
```tsx
import { EditSleepModal } from '../components/modals/EditSleepModal';

describe('EditSleepModal', () => {
  const mockEvent = {
    id: 'ev-test-1',
    title: 'Сон 1 · 1:15',
    author: 'Мама',
    time: '09:40 – 10:55',
    eventType: 'NAP' as const,
    startTime: '09:40',
    endTime: '10:55',
    date: '2026-09-30',
  };

  it('renders modal with event values when open', () => {
    render(
      <EditSleepModal
        isOpen={true}
        event={mockEvent}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByTestId('edit-sleep-modal')).toBeInTheDocument();
    expect(screen.getByTestId('edit-sleep-title')).toHaveTextContent('Редактировать запись');
    expect(screen.getByDisplayValue('09:40')).toBeInTheDocument();
    expect(screen.getByDisplayValue('10:55')).toBeInTheDocument();
  });

  it('submits updated values on Save click', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(
      <EditSleepModal
        isOpen={true}
        event={mockEvent}
        onClose={vi.fn()}
        onSave={handleSave}
        onDelete={vi.fn()}
      />
    );

    const saveBtn = screen.getByTestId('edit-sleep-save-btn');
    fireEvent.click(saveBtn);
    expect(handleSave).toHaveBeenCalledWith('ev-test-1', expect.objectContaining({
      eventType: 'NAP',
      startTime: '09:40',
      endTime: '10:55',
    }));
  });

  it('requires two-step confirmation to delete', async () => {
    const handleDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <EditSleepModal
        isOpen={true}
        event={mockEvent}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={handleDelete}
      />
    );

    const deleteBtn = screen.getByTestId('edit-sleep-delete-btn');
    expect(deleteBtn).toHaveTextContent('Удалить запись');
    fireEvent.click(deleteBtn);

    // Second click should be confirmation
    expect(screen.getByTestId('edit-sleep-delete-btn')).toHaveTextContent('Точно удалить?');
    fireEvent.click(screen.getByTestId('edit-sleep-delete-btn'));
    expect(handleDelete).toHaveBeenCalledWith('ev-test-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/tests/modals.test.tsx`  
Expected: FAIL (Cannot find module `../components/modals/EditSleepModal`).

- [ ] **Step 3: Implement client API and `EditSleepModal.tsx`**

In `client/src/api/sleepApi.ts`:
Add `updateSleepEventApi`:
```typescript
export interface UpdateSleepEventInput {
  eventType?: 'WAKEUP' | 'NAP' | 'NIGHT_SLEEP';
  startTime?: string;
  endTime?: string | null;
  napNumber?: number | null;
  date?: string;
}

export async function updateSleepEventApi(
  eventId: string,
  data: UpdateSleepEventInput,
  childId?: string
): Promise<{ event: FormattedSleepEvent; status: DayStatusResponse }> {
  const query = childId ? `?childId=${encodeURIComponent(childId)}` : '';
  const resp = await fetch(`/api/sleep/events/${eventId}${query}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка обновления записи');
  }
  return resp.json();
}
```

Create `client/src/components/modals/EditSleepModal.tsx` matching Bento Natural styling with:
- Drag pill and backdrop dismiss
- Close button ✕
- Event type pills: «Подъём», «Дневной сон», «Ночной сон»
- Start time and End time inputs with live duration preview
- Ongoing sleep toggle: «Сон ещё идёт»
- Primary save button «Сохранить изменения»
- Two-step delete button «Удалить запись» → «Точно удалить?»

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/tests/modals.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add client/src/api/sleepApi.ts client/src/components/modals/EditSleepModal.tsx client/src/tests/modals.test.tsx
git commit -m "feat(ui): add EditSleepModal component and updateSleepEventApi client method"
```

---

### Task 3: Integration of Edit Modal into Screens (Today & Calendar)

**Files:**
- Modify: `client/src/pages/TodayAwakePage.tsx`
- Modify: `client/src/pages/TodaySleepingPage.tsx`
- Modify: `client/src/components/calendar/DayDetailCard.tsx`
- Modify: `client/src/pages/CalendarPage.tsx`
- Modify: `client/src/App.tsx`
- Test: `client/src/tests/todaySleeping.test.tsx`
- Test: `client/src/tests/calendar.test.tsx`

**Interfaces:**
- `DayLogsList` -> `onRecordClick: (record: DayLogRecord) => void`
- `DayDetailCard` -> event row clicks trigger `onRecordClick?: (event: FormattedSleepEvent | any) => void` or `onEditClick`
- `App.tsx` handles `editingEvent` state and renders `EditSleepModal`.

- [ ] **Step 1: Write integration tests for opening edit modal from Today and Calendar**

In `client/src/tests/todaySleeping.test.tsx`:
Test clicking a record item in `DayLogsList` triggers `onRecordClick`.

In `client/src/tests/calendar.test.tsx`:
Test clicking an event row in `DayDetailCard` triggers edit modal callback.

- [ ] **Step 2: Connect `onRecordClick` in `TodayAwakePage`, `TodaySleepingPage`, `DayDetailCard`, and `CalendarPage`**

- In `TodayAwakePage.tsx` and `TodaySleepingPage.tsx`:
  Pass `onRecordClick={(record) => onEditRecord?.(record)}` to `DayLogsList`.
- In `DayDetailCard.tsx`:
  Make event rows clickable with `onClick={() => onEventClick?.(item)}` or `cursor: pointer`.
- In `CalendarPage.tsx`:
  Add `onEventClick` prop to `DayDetailCard` and connect to `onEditRecord`.
- In `App.tsx`:
  - Manage state: `editingEvent: any | null` and `isEditModalOpen: boolean`.
  - Implement `handleSaveEdit(eventId, data)` calling `updateSleepEventApi`.
  - Implement `handleDeleteEdit(eventId)` calling `deleteSleepEventApi`.
  - Render `<EditSleepModal ... />` globally.

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run client/src/tests/`  
Expected: All tests PASS.

- [ ] **Step 4: Commit Task 3**

```bash
git add client/src/pages/TodayAwakePage.tsx client/src/pages/TodaySleepingPage.tsx client/src/components/calendar/DayDetailCard.tsx client/src/pages/CalendarPage.tsx client/src/App.tsx client/src/tests/
git commit -m "feat(ui): integrate EditSleepModal into Today and Calendar screens"
```

---

### Task 4: Dark Theme CSS Tokens, `useTheme` Hook & Header/Settings Controls

**Files:**
- Modify: `client/src/styles/theme.css`
- Create: `client/src/hooks/useTheme.ts`
- Modify: `client/src/components/common/Header.tsx`
- Modify: `client/src/pages/SettingsPage.tsx`
- Test: `client/src/tests/theme.test.tsx`
- Modify: `client/src/tests/bento.test.tsx`

**Interfaces:**
- Produces:
  ```typescript
  export type ThemeMode = 'light' | 'dark' | 'system';
  export function useTheme(): {
    theme: ThemeMode;
    resolvedTheme: 'light' | 'dark';
    setTheme: (mode: ThemeMode) => void;
    toggleTheme: () => void;
  };
  ```

- [ ] **Step 1: Write tests for `useTheme` and Header theme toggle**

Create `client/src/tests/theme.test.tsx`:
```tsx
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../hooks/useTheme';

describe('useTheme hook', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to system or light theme and applies data-theme attribute', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('system');
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
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/tests/theme.test.tsx`  
Expected: FAIL (Cannot find module `../hooks/useTheme`).

- [ ] **Step 3: Implement CSS variables in `theme.css` and `useTheme.ts`**

In `client/src/styles/theme.css`, add `[data-theme="dark"]` rules:
```css
[data-theme="dark"] {
  --bg-primary: #142017;
  --color-white: #223427;
  --color-dark: #1A281E;
  --color-neutral-bg: #1B291F;
  --color-border: #2C3F30;
  --text-primary: #F1F4EA;
  --text-muted: #A6B8A5;
  --text-subtle: #70846F;
  --color-lime: #D4F27A;
  --color-dark-secondary: #273D2C;
  --color-light-sage: #283A2D;
  --color-bar-inactive: #3B4E3E;
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.25);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.35);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.45);
  --shadow-mobile: 0 16px 40px rgba(0, 0, 0, 0.6);
}

[data-theme="dark"] body {
  background-color: #0E1711;
}
```

Create `client/src/hooks/useTheme.ts` supporting `'light' | 'dark' | 'system'`.

- [ ] **Step 4: Update `Header.tsx` and `SettingsPage.tsx` with theme controls**

- In `Header.tsx`:
  Add `theme?: 'light' | 'dark'`, `onToggleTheme?: () => void`.
  Render round button with Sun icon (if dark) or Moon icon (if light).
- In `SettingsPage.tsx`:
  Add Bento Card "Оформление" with 3 buttons: «Светлая», «Тёмная», «Системная».

- [ ] **Step 5: Run tests to verify all tests pass**

Run: `npx vitest run client/src/tests/theme.test.tsx`  
Run: `npm test`  
Expected: All tests PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add client/src/styles/theme.css client/src/hooks/useTheme.ts client/src/components/common/Header.tsx client/src/pages/SettingsPage.tsx client/src/tests/theme.test.tsx client/src/tests/bento.test.tsx
git commit -m "feat(theme): add dark theme tokens, useTheme hook, and header/settings controls"
```

---

### Task 5: End-to-End Verification & Production Build

- [ ] **Step 1: Run complete test suite**

Run: `npm test`  
Expected: All test suites PASS (135+ tests).

- [ ] **Step 2: Run production TypeScript and Vite build**

Run: `npm run build`  
Expected: Build succeeds with 0 errors and 0 warnings.

- [ ] **Step 3: Verification of dev servers and UI rendering**

Ensure background task `task-563` (`npm run dev`) serves both themes and editing modal cleanly on `http://localhost:3000`.

- [ ] **Step 4: Final commit**

```bash
git commit --allow-empty -m "chore: verify sleep record editing and dark theme implementation"
```
