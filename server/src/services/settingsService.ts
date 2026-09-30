import { getDb, DbChildSettings, DbChild, DbFamily } from '../db/database';
import { validateSettings, ValidationResult, SettingsInput } from '@shared/sleepEngine';

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
  updatedAt: string;
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
    members: Array<{
      id: string;
      name: string;
      role: string;
      email: string;
    }>;
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

export function getSettings(childId: string): SettingsResponse {
  const db = getDb();

  let child = db.prepare('SELECT * FROM children WHERE id = ?').get(childId) as DbChild | undefined;
  if (!child) {
    // Fallback: check if there's any child in the database
    child = db.prepare('SELECT * FROM children LIMIT 1').get() as DbChild | undefined;
    if (!child) {
      throw new Error('Профиль ребёнка не найден');
    }
  }

  let dbSettings = db.prepare('SELECT * FROM child_settings WHERE child_id = ?').get(child.id) as DbChildSettings | undefined;
  if (!dbSettings) {
    const settingsId = 'settings-' + child.id;
    db.prepare(`
      INSERT INTO child_settings (
        id, child_id, naps_per_day, wake_interval_min_minutes, wake_interval_max_minutes,
        total_wake_minutes, total_day_sleep_minutes, target_bedtime, typical_wakeup_time
      ) VALUES (?, ?, 3, 150, 180, 600, 200, '20:30', '07:00')
    `).run(settingsId, child.id);
    dbSettings = db.prepare('SELECT * FROM child_settings WHERE child_id = ?').get(child.id) as DbChildSettings;
  }

  const family = db.prepare('SELECT * FROM families WHERE id = ?').get(child.family_id) as DbFamily | undefined;
  const members = db.prepare('SELECT id, name, role, email FROM users WHERE family_id = ?').all(child.family_id) as Array<{
    id: string;
    name: string;
    role: string;
    email: string;
  }>;

  const settingsDto: ChildSettingsDto = {
    id: dbSettings.id,
    childId: dbSettings.child_id,
    napsPerDay: dbSettings.naps_per_day,
    wakeIntervalMinMinutes: dbSettings.wake_interval_min_minutes,
    wakeIntervalMaxMinutes: dbSettings.wake_interval_max_minutes,
    totalWakeMinutes: dbSettings.total_wake_minutes,
    totalDaySleepMinutes: dbSettings.total_day_sleep_minutes,
    targetBedtime: dbSettings.target_bedtime,
    typicalWakeupTime: dbSettings.typical_wakeup_time,
    updatedAt: dbSettings.updated_at,
  };

  const validationInput: SettingsInput = {
    napsPerDay: settingsDto.napsPerDay,
    wakeIntervalMinMinutes: settingsDto.wakeIntervalMinMinutes,
    wakeIntervalMaxMinutes: settingsDto.wakeIntervalMaxMinutes,
    totalWakeMinutes: settingsDto.totalWakeMinutes,
    totalDaySleepMinutes: settingsDto.totalDaySleepMinutes,
    targetBedtime: settingsDto.targetBedtime,
    typicalWakeupTime: settingsDto.typicalWakeupTime,
  };

  const validation = validateSettings(validationInput);

  return {
    child: {
      id: child.id,
      name: child.name,
      birthDate: child.birth_date,
      familyId: child.family_id,
    },
    settings: settingsDto,
    validation,
    family: {
      id: family ? family.id : child.family_id,
      name: family ? family.name : 'Семья',
      inviteCode: family ? family.invite_code : '',
      members,
    },
  };
}

export function updateSettings(childId: string, input: UpdateSettingsInput): SettingsResponse {
  const db = getDb();
  const current = getSettings(childId);

  if (input.childName !== undefined || input.birthDate !== undefined) {
    db.prepare(`
      UPDATE children
      SET name = COALESCE(?, name),
          birth_date = COALESCE(?, birth_date)
      WHERE id = ?
    `).run(input.childName ?? null, input.birthDate ?? null, current.child.id);
  }

  const napsPerDay = input.napsPerDay ?? current.settings.napsPerDay;
  const wakeIntervalMinMinutes = input.wakeIntervalMinMinutes ?? current.settings.wakeIntervalMinMinutes;
  const wakeIntervalMaxMinutes = input.wakeIntervalMaxMinutes ?? current.settings.wakeIntervalMaxMinutes;
  const totalWakeMinutes = input.totalWakeMinutes ?? current.settings.totalWakeMinutes;
  const totalDaySleepMinutes = input.totalDaySleepMinutes ?? current.settings.totalDaySleepMinutes;
  const targetBedtime = input.targetBedtime ?? current.settings.targetBedtime;
  const typicalWakeupTime = input.typicalWakeupTime ?? current.settings.typicalWakeupTime;

  db.prepare(`
    UPDATE child_settings
    SET naps_per_day = ?,
        wake_interval_min_minutes = ?,
        wake_interval_max_minutes = ?,
        total_wake_minutes = ?,
        total_day_sleep_minutes = ?,
        target_bedtime = ?,
        typical_wakeup_time = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE child_id = ?
  `).run(
    napsPerDay,
    wakeIntervalMinMinutes,
    wakeIntervalMaxMinutes,
    totalWakeMinutes,
    totalDaySleepMinutes,
    targetBedtime,
    typicalWakeupTime,
    current.child.id
  );

  return getSettings(current.child.id);
}
