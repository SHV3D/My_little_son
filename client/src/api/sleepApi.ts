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
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch sleep status: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function postFellAsleep(
  childId?: string,
  time?: string,
  source: string = 'NOW'
): Promise<any> {
  const res = await fetch('/api/sleep/fell-asleep', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ childId, time, source }),
  });
  if (!res.ok) {
    throw new Error(`Failed to record fell asleep: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function postWokeUp(
  childId?: string,
  time?: string,
  source: string = 'NOW'
): Promise<any> {
  const res = await fetch('/api/sleep/woke-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ childId, time, source }),
  });
  if (!res.ok) {
    throw new Error(`Failed to record woke up: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
