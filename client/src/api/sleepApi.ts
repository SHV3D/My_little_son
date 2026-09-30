import { ScheduleOutput } from '@shared/sleepEngine';

export interface FormattedSleepEvent {
  id: string;
  childId: string;
  date: string;
  eventType: 'WAKEUP' | 'NAP' | 'NIGHT_SLEEP';
  napNumber: number | null;
  startTime: string;
  endTime: string | null;
  formattedStartTime: string;
  formattedEndTime: string | null;
  durationMinutes: number | null;
  formattedDuration: string;
  recordedByUserId: string | null;
  recordedByName: string;
  source: string;
  isOngoing: boolean;
  title: string;
  subtitle: string;
}

export interface DayStatusResponse {
  date: string;
  currentTime: string;
  state: 'AWAKE' | 'SLEEPING';
  schedule: ScheduleOutput;
  events: FormattedSleepEvent[];
  child: {
    id: string;
    name: string;
    birthDate: string | null;
  };
  familyMembers: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

export interface RetroactiveSleepPayload {
  childId?: string;
  date?: string;
  eventType: 'WAKEUP' | 'NAP' | 'NIGHT_SLEEP';
  startTime: string;
  endTime?: string | null;
  napNumber?: number | null;
  source?: string;
}

function getAuthHeaders(additional?: Record<string, string>): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = { ...additional };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchScheduleStatus(
  childId?: string,
  date?: string,
  currentTime?: string
): Promise<DayStatusResponse> {
  const params = new URLSearchParams();
  if (childId) params.append('childId', childId);
  if (date) params.append('date', date);
  if (currentTime) params.append('currentTime', currentTime);

  const url = `/api/sleep/status${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch sleep status: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function postFellAsleep(
  childIdOrOptions?: string | { childId?: string; time?: string; source?: string },
  time?: string,
  source: string = 'NOW'
): Promise<any> {
  let childId = 'demo-child-1';
  let t = time;
  let s = source;
  if (typeof childIdOrOptions === 'object' && childIdOrOptions !== null) {
    childId = childIdOrOptions.childId || 'demo-child-1';
    t = childIdOrOptions.time;
    s = childIdOrOptions.source || 'NOW';
  } else if (typeof childIdOrOptions === 'string') {
    childId = childIdOrOptions;
  }

  const res = await fetch('/api/sleep/fell-asleep', {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ childId, time: t, source: s }),
  });
  if (!res.ok) {
    throw new Error(`Failed to record fell asleep: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function postWokeUp(
  childIdOrOptions?: string | { childId?: string; time?: string; source?: string },
  time?: string,
  source: string = 'NOW'
): Promise<any> {
  let childId = 'demo-child-1';
  let t = time;
  let s = source;
  if (typeof childIdOrOptions === 'object' && childIdOrOptions !== null) {
    childId = childIdOrOptions.childId || 'demo-child-1';
    t = childIdOrOptions.time;
    s = childIdOrOptions.source || 'NOW';
  } else if (typeof childIdOrOptions === 'string') {
    childId = childIdOrOptions;
  }

  const res = await fetch('/api/sleep/woke-up', {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ childId, time: t, source: s }),
  });
  if (!res.ok) {
    throw new Error(`Failed to record woke up: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function postRetroactive(payload: RetroactiveSleepPayload): Promise<any> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const date = payload.date || todayStr;

  const res = await fetch('/api/sleep/retroactive', {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      childId: payload.childId || 'demo-child-1',
      date,
      eventType: payload.eventType,
      startTime: payload.startTime,
      endTime: payload.endTime || null,
      napNumber: payload.napNumber ?? null,
      source: payload.source || 'RETROACTIVE',
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to record retroactive sleep: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Aliases matching requirement specs
export const recordFellAsleepApi = postFellAsleep;
export const recordWokeUpApi = postWokeUp;
export const recordRetroactiveApi = postRetroactive;

export interface CalendarDaySummary {
  date: string;
  dayNumber: number;
  dayOfWeek: string;
  totalDaySleepMinutes: number;
  formattedTotalDaySleep: string;
  napsCount: number;
  targetNapsCount: number;
  bedtime: string | null;
  targetBedtime: string;
  wakeupTime: string | null;
  isNormMet: boolean;
  differenceFromNormMinutes: number;
  formattedDifference: string;
  events: FormattedSleepEvent[];
}

export interface MonthSummaryResponse {
  year: number;
  month: number;
  childId: string;
  targetDaySleepMinutes: number;
  targetNapsCount: number;
  targetBedtime: string;
  averageDaySleepMinutes: number;
  daysNormMetCount: number;
  totalLoggedDays: number;
  days: CalendarDaySummary[];
}

export async function fetchMonthSummary(
  childId?: string,
  year?: number,
  month?: number
): Promise<MonthSummaryResponse> {
  const params = new URLSearchParams();
  if (childId) params.append('childId', childId);
  if (year) params.append('year', String(year));
  if (month) params.append('month', String(month));

  const url = `/api/calendar/month${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch calendar month: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

