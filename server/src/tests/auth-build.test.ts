import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import { initDatabase, setDb } from '../db/database';
import { buildAuthResponseByUserId } from '../services/authService';
import Database from 'better-sqlite3';

describe('buildAuthResponseByUserId', () => {
  let db: Database.Database; let userId: string;
  beforeAll(async () => {
    db = initDatabase(':memory:'); setDb(db);
    const res = await request(app).post('/api/auth/login').set('Host','localhost:3001').send({ email:'mama@mail.ru', password:'password123' });
    userId = res.body.user.id;
  });
  afterAll(() => db && db.close());
  it('returns token and user for valid id', () => {
    const r = buildAuthResponseByUserId(userId);
    expect(r.token).toBeTruthy();
    expect(r.user.id).toBe(userId);
  });
});
