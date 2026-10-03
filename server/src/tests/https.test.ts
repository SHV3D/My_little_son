import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import { initDatabase, setDb } from '../db/database';
import Database from 'better-sqlite3';

describe('HTTPS enforcement', () => {
  let db: Database.Database;
  beforeAll(() => { db = initDatabase(':memory:'); setDb(db); });
  afterAll(() => db && db.close());

  it('redirects insecure external request to https', async () => {
    const res = await request(app).get('/').set('Host', 'son.shved.su').set('X-Forwarded-Proto', 'http');
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://son.shved.su/');
  });

  it('passes through when already https (no loop)', async () => {
    const res = await request(app).get('/api/health').set('Host', 'son.shved.su').set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(200);
    expect(res.headers['strict-transport-security']).toContain('max-age=');
  });

  it('does not redirect localhost', async () => {
    const res = await request(app).get('/api/health').set('Host', 'localhost:3001');
    expect(res.status).toBe(200);
  });
});
