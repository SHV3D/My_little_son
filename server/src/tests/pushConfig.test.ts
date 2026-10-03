import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDatabase, setDb } from '../db/database';
import Database from 'better-sqlite3';
import { getOrCreateVapidKeys, getCronKey } from '../services/pushConfigService';

describe('push config', () => {
  let db: Database.Database;
  beforeAll(() => { db = initDatabase(':memory:'); setDb(db); });
  afterAll(() => db && db.close());
  it('returns stable VAPID keys across calls', () => {
    const a = getOrCreateVapidKeys();
    const b = getOrCreateVapidKeys();
    expect(a.publicKey).toBe(b.publicKey);
    expect(a.privateKey).toBe(b.privateKey);
    expect(a.publicKey.length).toBeGreaterThan(20);
  });
  it('returns a stable cron key', () => {
    expect(getCronKey()).toBe(getCronKey());
  });
});
