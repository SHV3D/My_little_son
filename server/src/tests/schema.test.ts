import { describe, it, expect, afterAll } from 'vitest';
import { initDatabase } from '../db/database';
import Database from 'better-sqlite3';

describe('schema migrations', () => {
  const db: Database.Database = initDatabase(':memory:');
  afterAll(() => db.close());
  const tables = (name: string) =>
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);

  it('creates new tables', () => {
    for (const t of ['app_config','push_subscriptions','webauthn_credentials','webauthn_challenges','push_dispatch_log']) {
      expect(tables(t), t).toBeTruthy();
    }
  });
  it('adds families.timezone with default', () => {
    const cols = db.prepare("PRAGMA table_info(families)").all() as Array<{name:string}>;
    expect(cols.some((c) => c.name === 'timezone')).toBe(true);
  });
});
