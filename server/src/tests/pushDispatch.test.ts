import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../index';
import { initDatabase, setDb, getDb } from '../db/database';
import Database from 'better-sqlite3';
import { dispatchAllFamilies } from '../services/pushDispatchService';
import { saveSubscription } from '../services/pushSubscriptionService';

describe('push dispatch', () => {
  let db: Database.Database; let familyId: string; let childId: string;
  beforeAll(async () => {
    db = initDatabase(':memory:'); setDb(db);
    const res = await request(app).post('/api/auth/login').set('Host','localhost:3001').send({ email:'mama@mail.ru', password:'password123' });
    familyId = res.body.family.id;
    childId = 'demo-child-1';
    saveSubscription(res.body.user.id, familyId, { endpoint:'https://push.example/x', keys:{ p256dh:'p', auth:'a' } });

    // Force a notifiable state: ensure there is NO ongoing sleep event and that the
    // baby has been "awake" long enough that nextNap.countdownMinutes <= 0 for "today"
    // (server's real current date). Seed data only covers 2026-09-25..2026-09-30, so
    // for the real current date there are no events -> engine falls back to
    // typicalWakeupTime ('07:00') as last wake time. As long as "now" (server clock)
    // is later than 07:00 + wake_interval_min (150min = 09:30), AWAKE + countdown<=0
    // holds, which is true for any reasonable test-run time of day in this environment.
    // To make this deterministic regardless of wall-clock time, explicitly clear any
    // sleep_events for today's date and rely on default child_settings.
    const today = new Date().toISOString().slice(0, 10);
    db.prepare('DELETE FROM sleep_events WHERE child_id = ? AND date = ?').run(childId, today);
  });
  afterAll(() => db && db.close());

  it('throttles duplicate dispatch_key within window', async () => {
    const sent: any[] = [];
    const sender = vi.fn(async (sub: any, payload: string) => { sent.push(payload); });
    await dispatchAllFamilies(sender);
    const first = sent.length;
    expect(first).toBeGreaterThan(0); // notifiable state must have produced sends
    await dispatchAllFamilies(sender);
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
    const result = await dispatchAllFamilies(sender);
    expect(result.pruned).toBeGreaterThanOrEqual(1);
    const after = db.prepare('SELECT COUNT(*) c FROM push_subscriptions WHERE family_id=?').get(familyId) as any;
    expect(after.c).toBeLessThan(before.c);
  });
});
