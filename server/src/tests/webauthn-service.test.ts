import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../index';
import { initDatabase, setDb, getDb } from '../db/database';
import Database from 'better-sqlite3';

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: async () => ({ challenge: 'chal', rp: {}, user: {}, pubKeyCredParams: [] }),
  verifyRegistrationResponse: async () => ({
    verified: true,
    registrationInfo: {
      credential: { id: 'Y3JlZA', publicKey: new Uint8Array([2]), counter: 0 },
    },
  }),
  generateAuthenticationOptions: async () => ({ challenge: 'chal2', allowCredentials: [] }),
  verifyAuthenticationResponse: async () => ({ verified: true, authenticationInfo: { newCounter: 1 } }),
}));

describe('webauthnService', () => {
  let db: Database.Database;
  let userId: string;

  beforeAll(async () => {
    db = initDatabase(':memory:');
    setDb(db);
    const res = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost:3001')
      .send({ email: 'mama@mail.ru', password: 'password123' });
    userId = res.body.user.id;
  });

  afterAll(() => db && db.close());

  it('rejects verify when challenge expired', async () => {
    const { verifyRegistration } = await import('../services/webauthnService');
    getDb()
      .prepare(
        "INSERT INTO webauthn_challenges (id,user_id,challenge,type,expires_at) VALUES ('c1',?, 'chal','reg', ?)"
      )
      .run(userId, new Date(Date.now() - 1000).toISOString());
    await expect(verifyRegistration(userId, { id: 'x' } as any)).rejects.toThrow();
  });

  it('rejects verify when challenge already consumed (missing)', async () => {
    const { verifyRegistration } = await import('../services/webauthnService');
    await expect(verifyRegistration(userId, { id: 'x' } as any)).rejects.toThrow();
  });

  it('creates registration options and stores a challenge for the user', async () => {
    const { createRegistrationOptions } = await import('../services/webauthnService');
    const options = await createRegistrationOptions(userId, 'mama@mail.ru', 'Мама');
    expect(options.challenge).toBe('chal');
    const row = getDb()
      .prepare("SELECT * FROM webauthn_challenges WHERE user_id=? AND type='reg'")
      .get(userId) as any;
    expect(row).toBeTruthy();
    expect(row.challenge).toBe('chal');
  });

  it('verifies registration with a valid non-expired challenge and stores credential', async () => {
    const { createRegistrationOptions, verifyRegistration } = await import('../services/webauthnService');
    getDb().prepare("DELETE FROM webauthn_challenges WHERE user_id=? AND type='reg'").run(userId);
    await createRegistrationOptions(userId, 'mama@mail.ru', 'Мама');
    const result = await verifyRegistration(userId, { id: 'x', response: { transports: ['internal'] } } as any);
    expect(result.verified).toBe(true);

    const cred = getDb().prepare('SELECT * FROM webauthn_credentials WHERE user_id=?').get(userId) as any;
    expect(cred).toBeTruthy();
    expect(cred.counter).toBe(0);

    // challenge should be consumed (deleted) after verify
    const remaining = getDb()
      .prepare("SELECT * FROM webauthn_challenges WHERE user_id=? AND type='reg'")
      .get(userId);
    expect(remaining).toBeFalsy();
  });

  it('creates auth options only for a user with registered credentials', async () => {
    const { createAuthOptions } = await import('../services/webauthnService');
    const { options, userId: uid } = await createAuthOptions('mama@mail.ru');
    expect(options.challenge).toBe('chal2');
    expect(uid).toBe(userId);
  });

  it('rejects createAuthOptions for unknown email', async () => {
    const { createAuthOptions } = await import('../services/webauthnService');
    await expect(createAuthOptions('nope@nowhere.com')).rejects.toThrow();
  });

  it('verifies authentication, updates counter, and issues an AuthResponse token', async () => {
    const { createAuthOptions, verifyAuthentication } = await import('../services/webauthnService');
    await createAuthOptions('mama@mail.ru');
    const credRow = getDb().prepare('SELECT * FROM webauthn_credentials WHERE user_id=?').get(userId) as any;

    const authResponse = await verifyAuthentication({ id: credRow.credential_id } as any);
    expect(authResponse.token).toBeTruthy();
    expect(authResponse.user.id).toBe(userId);

    const updatedCred = getDb().prepare('SELECT * FROM webauthn_credentials WHERE id=?').get(credRow.id) as any;
    expect(updatedCred.counter).toBe(1);
  });

  it('rejects verifyAuthentication for unknown credential id', async () => {
    const { verifyAuthentication } = await import('../services/webauthnService');
    await expect(verifyAuthentication({ id: 'does-not-exist' } as any)).rejects.toThrow();
  });
});
