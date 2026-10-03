import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../index';
import { initDatabase, setDb, getDb } from '../db/database';
import Database from 'better-sqlite3';
import { dispatchAllFamilies, nowInZone } from '../services/pushDispatchService';
import { saveSubscription } from '../services/pushSubscriptionService';

describe('push dispatch', () => {
  let db: Database.Database; let familyId: string; let childId: string;

  // Fixed injected instant: 2026-10-03T11:00:00Z == 14:00 in Europe/Moscow (UTC+3),
  // the default family timezone in the seed. 14:00 is comfortably past
  // typicalWakeupTime (07:00) + wake_interval_min (150min = 09:30), so with NO sleep
  // events for that day the engine deterministically yields AWAKE +
  // nextNap.countdownMinutes <= 0 -> SLEEP_TIME, regardless of the real wall clock.
  const INJECTED_NOW = new Date('2026-10-03T11:00:00.000Z');

  beforeAll(async () => {
    db = initDatabase(':memory:'); setDb(db);
    const res = await request(app).post('/api/auth/login').set('Host','localhost:3001').send({ email:'mama@mail.ru', password:'password123' });
    familyId = res.body.family.id;
    childId = 'demo-child-1';
    saveSubscription(res.body.user.id, familyId, { endpoint:'https://push.example/x', keys:{ p256dh:'p', auth:'a' } });

    // Clear any sleep events for the SAME date the dispatcher will compute from the
    // injected clock (derived via nowInZone's en-CA formatter in the family tz), so
    // getDayStatus reads an empty day and the AWAKE/countdown<=0 fallback holds.
    const tz = (db.prepare('SELECT timezone FROM families WHERE id=?').get(familyId) as { timezone: string }).timezone;
    const { date } = nowInZone(tz, INJECTED_NOW);
    db.prepare('DELETE FROM sleep_events WHERE child_id = ? AND date = ?').run(childId, date);
  });
  afterAll(() => db && db.close());

  it('throttles duplicate dispatch_key within window', async () => {
    const sent: any[] = [];
    const sender = vi.fn(async (sub: any, payload: string) => { sent.push(payload); });
    await dispatchAllFamilies(sender, INJECTED_NOW);
    const first = sent.length;
    expect(first).toBeGreaterThan(0); // notifiable state must have produced sends
    await dispatchAllFamilies(sender, INJECTED_NOW);
    const second = sent.length - first;
    // second run must not resend the same keys already logged in window
    expect(second).toBe(0);
    const logRows = db.prepare('SELECT DISTINCT dispatch_key FROM push_dispatch_log WHERE family_id=?').all(familyId);
    expect(logRows.length).toBeGreaterThan(0);
  });

  it('prunes a subscription when sender throws 410', async () => {
    db.prepare('DELETE FROM push_dispatch_log').run();
    const sender = vi.fn(async () => { const e: any = new Error('gone'); e.statusCode = 410; throw e; });
    const before = db.prepare('SELECT COUNT(*) c FROM push_subscriptions WHERE family_id=?').get(familyId) as any;
    expect(before.c).toBeGreaterThan(0);
    const result = await dispatchAllFamilies(sender, INJECTED_NOW);
    expect(result.pruned).toBeGreaterThanOrEqual(1);
    const after = db.prepare('SELECT COUNT(*) c FROM push_subscriptions WHERE family_id=?').get(familyId) as any;
    expect(after.c).toBeLessThan(before.c);
  });
});
