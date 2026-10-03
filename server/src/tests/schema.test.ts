import { describe, it, expect, afterAll } from 'vitest';
import { initDatabase } from '../db/database';
import Database from 'better-sqlite3';
import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

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

  it('re-applies the timezone migration idempotently on a persisted file', () => {
    const tmpPath = path.join(os.tmpdir(), `mls-schema-test-${crypto.randomUUID()}.db`);
    const cleanup = () => {
      for (const suffix of ['', '-wal', '-shm']) {
        const p = tmpPath + suffix;
        if (fs.existsSync(p)) fs.rmSync(p);
      }
    };
    try {
      const first = initDatabase(tmpPath);
      first.close();

      expect(() => {
        const second = initDatabase(tmpPath);
        const cols = second.prepare("PRAGMA table_info(families)").all() as Array<{ name: string }>;
        const timezoneCols = cols.filter((c) => c.name === 'timezone');
        expect(timezoneCols.length).toBe(1);
        second.close();
      }).not.toThrow();
    } finally {
      cleanup();
    }
  });
});
