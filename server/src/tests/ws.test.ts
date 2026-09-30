import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AddressInfo } from 'net';
import WebSocket from 'ws';
import request from 'supertest';
import { server, app } from '../index';
import { closeWebSocketServer, getFamilyIdForChild } from '../ws/wsServer';
import { initDatabase, setDb } from '../db/database';
import { JWT_SECRET } from '../services/authService';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';

function connectClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForMessage(
  ws: WebSocket,
  predicate: (msg: any) => boolean,
  timeoutMs = 3000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeListener('message', onMsg);
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for matching message`));
    }, timeoutMs);

    function onMsg(data: any) {
      try {
        const parsed = JSON.parse(data.toString());
        if (predicate(parsed)) {
          clearTimeout(timer);
          ws.removeListener('message', onMsg);
          resolve(parsed);
        }
      } catch {}
    }

    ws.on('message', onMsg);
  });
}

function captureMessages(ws: WebSocket): any[] {
  const messages: any[] = [];
  ws.on('message', (data) => {
    try {
      messages.push(JSON.parse(data.toString()));
    } catch {}
  });
  return messages;
}

describe('WebSocket Server and Family Synchronization', () => {
  let db: Database.Database;
  let serverPort: number;
  const openClients: WebSocket[] = [];

  beforeAll(async () => {
    db = initDatabase(':memory:');
    setDb(db);

    // Create a second family for cross-family isolation tests
    db.prepare('INSERT INTO families (id, name, invite_code) VALUES (?, ?, ?)').run(
      'family-2',
      'Вторая семья',
      '999-ZZZ'
    );
    db.prepare('INSERT INTO children (id, family_id, name) VALUES (?, ?, ?)').run(
      'child-family-2',
      'family-2',
      'Малыш 2'
    );
    db.prepare(`
      INSERT INTO child_settings (
        id, child_id, naps_per_day, wake_interval_min_minutes, wake_interval_max_minutes,
        total_wake_minutes, total_day_sleep_minutes, target_bedtime, typical_wakeup_time
      ) VALUES (?, ?, 2, 180, 210, 600, 180, '20:30', '07:00')
    `).run('settings-family-2', 'child-family-2');

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as AddressInfo;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    for (const ws of openClients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    await closeWebSocketServer();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    if (db) {
      db.close();
    }
  });

  it('client can connect and join a family channel, receiving confirmation and presence', async () => {
    const ws = await connectClient(serverPort);
    openClients.push(ws);

    const presencePromise = waitForMessage(ws, (m) => m.type === 'FAMILY_PRESENCE');
    const joinedPromise = waitForMessage(ws, (m) => m.type === 'JOINED_FAMILY');

    ws.send(
      JSON.stringify({
        type: 'JOIN_FAMILY',
        familyId: 'demo-family-1',
        role: 'Мама',
        userId: 'demo-user-mama',
      })
    );

    const joinedMsg = await joinedPromise;
    expect(joinedMsg.type).toBe('JOINED_FAMILY');
    expect(joinedMsg.familyId).toBe('demo-family-1');
    expect(joinedMsg.role).toBe('Мама');

    const presenceMsg = await presencePromise;
    expect(presenceMsg.type).toBe('FAMILY_PRESENCE');
    expect(presenceMsg.onlineRoles).toContain('Мама');
  });

  it('second member joining the family triggers updated presence to both members', async () => {
    const wsMama = openClients[0];
    const wsPapa = await connectClient(serverPort);
    openClients.push(wsPapa);

    const mamaPresencePromise = waitForMessage(
      wsMama,
      (m) => m.type === 'FAMILY_PRESENCE' && m.onlineRoles.includes('Папа')
    );
    const papaPresencePromise = waitForMessage(
      wsPapa,
      (m) => m.type === 'FAMILY_PRESENCE' && m.onlineRoles.includes('Папа')
    );

    wsPapa.send(
      JSON.stringify({
        type: 'JOIN_FAMILY',
        familyId: 'demo-family-1',
        role: 'Папа',
        userId: 'demo-user-papa',
      })
    );

    const mamaPresence = await mamaPresencePromise;
    const papaPresence = await papaPresencePromise;

    expect(mamaPresence.onlineRoles).toContain('Мама');
    expect(mamaPresence.onlineRoles).toContain('Папа');
    expect(papaPresence.onlineRoles).toContain('Мама');
    expect(papaPresence.onlineRoles).toContain('Папа');
  });

  it('client in a different family is isolated from family 1 events', async () => {
    const wsFamily2 = await connectClient(serverPort);
    openClients.push(wsFamily2);

    const presencePromise = waitForMessage(wsFamily2, (m) => m.type === 'FAMILY_PRESENCE');

    wsFamily2.send(
      JSON.stringify({
        type: 'JOIN_FAMILY',
        familyId: 'family-2',
        role: 'Мама',
        userId: 'user-family-2',
      })
    );

    const presence = await presencePromise;
    expect(presence.onlineRoles).toEqual(['Мама']);
    expect(presence.onlineRoles).not.toContain('Папа');
  });

  it('POST /api/sleep/fell-asleep broadcasts SLEEP_STATUS_CHANGED to family 1, not family 2', async () => {
    const wsMama = openClients[0];
    const wsFamily2 = openClients[2];

    const family2Messages = captureMessages(wsFamily2);

    const sleepChangePromise = waitForMessage(
      wsMama,
      (m) => m.type === 'SLEEP_STATUS_CHANGED' && m.payload?.action === 'FELL_ASLEEP'
    );

    const res = await request(app)
      .post('/api/sleep/fell-asleep')
      .send({
        childId: 'demo-child-1',
        time: '10:00',
        source: 'NOW',
        userName: 'Мама',
      });

    expect(res.status).toBe(200);

    const wsEvent = await sleepChangePromise;
    expect(wsEvent.type).toBe('SLEEP_STATUS_CHANGED');
    expect(wsEvent.payload.childId).toBe('demo-child-1');
    expect(wsEvent.payload.action).toBe('FELL_ASLEEP');

    // Give time to ensure family-2 does not receive the message
    await new Promise((resolve) => setTimeout(resolve, 50));
    const receivedByFamily2 = family2Messages.some((m) => m.type === 'SLEEP_STATUS_CHANGED');
    expect(receivedByFamily2).toBe(false);
  });

  it('POST /api/sleep/woke-up broadcasts SLEEP_STATUS_CHANGED with action WOKE_UP', async () => {
    const wsMama = openClients[0];

    const wokeUpPromise = waitForMessage(
      wsMama,
      (m) => m.type === 'SLEEP_STATUS_CHANGED' && m.payload?.action === 'WOKE_UP'
    );

    const res = await request(app)
      .post('/api/sleep/woke-up')
      .send({
        childId: 'demo-child-1',
        time: '11:15',
        source: 'NOW',
        userName: 'Мама',
      });

    expect(res.status).toBe(200);

    const wsEvent = await wokeUpPromise;
    expect(wsEvent.type).toBe('SLEEP_STATUS_CHANGED');
    expect(wsEvent.payload.action).toBe('WOKE_UP');
  });

  it('PUT /api/settings broadcasts SETTINGS_UPDATED to family members', async () => {
    const wsMama = openClients[0];
    const wsFamily2 = openClients[2];
    const family2Messages = captureMessages(wsFamily2);

    const settingsUpdatePromise = waitForMessage(
      wsMama,
      (m) => m.type === 'SETTINGS_UPDATED' && m.payload?.childId === 'demo-child-1'
    );

    const res = await request(app)
      .put('/api/settings')
      .send({
        childId: 'demo-child-1',
        napsPerDay: 2,
      });

    expect(res.status).toBe(200);

    const wsEvent = await settingsUpdatePromise;
    expect(wsEvent.type).toBe('SETTINGS_UPDATED');
    expect(wsEvent.payload.childId).toBe('demo-child-1');

    await new Promise((resolve) => setTimeout(resolve, 50));
    const receivedByFamily2 = family2Messages.some((m) => m.type === 'SETTINGS_UPDATED');
    expect(receivedByFamily2).toBe(false);
  });

  it('responds to PING message with PONG', async () => {
    const ws = openClients[0];
    const pongPromise = waitForMessage(ws, (m) => m.type === 'PONG');

    ws.send(JSON.stringify({ type: 'PING' }));

    const pong = await pongPromise;
    expect(pong.type).toBe('PONG');
  });

  it('disconnecting a client updates family presence for remaining members', async () => {
    const wsMama = openClients[0];
    const wsPapa = openClients[1];

    const presencePromise = waitForMessage(
      wsMama,
      (m) => m.type === 'FAMILY_PRESENCE' && !m.onlineRoles.includes('Папа')
    );

    wsPapa.close();

    const presence = await presencePromise;
    expect(presence.onlineRoles).toContain('Мама');
    expect(presence.onlineRoles).not.toContain('Папа');
  });

  it('getFamilyIdForChild returns familyId for valid child and null for non-existent child (no LIMIT 1 fallback)', () => {
    expect(getFamilyIdForChild('demo-child-1')).toBe('demo-family-1');
    expect(getFamilyIdForChild('non-existent-child-id')).toBeNull();
  });

  it('prioritizes JWT token claims over client-provided familyId in JOIN_FAMILY message', async () => {
    const ws = await connectClient(serverPort);
    openClients.push(ws);

    const token = jwt.sign(
      {
        userId: 'jwt-user-papa',
        familyId: 'demo-family-1',
        role: 'Папа',
      },
      JWT_SECRET
    );

    const joinedPromise = waitForMessage(ws, (m) => m.type === 'JOINED_FAMILY');

    // Attempt to spoof familyId to 'family-2'
    ws.send(
      JSON.stringify({
        type: 'JOIN_FAMILY',
        familyId: 'family-2',
        role: 'Бабушка',
        token,
      })
    );

    const joinedMsg = await joinedPromise;
    expect(joinedMsg.familyId).toBe('demo-family-1');
    expect(joinedMsg.role).toBe('Папа');
    expect(joinedMsg.userId).toBe('jwt-user-papa');
  });

  it('prioritizes JWT token claims over query parameters during WS connection', async () => {
    const token = jwt.sign(
      {
        userId: 'jwt-user-query',
        familyId: 'demo-family-1',
        role: 'Мама',
      },
      JWT_SECRET
    );

    // Pass token for demo-family-1, but query param familyId=family-2
    const ws = new WebSocket(
      `ws://localhost:${serverPort}/ws?token=${encodeURIComponent(token)}&familyId=family-2&role=Дедушка`
    );
    const joinedPromise = waitForMessage(ws, (m) => m.type === 'JOINED_FAMILY');
    await new Promise((resolve, reject) => {
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });
    openClients.push(ws);

    const joinedMsg = await joinedPromise;

    expect(joinedMsg.familyId).toBe('demo-family-1');
    expect(joinedMsg.role).toBe('Мама');
    expect(joinedMsg.userId).toBe('jwt-user-query');
  });
});
