import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import { initDatabase, setDb } from '../db/database';
import Database from 'better-sqlite3';

describe('My Little Son - REST API Integration Tests', () => {
  let db: Database.Database;
  let mamaToken: string;
  let mamaFamilyId: string;
  let mamaChildId: string;

  beforeAll(() => {
    // Use fresh in-memory database for tests
    db = initDatabase(':memory:');
    setDb(db);
  });

  afterAll(() => {
    if (db) {
      db.close();
    }
  });

  describe('Health check', () => {
    it('returns ok status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('Authentication flow', () => {
    it('logs in seeded demo mama successfully', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'mama@mail.ru',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.name).toBe('Мама');
      expect(res.body.user.role).toBe('Мама');
      expect(res.body.family.inviteCode).toBe('7K4-Q9M');
      expect(res.body.child.name).toBe('Сын');

      mamaToken = res.body.token;
      mamaFamilyId = res.body.family.id;
      mamaChildId = res.body.child.id;
    });

    it('rejects invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'mama@mail.ru',
          password: 'wrongpassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('gets current user profile with token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${mamaToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('mama@mail.ru');
      expect(res.body.family.invite_code).toBe('7K4-Q9M');
      expect(res.body.child.name).toBe('Сын');
      expect(res.body.familyMembers.length).toBeGreaterThanOrEqual(2); // Мама & Папа
    });

    it('fails /api/auth/me without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('registers new user and family', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Анна',
          role: 'Мама',
          email: 'anna@example.com',
          password: 'password123',
          familyName: 'Семья Ивановых',
          childName: 'Миша',
        });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('anna@example.com');
      expect(res.body.family.name).toBe('Семья Ивановых');
      expect(res.body.family.inviteCode).toMatch(/^[2-9A-HJ-NP-Z]{3}-[2-9A-HJ-NP-Z]{3}$/);
      expect(res.body.child.name).toBe('Миша');

      const inviteCode = res.body.family.inviteCode;

      // Second user joins same family using invite code
      const joinRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Иван',
          role: 'Папа',
          email: 'ivan@example.com',
          password: 'password123',
          inviteCode,
        });

      expect(joinRes.status).toBe(201);
      expect(joinRes.body.family.id).toBe(res.body.family.id);
      expect(joinRes.body.child.name).toBe('Миша');
    });

    it('rejects registration with invalid invite code', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Кто-то',
          role: 'Другое',
          email: 'unknown@example.com',
          password: 'password123',
          inviteCode: 'INVALID-CODE',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('код приглашения');
    });
  });

  describe('Settings flow', () => {
    it('gets child settings with sanity validation', async () => {
      const res = await request(app)
        .get(`/api/settings?childId=${mamaChildId}`)
        .set('Authorization', `Bearer ${mamaToken}`);

      expect(res.status).toBe(200);
      expect(res.body.child.name).toBe('Сын');
      expect(res.body.settings.napsPerDay).toBe(3);
      expect(res.body.settings.wakeIntervalMinMinutes).toBe(150);
      expect(res.body.settings.wakeIntervalMaxMinutes).toBe(180);
      expect(res.body.settings.targetBedtime).toBe('20:30');
      expect(res.body.validation.isValid).toBe(true);
      expect(res.body.validation.status).toBe('valid');
      expect(res.body.family.inviteCode).toBe('7K4-Q9M');
    });

    it('updates child settings and returns updated sanity check', async () => {
      const res = await request(app)
        .put('/api/settings')
        .set('Authorization', `Bearer ${mamaToken}`)
        .send({
          childId: mamaChildId,
          childName: 'Лев',
          targetBedtime: '20:45',
        });

      expect(res.status).toBe(200);
      expect(res.body.child.name).toBe('Лев');
      expect(res.body.settings.targetBedtime).toBe('20:45');

      // Revert name back to 'Сын' and bedtime to '20:30' for further tests
      await request(app)
        .put('/api/settings')
        .set('Authorization', `Bearer ${mamaToken}`)
        .send({
          childId: mamaChildId,
          childName: 'Сын',
          targetBedtime: '20:30',
        });
    });
  });

  describe('Sleep tracking and status flow', () => {
    it('retrieves today awake state matching 01_today_awake mockup', async () => {
      // 2026-09-30 at 13:05, wake up was at 07:10, Nap 1 was 09:40-10:55
      const res = await request(app)
        .get(`/api/sleep/status?childId=${mamaChildId}&date=2026-09-30&currentTime=13:05`)
        .set('Authorization', `Bearer ${mamaToken}`);

      expect(res.status).toBe(200);
      expect(res.body.state).toBe('AWAKE');
      expect(res.body.schedule.lastWakeTime).toBe('10:55');
      expect(res.body.schedule.awakeDurationMinutes).toBe(130);
      expect(res.body.schedule.formattedAwakeDuration).toBe('2:10');
      expect(res.body.schedule.nextNap.targetStartTime).toBe('13:25');
      expect(res.body.schedule.formattedDaySleepProgress).toBe('1:15 / 3:20');
      expect(res.body.schedule.formattedRemainingNaps).toBe('ещё 2 из 3');
      expect(res.body.events.length).toBe(2); // WAKEUP + NAP 1
    });

    it('records fell-asleep action and transitions to SLEEPING (03_today_sleeping mockup)', async () => {
      // Mama records fell asleep at 13:22
      const res = await request(app)
        .post('/api/sleep/fell-asleep')
        .set('Authorization', `Bearer ${mamaToken}`)
        .send({
          childId: mamaChildId,
          time: '2026-09-30T13:22:00',
          source: 'NOW',
        });

      expect(res.status).toBe(200);
      expect(res.body.event.eventType).toBe('NAP');
      expect(res.body.event.napNumber).toBe(2);
      expect(res.body.event.isOngoing).toBe(true);
      expect(res.body.status.state).toBe('SLEEPING');
      expect(res.body.status.schedule.wakeDeadlineTime).toBe('14:52');
      expect(res.body.status.schedule.wakeDeadlineMessage).toContain('14:52');
    });

    it('prevents recording fell-asleep when child is already sleeping', async () => {
      const res = await request(app)
        .post('/api/sleep/fell-asleep')
        .set('Authorization', `Bearer ${mamaToken}`)
        .send({
          childId: mamaChildId,
          time: '2026-09-30T13:30:00',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('уже спит');
    });

    it('records woke-up action and updates event duration', async () => {
      // Papa records woke up at 14:47 (duration = 85m)
      const res = await request(app)
        .post('/api/sleep/woke-up')
        .set('Authorization', `Bearer ${mamaToken}`)
        .send({
          childId: mamaChildId,
          time: '2026-09-30T14:47:00',
          userName: 'Папа',
        });

      expect(res.status).toBe(200);
      expect(res.body.event.eventType).toBe('NAP');
      expect(res.body.event.durationMinutes).toBe(85);
      expect(res.body.event.isOngoing).toBe(false);
      expect(res.body.status.state).toBe('AWAKE');
      expect(res.body.status.schedule.lastWakeTime).toBe('14:47');
      expect(res.body.status.schedule.completedNapsCount).toBe(2);
      expect(res.body.status.schedule.remainingNapsCount).toBe(1);
    });

    it('records retroactive sleep event', async () => {
      const res = await request(app)
        .post('/api/sleep/retroactive')
        .set('Authorization', `Bearer ${mamaToken}`)
        .send({
          childId: mamaChildId,
          date: '2026-09-24',
          eventType: 'NAP',
          startTime: '10:00',
          endTime: '11:15',
          napNumber: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.event.date).toBe('2026-09-24');
      expect(res.body.event.durationMinutes).toBe(75);
      expect(res.body.event.formattedDuration).toBe('1:15');
    });

    it('deletes a sleep event by id', async () => {
      // First create a temporary event
      const createRes = await request(app)
        .post('/api/sleep/retroactive')
        .set('Authorization', `Bearer ${mamaToken}`)
        .send({
          childId: mamaChildId,
          date: '2026-09-24',
          eventType: 'NAP',
          startTime: '15:00',
          endTime: '15:45',
          napNumber: 2,
        });

      const eventId = createRes.body.event.id;

      // Delete it
      const deleteRes = await request(app)
        .delete(`/api/sleep/events/${eventId}?childId=${mamaChildId}`)
        .set('Authorization', `Bearer ${mamaToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // Deleting again should fail with 404
      const deleteAgain = await request(app)
        .delete(`/api/sleep/events/${eventId}?childId=${mamaChildId}`)
        .set('Authorization', `Bearer ${mamaToken}`);

      expect(deleteAgain.status).toBe(404);
    });

    it('PUT /api/sleep/events/:id updates start and end time and recalculates status', async () => {
      // 1. Get status for 2026-09-30 to find an event ID
      const statusRes = await request(app)
        .get(`/api/sleep/status?childId=${mamaChildId}&date=2026-09-30`)
        .set('Authorization', `Bearer ${mamaToken}`);
      expect(statusRes.status).toBe(200);
      const nap = statusRes.body.events.find((e: any) => e.eventType === 'NAP' && e.endTime);
      expect(nap).toBeDefined();

      // 2. Update the event
      const updateRes = await request(app)
        .put(`/api/sleep/events/${nap.id}`)
        .set('Authorization', `Bearer ${mamaToken}`)
        .send({
          childId: mamaChildId,
          startTime: '10:00',
          endTime: '11:30',
          eventType: 'NAP',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.event).toBeDefined();
      expect(updateRes.body.event.durationMinutes).toBe(90);
      expect(updateRes.body.event.formattedDuration).toContain('1:30');
      expect(updateRes.body.status).toBeDefined();
    });

    it('PUT /api/sleep/events/:id returns 404 for nonexistent event', async () => {
      const res = await request(app)
        .put('/api/sleep/events/nonexistent-id')
        .send({ startTime: '10:00' });
      expect(res.status).toBe(404);
    });
  });

  describe('Calendar month summary flow', () => {
    it('returns September 2026 calendar with metrics matching 04_calendar mockup', async () => {
      const res = await request(app)
        .get(`/api/calendar/month?childId=${mamaChildId}&year=2026&month=9`)
        .set('Authorization', `Bearer ${mamaToken}`);

      expect(res.status).toBe(200);
      expect(res.body.year).toBe(2026);
      expect(res.body.month).toBe(9);
      expect(res.body.targetDaySleepMinutes).toBe(200); // 3h 20m
      expect(res.body.days.length).toBe(30);

      // Day 29: 2026-09-29 from mockup
      // 3 naps (75m, 85m, 30m) = 190m = 3:10, diff = -10 min, bedtime = 20:35
      const day29 = res.body.days.find((d: any) => d.date === '2026-09-29');
      expect(day29).toBeDefined();
      expect(day29.dayNumber).toBe(29);
      expect(day29.napsCount).toBe(3);
      expect(day29.totalDaySleepMinutes).toBe(190);
      expect(day29.formattedTotalDaySleep).toBe('3:10');
      expect(day29.bedtime).toBe('20:35');
      expect(day29.wakeupTime).toBe('07:05');
      expect(day29.differenceFromNormMinutes).toBe(-10);
      expect(day29.formattedDifference).toBe('-10 мин');
      expect(day29.isNormMet).toBe(true); // 190 >= 200 - 15 (norm met tolerance)
    });
  });
});
