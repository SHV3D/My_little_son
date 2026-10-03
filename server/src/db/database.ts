import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { SCHEMA_SQL } from './schemaSql';

export interface DbFamily {
  id: string;
  name: string;
  invite_code: string;
  recovery_code?: string;
  created_at: string;
}

export interface DbUser {
  id: string;
  family_id: string;
  email: string;
  password_hash: string;
  name: string;
  role: 'Мама' | 'Папа' | 'Другое';
  created_at: string;
}

export interface DbChild {
  id: string;
  family_id: string;
  name: string;
  birth_date: string | null;
  created_at: string;
}

export interface DbChildSettings {
  id: string;
  child_id: string;
  naps_per_day: number;
  wake_interval_min_minutes: number;
  wake_interval_max_minutes: number;
  total_wake_minutes: number;
  total_day_sleep_minutes: number;
  target_bedtime: string;
  typical_wakeup_time: string;
  updated_at: string;
}

export interface DbPushSubscription {
  id: string;
  user_id: string;
  family_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

export interface DbWebauthnCredential {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string | null;
  device_label: string | null;
  created_at: string;
}

export interface DbSleepEvent {
  id: string;
  child_id: string;
  date: string;
  event_type: 'WAKEUP' | 'NAP' | 'NIGHT_SLEEP';
  nap_number: number | null;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  recorded_by_user_id: string | null;
  recorded_by_name: string;
  source: string;
  created_at: string;
  updated_at: string;
}

let dbInstance: Database.Database | null = null;

export function getDefaultDbPath(): string {
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }
  // Try resolving relative to workspace or repository root
  const rootDataDir = path.resolve(__dirname, '../../../data');
  return path.join(rootDataDir, 'my_little_son.db');
}

export function initDatabase(customPath?: string): Database.Database {
  const dbPath = customPath || getDefaultDbPath();
  const isMemory = dbPath === ':memory:';

  if (!isMemory) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath);

  // Configure pragmas
  db.pragma('foreign_keys = ON');
  if (!isMemory) {
    db.pragma('journal_mode = WAL');
  }

  // Load and execute schema
  db.exec(SCHEMA_SQL);

  // Migration: ensure recovery_code column exists on families table
  const familyColumns = db.prepare("PRAGMA table_info(families)").all() as { name: string }[];
  if (!familyColumns.some((col) => col.name === 'recovery_code')) {
    db.exec('ALTER TABLE families ADD COLUMN recovery_code TEXT;');
  }

  // Migration: ensure timezone column exists on families table
  const famCols = db.prepare("PRAGMA table_info(families)").all() as Array<{ name: string }>;
  if (!famCols.some((c) => c.name === 'timezone')) {
    db.exec("ALTER TABLE families ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Europe/Moscow'");
  }

  // Seed demo data if database is empty
  seedDatabaseIfEmpty(db);

  dbInstance = db;
  return db;
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = initDatabase();
  }
  return dbInstance;
}

export function setDb(db: Database.Database): void {
  dbInstance = db;
}

