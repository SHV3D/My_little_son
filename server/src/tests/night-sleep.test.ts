import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import { initDatabase, setDb, getDb } from '../db/database';
import Database from 'better-sqlite3';

describe('night sleep (fell-asleep with isNightSleep)', () => {
  let db: Database.Database;
  let token: string;
  let childId: string;

  beforeAll(async () => {
    db = initDatabase(':memory:');
    setDb(db);
    const res = await request(app)
      .post('/api/auth/login')
      .set('Host', 'localhost:3001')
      .send({ email: 'mama@mail.ru', password: 'password123' });
    token = res.body.token;
    childId = res.body.child.id;
  });

  afterAll(() => db && db.close());

  it('creates a NIGHT_SLEEP event (no nap number) and shows the morning wake, not an interval deadline', async () => {
    const res = await request(app)
      .post('/api/sleep/fell-asleep')
      .set('Host', 'localhost:3001')
      .set('Authorization', `Bearer ${token}`)
      .send({ time: '20:30', source: 'MANUAL', isNightSleep: true });

    expect(res.status).toBe(200);

    const row = getDb()
      .prepare("SELECT event_type, nap_number FROM sleep_events WHERE child_id=? AND event_type='NIGHT_SLEEP'")
      .get(childId) as { event_type: string; nap_number: number | null } | undefined;
    expect(row).toBeTruthy();
    expect(row!.nap_number).toBeNull();

    // Active night sleep → schedule is SLEEPING and the expected wake equals the
    // child's typical morning wake-up from settings (default 07:00), not an
    // interval-based deadline.
    expect(res.body.status.schedule.state).toBe('SLEEPING');
    expect(res.body.status.schedule.wakeDeadlineTime).toBe('07:00');
  });
});
