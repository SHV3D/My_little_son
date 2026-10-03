import crypto from 'crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { getDb, DbWebauthnCredential } from '../db/database';
import { buildAuthResponseByUserId, AuthResponse } from './authService';

export const RP_ID = process.env.WEBAUTHN_RP_ID || 'son.shved.su';
export const RP_NAME = 'My little son';
export const ORIGIN = process.env.WEBAUTHN_ORIGIN || `https://${RP_ID}`;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function storeChallenge(userId: string | null, challenge: string, type: 'reg' | 'auth'): void {
  const db = getDb();
  // Global expired-row cleanup (cheap housekeeping).
  db.prepare('DELETE FROM webauthn_challenges WHERE expires_at < ?').run(new Date().toISOString());
  // Enforce exactly ONE live challenge per (user, type): drop any prior live row for this
  // same user+type before inserting the fresh one. Without this, two options requests within
  // the same second share an identical CURRENT_TIMESTAMP (1s resolution), and takeChallenge's
  // ORDER BY created_at DESC LIMIT 1 could return the stale challenge, breaking a legit
  // double-tap/retry. Narrowly scoped to this user_id — never touches other users' rows.
  db.prepare('DELETE FROM webauthn_challenges WHERE user_id IS ? AND type = ?').run(userId, type);
  db.prepare('INSERT INTO webauthn_challenges (id,user_id,challenge,type,expires_at) VALUES (?,?,?,?,?)').run(
    crypto.randomUUID(),
    userId,
    challenge,
    type,
    new Date(Date.now() + CHALLENGE_TTL_MS).toISOString()
  );
}

// Consumes (deletes) the most recent challenge of the given type for the user.
// Deletion happens BEFORE the expiry check so that an expired challenge is
// also removed (can't be retried) and both "expired" and "already consumed"
// cases fail the same way: the row is gone, so subsequent calls throw too.
function takeChallenge(userId: string | null, type: 'reg' | 'auth'): string {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM webauthn_challenges WHERE type=? AND (user_id=? OR ? IS NULL) ORDER BY created_at DESC LIMIT 1`)
    .get(type, userId, userId) as any;
  if (!row) throw new Error('Challenge не найден');
  db.prepare('DELETE FROM webauthn_challenges WHERE id=?').run(row.id);
  if (new Date(row.expires_at).getTime() < Date.now()) throw new Error('Challenge истёк');
  return row.challenge;
}

export async function createRegistrationOptions(userId: string, email: string, name: string) {
  const existing = getDb()
    .prepare('SELECT credential_id, transports FROM webauthn_credentials WHERE user_id=?')
    .all(userId) as Array<{ credential_id: string; transports: string | null }>;

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: email,
    userID: new Uint8Array(Buffer.from(userId, 'utf8')),
    userDisplayName: name,
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({
      id: c.credential_id,
      transports: c.transports ? JSON.parse(c.transports) : undefined,
    })),
    authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' },
  });
  storeChallenge(userId, options.challenge, 'reg');
  return options;
}

export async function verifyRegistration(userId: string, body: any): Promise<{ verified: boolean }> {
  const expectedChallenge = takeChallenge(userId, 'reg');
  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Регистрация биометрии не подтверждена');
  }
  const { credential } = verification.registrationInfo;
  getDb()
    .prepare(
      'INSERT INTO webauthn_credentials (id,user_id,credential_id,public_key,counter,transports,device_label) VALUES (?,?,?,?,?,?,?)'
    )
    .run(
      crypto.randomUUID(),
      userId,
      credential.id,
      Buffer.from(credential.publicKey).toString('base64url'),
      credential.counter,
      (body.response && JSON.stringify(body.response.transports)) || null,
      body.deviceLabel || null
    );
  return { verified: true };
}

export async function createAuthOptions(email: string) {
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE LOWER(email)=?').get(email.trim().toLowerCase()) as
    | { id: string }
    | undefined;
  if (!user) throw new Error('Пользователь не найден');
  const creds = db
    .prepare('SELECT credential_id, transports FROM webauthn_credentials WHERE user_id=?')
    .all(user.id) as Array<{ credential_id: string; transports: string | null }>;
  if (creds.length === 0) throw new Error('Биометрия не настроена на этом аккаунте');
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'required',
    allowCredentials: creds.map((c) => ({
      id: c.credential_id,
      transports: c.transports ? JSON.parse(c.transports) : undefined,
    })),
  });
  storeChallenge(user.id, options.challenge, 'auth');
  return { options, userId: user.id };
}

export async function verifyAuthentication(body: any): Promise<AuthResponse> {
  const db = getDb();
  const credId: string = body.id || body.rawId;
  const cred = db.prepare('SELECT * FROM webauthn_credentials WHERE credential_id=?').get(credId) as
    | DbWebauthnCredential
    | undefined;
  if (!cred) throw new Error('Учётные данные не найдены');
  const expectedChallenge = takeChallenge(cred.user_id, 'auth');
  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: true,
    credential: {
      id: cred.credential_id,
      publicKey: new Uint8Array(Buffer.from(cred.public_key, 'base64url')),
      counter: cred.counter,
      transports: cred.transports ? JSON.parse(cred.transports) : undefined,
    },
  });
  if (!verification.verified) throw new Error('Биометрия не подтверждена');
  db.prepare('UPDATE webauthn_credentials SET counter=? WHERE id=?').run(
    verification.authenticationInfo.newCounter,
    cred.id
  );
  return buildAuthResponseByUserId(cred.user_id);
}
