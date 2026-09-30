import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../services/authService';
import { getDb } from '../db/database';
import {
  WsClientMessage,
  WsServerEvent,
  SleepStatusChangedPayload,
  SettingsUpdatedPayload,
} from '@shared/wsTypes';

export interface ExtendedWebSocket extends WebSocket {
  isAlive?: boolean;
  familyId?: string;
  userId?: string;
  role?: string;
}

let wssInstance: WebSocketServer | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
const familyRooms = new Map<string, Set<ExtendedWebSocket>>();

export function getFamilyRooms(): Map<string, Set<ExtendedWebSocket>> {
  return familyRooms;
}

export function getFamilyIdForChild(childId: string): string | null {
  try {
    const db = getDb();
    const row = db.prepare('SELECT family_id FROM children WHERE id = ?').get(childId) as
      | { family_id: string }
      | undefined;
    return row?.family_id || null;
  } catch {
    return null;
  }
}

export function getOnlineRoles(familyId: string): string[] {
  const room = familyRooms.get(familyId);
  if (!room) return [];
  const roles = new Set<string>();
  for (const client of room) {
    if (client.readyState === WebSocket.OPEN && client.role) {
      roles.add(client.role);
    }
  }
  return Array.from(roles);
}

export function broadcastToFamily(familyId: string, event: WsServerEvent | { type: string; payload?: any; [key: string]: any }): void {
  const room = familyRooms.get(familyId);
  if (!room || room.size === 0) return;
  const messageStr = JSON.stringify(event);
  for (const client of room) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(messageStr);
      } catch (err) {
        console.error('Failed to send WS message to client:', err);
      }
    }
  }
}

export function broadcastPresence(familyId: string): void {
  const onlineRoles = getOnlineRoles(familyId);
  broadcastToFamily(familyId, {
    type: 'FAMILY_PRESENCE',
    onlineRoles,
    payload: { onlineRoles },
  });
}

function leaveFamily(ws: ExtendedWebSocket): void {
  const famId = ws.familyId;
  if (!famId) return;

  const room = familyRooms.get(famId);
  if (room) {
    room.delete(ws);
    if (room.size === 0) {
      familyRooms.delete(famId);
    } else {
      broadcastPresence(famId);
    }
  }
  ws.familyId = undefined;
}

function joinFamily(
  ws: ExtendedWebSocket,
  familyId: string,
  role: string = 'Мама',
  userId?: string
): void {
  if (ws.familyId && ws.familyId !== familyId) {
    leaveFamily(ws);
  }

  ws.familyId = familyId;
  ws.role = role;
  ws.userId = userId;

  if (!familyRooms.has(familyId)) {
    familyRooms.set(familyId, new Set());
  }
  familyRooms.get(familyId)!.add(ws);

  const onlineRoles = getOnlineRoles(familyId);

  try {
    ws.send(
      JSON.stringify({
        type: 'JOINED_FAMILY',
        familyId,
        role,
        userId,
        onlineRoles,
      })
    );
  } catch (err) {
    console.error('Failed to send JOINED_FAMILY to socket:', err);
  }

  broadcastPresence(familyId);
}

export function broadcastSleepStatusChanged(familyId: string, payload: SleepStatusChangedPayload): void {
  broadcastToFamily(familyId, {
    type: 'SLEEP_STATUS_CHANGED',
    payload,
  });
}

export function broadcastSettingsUpdated(familyId: string, payload: SettingsUpdatedPayload): void {
  broadcastToFamily(familyId, {
    type: 'SETTINGS_UPDATED',
    payload,
  });
}

export function setupWebSocketServer(server: http.Server): WebSocketServer {
  if (wssInstance) {
    return wssInstance;
  }

  const wss = new WebSocketServer({ server, path: '/ws' });
  wssInstance = wss;

  wss.on('connection', (ws: ExtendedWebSocket, req: http.IncomingMessage) => {
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Parse URL query parameters if present (e.g. ?token=... or ?familyId=...&role=...)
    try {
      const url = new URL(req.url || '', 'http://localhost');
      const token = url.searchParams.get('token');
      const familyId = url.searchParams.get('familyId');
      const role = url.searchParams.get('role');
      const userId = url.searchParams.get('userId');

      let resolvedFamilyId = familyId || '';
      let resolvedRole = role || '';
      let resolvedUserId = userId || '';

      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          if (decoded) {
            resolvedFamilyId = decoded.familyId || resolvedFamilyId;
            resolvedRole = decoded.role || resolvedRole;
            resolvedUserId = decoded.userId || resolvedUserId;
          }
        } catch {
          // Token verification failed, fallback to explicit params
        }
      }

      if (resolvedFamilyId) {
        joinFamily(ws, resolvedFamilyId, resolvedRole || 'Мама', resolvedUserId);
      }
    } catch {
      // URL parsing failed, proceed to message-based join
    }

    ws.on('message', (rawMessage: Buffer | string) => {
      ws.isAlive = true;
      let text = rawMessage.toString();

      if (text === 'PING') {
        try {
          ws.send(JSON.stringify({ type: 'PONG' }));
        } catch {}
        return;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        return;
      }

      const msg = parsed as WsClientMessage;

      if (msg.type === 'PING') {
        try {
          ws.send(JSON.stringify({ type: 'PONG' }));
        } catch {}
        return;
      }

      if (msg.type === 'PONG') {
        ws.isAlive = true;
        return;
      }

      if (msg.type === 'JOIN_FAMILY' || msg.type === 'CLIENT_JOIN_FAMILY') {
        let familyId = msg.familyId || '';
        let role = msg.role || '';
        let userId = msg.userId || '';

        if (msg.token) {
          try {
            const decoded = jwt.verify(msg.token, JWT_SECRET) as any;
            if (decoded) {
              familyId = decoded.familyId || familyId;
              role = decoded.role || role;
              userId = decoded.userId || userId;
            }
          } catch {
            ws.send(JSON.stringify({ type: 'ERROR', error: 'Неверный токен авторизации' }));
            return;
          }
        }

        if (!familyId) {
          ws.send(JSON.stringify({ type: 'ERROR', error: 'Не указан familyId' }));
          return;
        }

        joinFamily(ws, familyId, role || 'Мама', userId);
      }
    });

    ws.on('close', () => {
      leaveFamily(ws);
    });

    ws.on('error', () => {
      leaveFamily(ws);
    });
  });

  // Setup heartbeat interval (30 seconds)
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  heartbeatInterval = setInterval(() => {
    if (!wssInstance) return;
    for (const client of wssInstance.clients) {
      const extWs = client as ExtendedWebSocket;
      if (extWs.isAlive === false) {
        leaveFamily(extWs);
        extWs.terminate();
        continue;
      }
      extWs.isAlive = false;
      extWs.ping();
    }
  }, 30000);

  // Do not let heartbeat keep Node process open
  heartbeatInterval.unref();

  wss.on('close', () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    familyRooms.clear();
    wssInstance = null;
  });

  return wss;
}

export function closeWebSocketServer(): Promise<void> {
  return new Promise((resolve) => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (wssInstance) {
      for (const client of wssInstance.clients) {
        client.terminate();
      }
      familyRooms.clear();
      const current = wssInstance;
      wssInstance = null;
      current.close(() => {
        resolve();
      });
    } else {
      resolve();
    }
  });
}
