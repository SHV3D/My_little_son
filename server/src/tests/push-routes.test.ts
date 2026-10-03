import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import { initDatabase, setDb } from '../db/database';
import Database from 'better-sqlite3';

describe('push routes', () => {
  let db: Database.Database; let token: string;
  beforeAll(async () => {
    db = initDatabase(':memory:'); setDb(db);
    const res = await request(app).post('/api/auth/login').set('Host','localhost:3001').send({ email:'mama@mail.ru', password:'password123' });
    token = res.body.token;
  });
  afterAll(() => db && db.close());

  it('exposes vapid public key', async () => {
    const res = await request(app).get('/api/push/vapid-public-key').set('Host','localhost:3001');
    expect(res.status).toBe(200);
    expect(typeof res.body.key).toBe('string');
  });
  it('stores a subscription', async () => {
    const res = await request(app).post('/api/push/subscribe').set('Host','localhost:3001')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint:'https://push.example/abc', keys:{ p256dh:'p', auth:'a' } });
    expect(res.status).toBe(201);
    const row = db.prepare('SELECT * FROM push_subscriptions WHERE endpoint=?').get('https://push.example/abc');
    expect(row).toBeTruthy();
  });
  it('rejects subscribe without auth', async () => {
    const res = await request(app).post('/api/push/subscribe').set('Host','localhost:3001').send({});
    expect(res.status).toBe(401);
  });
});
