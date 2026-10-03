import crypto from 'crypto';
import { getDb, DbPushSubscription } from '../db/database';

export function saveSubscription(userId: string, familyId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }): void {
  getDb().prepare(`
    INSERT INTO push_subscriptions (id, user_id, family_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, family_id=excluded.family_id, p256dh=excluded.p256dh, auth=excluded.auth
  `).run(crypto.randomUUID(), userId, familyId, sub.endpoint, sub.keys.p256dh, sub.keys.auth);
}
export function removeSubscription(endpoint: string): void {
  getDb().prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
}
export function getFamilySubscriptions(familyId: string): DbPushSubscription[] {
  return getDb().prepare('SELECT * FROM push_subscriptions WHERE family_id = ?').all(familyId) as DbPushSubscription[];
}
