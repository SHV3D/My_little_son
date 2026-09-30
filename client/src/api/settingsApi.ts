import { ValidationResult } from '@shared/sleepEngine';

export interface ChildSettingsDto {
  id: string;
  childId: string;
  napsPerDay: number;
  wakeIntervalMinMinutes: number;
  wakeIntervalMaxMinutes: number;
  totalWakeMinutes: number;
  totalDaySleepMinutes: number;
  targetBedtime: string;
  typicalWakeupTime: string;
  updatedAt?: string;
}

export interface SettingsFamilyMember {
  id: string;
  name: string;
  role: string;
  email: string;
}

export interface SettingsResponse {
  child: {
    id: string;
    name: string;
    birthDate: string | null;
    familyId: string;
  };
  settings: ChildSettingsDto;
  validation: ValidationResult;
  family: {
    id: string;
    name: string;
    inviteCode: string;
    members: SettingsFamilyMember[];
  };
}

export interface UpdateSettingsInput {
  childName?: string;
  birthDate?: string;
  napsPerDay?: number;
  wakeIntervalMinMinutes?: number;
  wakeIntervalMaxMinutes?: number;
  totalWakeMinutes?: number;
  totalDaySleepMinutes?: number;
  targetBedtime?: string;
  typicalWakeupTime?: string;
}

const API_BASE = '/api/settings';

export async function fetchSettings(childId = 'demo-child-1'): Promise<SettingsResponse> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}?childId=${encodeURIComponent(childId)}`, {
    headers,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Ошибка загрузки настроек: ${res.statusText}`);
  }

  return res.json();
}

export async function updateSettingsApi(
  payload: UpdateSettingsInput,
  childId = 'demo-child-1'
): Promise<SettingsResponse> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(API_BASE, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ ...payload, childId }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Ошибка сохранения настроек: ${res.statusText}`);
  }

  return res.json();
}