export function seedDatabaseIfEmpty(db: Database.Database): void {
  const familyCount = (db.prepare('SELECT COUNT(*) as count FROM families').get() as { count: number }).count;
  if (familyCount > 0) {
    return;
  }

  const insertFamily = db.prepare(`
    INSERT INTO families (id, name, invite_code, recovery_code)
    VALUES (?, ?, ?, ?)
  `);

  const insertUser = db.prepare(`
    INSERT INTO users (id, family_id, email, password_hash, name, role)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertChild = db.prepare(`
    INSERT INTO children (id, family_id, name, birth_date)
    VALUES (?, ?, ?, ?)
  `);

  const insertSettings = db.prepare(`
    INSERT INTO child_settings (
      id, child_id, naps_per_day, wake_interval_min_minutes, wake_interval_max_minutes,
      total_wake_minutes, total_day_sleep_minutes, target_bedtime, typical_wakeup_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEvent = db.prepare(`
    INSERT INTO sleep_events (
      id, child_id, date, event_type, nap_number, start_time, end_time,
      duration_minutes, recorded_by_user_id, recorded_by_name, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const runSeed = db.transaction(() => {
    const familyId = 'demo-family-1';
    const inviteCode = '7K4-Q9M';
    insertFamily.run(familyId, 'Наша семья', inviteCode, 'солнышко');

    const mamaId = 'demo-user-mama';
    const papaId = 'demo-user-papa';
    const passwordHash = bcrypt.hashSync('password123', 10);

    insertUser.run(mamaId, familyId, 'mama@mail.ru', passwordHash, 'Мама', 'Мама');
    insertUser.run(papaId, familyId, 'papa@mail.ru', passwordHash, 'Папа', 'Папа');

    const childId = 'demo-child-1';
    insertChild.run(childId, familyId, 'Сын', '2026-01-15');

    const settingsId = 'demo-settings-1';
    insertSettings.run(
      settingsId,
      childId,
      3,   // naps_per_day
      150, // wake_interval_min_minutes (2h 30m)
      180, // wake_interval_max_minutes (3h 00m)
      600, // total_wake_minutes (10h 00m)
      200, // total_day_sleep_minutes (3h 20m)
      '20:30',
      '07:00'
    );

    // Sleep events for yesterday: 2026-09-29
    // Matches 04_calendar.html:
    // Подъём 07:05
    // Сон 1: 09:35 – 10:50 · 1:15 (75m)
    // Сон 2: 13:20 – 14:45 · 1:25 (85m)
    // Сон 3: 17:25 – 17:55 · 0:30 (30m)
    // Total day sleep = 190m (3:10)
    // Ночной сон 20:35
    insertEvent.run(
      'demo-event-20260929-wakeup',
      childId,
      '2026-09-29',
      'WAKEUP',
      null,
      '2026-09-29T07:05:00',
      '2026-09-29T07:05:00',
      0,
      mamaId,
      'Мама',
      'MANUAL'
    );
    insertEvent.run(
      'demo-event-20260929-nap1',
      childId,
      '2026-09-29',
      'NAP',
      1,
      '2026-09-29T09:35:00',
      '2026-09-29T10:50:00',
      75,
      mamaId,
      'Мама',
      'MANUAL'
    );
    insertEvent.run(
      'demo-event-20260929-nap2',
      childId,
      '2026-09-29',
      'NAP',
      2,
      '2026-09-29T13:20:00',
      '2026-09-29T14:45:00',
      85,
      papaId,
      'Папа',
      'MANUAL'
    );
    insertEvent.run(
      'demo-event-20260929-nap3',
      childId,
      '2026-09-29',
      'NAP',
      3,
      '2026-09-29T17:25:00',
      '2026-09-29T17:55:00',
      30,
      mamaId,
      'Мама',
      'MANUAL'
    );
    insertEvent.run(
      'demo-event-20260929-night',
      childId,
      '2026-09-29',
      'NIGHT_SLEEP',
      null,
      '2026-09-29T20:35:00',
      '2026-09-30T07:10:00',
      635,
      mamaId,
      'Мама',
      'MANUAL'
    );

    // Sleep events for today: 2026-09-30
    // Matches 01_today_awake.html & 03_today_sleeping.html:
    // Подъём 07:10 (Мама)
    // Сон 1 · 1:15 (09:40 – 10:55, Папа)
    // Note: Baby is awake from 10:55 onwards. At 13:05, baby is awake for 2:10!
    insertEvent.run(
      'demo-event-20260930-wakeup',
      childId,
      '2026-09-30',
      'WAKEUP',
      null,
      '2026-09-30T07:10:00',
      '2026-09-30T07:10:00',
      0,
      mamaId,
      'Мама',
      'MANUAL'
    );
    insertEvent.run(
      'demo-event-20260930-nap1',
      childId,
      '2026-09-30',
      'NAP',
      1,
      '2026-09-30T09:40:00',
      '2026-09-30T10:55:00',
      75,
      papaId,
      'Папа',
      'MANUAL'
    );

    // Additional calendar days in September for month overview (2026-09-25 to 2026-09-28)
    const seedPastDays = [
      {
        date: '2026-09-28',
        wake: '07:00',
        naps: [
          { start: '09:30', end: '11:00', dur: 90 },
          { start: '13:30', end: '14:45', dur: 75 },
          { start: '17:30', end: '18:05', dur: 35 },
        ],
        bed: '20:30',
      },
      {
        date: '2026-09-27',
        wake: '07:15',
        naps: [
          { start: '09:45', end: '11:00', dur: 75 },
          { start: '13:30', end: '14:30', dur: 60 },
          { start: '17:15', end: '17:50', dur: 35 },
        ],
        bed: '20:30',
      },
      {
        date: '2026-09-26',
        wake: '07:00',
        naps: [
          { start: '09:30', end: '11:10', dur: 100 },
          { start: '13:40', end: '14:50', dur: 70 },
          { start: '17:35', end: '18:05', dur: 30 },
        ],
        bed: '20:40',
      },
      {
        date: '2026-09-25',
        wake: '07:10',
        naps: [
          { start: '09:40', end: '10:50', dur: 70 },
          { start: '13:30', end: '14:40', dur: 70 },
          { start: '17:20', end: '17:50', dur: 30 },
        ],
        bed: '20:30',
      },
    ];

    for (const day of seedPastDays) {
      insertEvent.run(
        `demo-event-${day.date}-wakeup`,
        childId,
        day.date,
        'WAKEUP',
        null,
        `${day.date}T${day.wake}:00`,
        `${day.date}T${day.wake}:00`,
        0,
        mamaId,
        'Мама',
        'MANUAL'
      );
      day.naps.forEach((nap, idx) => {
        insertEvent.run(
          `demo-event-${day.date}-nap${idx + 1}`,
          childId,
          day.date,
          'NAP',
          idx + 1,
          `${day.date}T${nap.start}:00`,
          `${day.date}T${nap.end}:00`,
          nap.dur,
          idx % 2 === 0 ? mamaId : papaId,
          idx % 2 === 0 ? 'Мама' : 'Папа',
          'MANUAL'
        );
      });
      const nextDay = new Date(new Date(day.date).getTime() + 86400000).toISOString().slice(0, 10);
      insertEvent.run(
        `demo-event-${day.date}-night`,
        childId,
        day.date,
        'NIGHT_SLEEP',
        null,
        `${day.date}T${day.bed}:00`,
        `${nextDay}T07:00:00`,
        630,
        mamaId,
        'Мама',
        'MANUAL'
      );
    }
  });

  runSeed();
}
