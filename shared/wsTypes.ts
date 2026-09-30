export type WsClientMessage =
  | {
      type: 'JOIN_FAMILY' | 'CLIENT_JOIN_FAMILY';
      familyId?: string;
      role?: string;
      userId?: string;
      token?: string;
    }
  | { type: 'PING' }
  | { type: 'PONG' };

export interface SleepStatusChangedPayload {
  childId: string;
  action: 'FELL_ASLEEP' | 'WOKE_UP' | 'RETROACTIVE' | 'DELETE_EVENT' | string;
  timestamp: string;
  result?: any;
  eventId?: string;
}

export interface SettingsUpdatedPayload {
  childId: string;
  settings?: any;
  timestamp: string;
}

export interface FamilyPresencePayload {
  onlineRoles: string[];
}

export type WsServerEvent =
  | {
      type: 'JOINED_FAMILY';
      familyId: string;
      role?: string;
      userId?: string;
      onlineRoles: string[];
    }
  | {
      type: 'FAMILY_PRESENCE';
      onlineRoles: string[];
      payload?: FamilyPresencePayload;
    }
  | {
      type: 'SLEEP_STATUS_CHANGED';
      payload: SleepStatusChangedPayload;
    }
  | {
      type: 'SETTINGS_UPDATED';
      payload: SettingsUpdatedPayload;
    }
  | { type: 'PONG' }
  | { type: 'ERROR'; error: string };
