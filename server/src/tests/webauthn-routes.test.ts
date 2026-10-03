import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../index';
import { initDatabase, setDb } from '../db/database';
import Database from 'better-sqlite3';
vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: async () => ({ challenge: 'c', rp: {}, user: {}, pubKeyCredParams: [] }),
  verifyRegistrationResponse: async () => ({
    verified: true,
    registrationInfo: { credentialID: new Uint8Array([1]), credentialPublicKey: new Uint8Array([2]), counter: 0 },
  }),
  generateAuthenticationOptions: async () => ({ challenge: 'c2', allowCredentials: [] }),
  verifyAuthenticationResponse: async () => ({ verified: true, authenticationInfo: { newCounter: 1 } }),
}));
describe('webauthn routes', () => {
  let db: Database.Database;
  let token: string;
  beforeAll(async () => {
    db = initDatabase(':memory:');
    setDb(db);
    const res = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost:3001')
      .send({ email: 'mama@mail.ru', password: 'password123' });
    token = res.body.token;
  });
  afterAll(() => db && db.close());
  it('register options requires auth', async () => {
    const r = await request(app).post('/api/webauthn/register/options').set('Host', 'localhost:3001');
    expect(r.status).toBe(401);
  });
  it('returns register options for authed user', async () => {
    const r = await request(app)
      .post('/api/webauthn/register/options')
      .set('Host', 'localhost:3001')
      .set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.challenge).toBe('c');
  });
  it('auth options is reachable without JWT', async () => {
    const r = await request(app)
      .post('/api/webauthn/auth/options')
      .set('Host', 'localhost:3001')
      .send({ email: 'mama@mail.ru' });
    expect(r.status).toBe(400);
  });
});
