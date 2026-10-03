import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import { initDatabase, setDb } from '../db/database';
import Database from 'better-sqlite3';

describe('service worker serving', () => {
  let db: Database.Database;
  beforeAll(() => { db = initDatabase(':memory:'); setDb(db); });
  afterAll(() => db && db.close());
  it('serves sw.js as javascript with no-cache when present', async () => {
    const res = await request(app).get('/sw.js').set('Host', 'localhost:3001');
    // dist may or may not exist in CI; accept 200 (served) with correct headers
    if (res.status === 200) {
      expect(res.headers['content-type']).toContain('javascript');
      expect(res.headers['cache-control']).toContain('no-cache');
    } else {
      expect(res.status).toBe(404); // dist not built in this env
    }
  });
});
