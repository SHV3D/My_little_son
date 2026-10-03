import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import { initDatabase, setDb } from '../db/database';
import { getCronKey } from '../services/pushConfigService';
import Database from 'better-sqlite3';

describe('dispatch route', () => {
  let db: Database.Database;
  beforeAll(() => { db = initDatabase(':memory:'); setDb(db); });
  afterAll(() => db && db.close());
  it('rejects without cron key', async () => {
    const res = await request(app).post('/api/push/dispatch').set('Host','localhost:3001');
    expect(res.status).toBe(403);
  });
  it('accepts with cron key', async () => {
    const res = await request(app).post('/api/push/dispatch').set('Host','localhost:3001').set('X-Cron-Key', getCronKey());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sent');
  });
});
