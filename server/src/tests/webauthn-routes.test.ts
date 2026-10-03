import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import app from '../index';
import { initDatabase, setDb, getDb } from '../db/database';
import Database from 'better-sqlite3';

// Shared mock state lets the negative /auth/verify test force verifyAuthenticationResponse
// to return { verified: false } (library rejects the assertion) while keeping the default
// happy-path { verified: true } for every other call.
const mockState = vi.hoisted(() => ({ nextAuthVerified: true as boolean }));
vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: async () => ({ challenge: 'c', rp: {}, user: {}, pubKeyCredParams: [] }),
  verifyRegistrationResponse: async () => ({
    verified: true,
    registrationInfo: { credentialID: new Uint8Array([1]), credentialPublicKey: new Uint8Array([2]), counter: 0 },
  }),
  generateAuthenticationOptions: async () => ({ challenge: 'c2', allowCredentials: [] }),
  verifyAuthenticationResponse: async () => ({
    verified: mockState.nextAuthVerified,
    authenticationInfo: { newCounter: 1 },
  }),
}));
describe('webauthn routes', () => {
  let db: Database.Database;
  let token: string;
  let userId: string;
  const CRED_ID = 'seeded-cred-id';
  beforeAll(async () => {
    db = initDatabase(':memory:');
    setDb(db);
    const res = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost:3001')
      .send({ email: 'mama@mail.ru', password: 'password123' });
    token = res.body.token;
    userId = res.body.user.id;
    // Seed a credential for the demo user so /auth/options and /auth/verify have
    // something to work against (public biometric-login path).
    getDb()
      .prepare(
        'INSERT INTO webauthn_credentials (id,user_id,credential_id,public_key,counter,transports,device_label) VALUES (?,?,?,?,?,?,?)'
      )
      .run(crypto.randomUUID(), userId, CRED_ID, Buffer.from([2]).toString('base64url'), 0, null, null);
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
  it('auth options is reachable without JWT and returns options for a seeded credential', async () => {
    const r = await request(app)
      .post('/api/webauthn/auth/options')
      .set('Host', 'localhost:3001')
      .send({ email: 'mama@mail.ru' });
    // Reachable (not blocked by requireAuth) and the service resolves because a
    // credential is seeded; returns ONLY the options object (challenge), no userId.
    expect(r.status).toBe(200);
    expect(r.body.challenge).toBe('c2');
    expect(r.body.userId).toBeUndefined();
  });
  it('auth verify is reachable without JWT and issues a token on success', async () => {
    mockState.nextAuthVerified = true;
    // createAuthOptions stores the 'auth' challenge that verifyAuthentication consumes.
    await request(app)
      .post('/api/webauthn/auth/options')
      .set('Host', 'localhost:3001')
      .send({ email: 'mama@mail.ru' });
    const r = await request(app)
      .post('/api/webauthn/auth/verify')
      .set('Host', 'localhost:3001')
      .send({ id: CRED_ID });
    // NOT the auth-middleware 401 — request reached the service and got a JWT back.
    expect(r.status).toBe(200);
    expect(r.body.token).toBeTruthy();
    expect(r.body.error).not.toBe('Необходима авторизация');
  });
  it('auth verify returns 401 {error} when the service throws (not 500, not middleware)', async () => {
    mockState.nextAuthVerified = true;
    const r = await request(app)
      .post('/api/webauthn/auth/verify')
      .set('Host', 'localhost:3001')
      .send({ id: 'unknown-credential-id' });
    expect(r.status).toBe(401);
    expect(typeof r.body.error).toBe('string');
    // Service-layer error, not the auth-middleware rejection.
    expect(r.body.error).not.toBe('Необходима авторизация');
  });
});
