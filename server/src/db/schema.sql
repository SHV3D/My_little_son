-- Schema for My Little Son SQLite Database

CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('Мама', 'Папа', 'Другое')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birth_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS child_settings (
  id TEXT PRIMARY KEY,
  child_id TEXT UNIQUE NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  naps_per_day INTEGER NOT NULL DEFAULT 3,
  wake_interval_min_minutes INTEGER NOT NULL DEFAULT 150,
  wake_interval_max_minutes INTEGER NOT NULL DEFAULT 180,
  total_wake_minutes INTEGER NOT NULL DEFAULT 600,
  total_day_sleep_minutes INTEGER NOT NULL DEFAULT 200,
  target_bedtime TEXT NOT NULL DEFAULT '20:30',
  typical_wakeup_time TEXT NOT NULL DEFAULT '07:00',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sleep_events (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('WAKEUP', 'NAP', 'NIGHT_SLEEP')),
  nap_number INTEGER,
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  duration_minutes INTEGER,
  recorded_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  recorded_by_name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'MANUAL',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_family ON users(family_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_children_family ON children(family_id);
CREATE INDEX IF NOT EXISTS idx_child_settings_child ON child_settings(child_id);
CREATE INDEX IF NOT EXISTS idx_sleep_events_child_date ON sleep_events(child_id, date);
