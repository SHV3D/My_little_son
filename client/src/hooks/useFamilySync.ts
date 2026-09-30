import { useState, useEffect, useRef, useCallback } from 'react';
import { familySocket } from '../api/socket';
import {
  WsServerEvent,
  SleepStatusChangedPayload,
  SettingsUpdatedPayload,
} from '@shared/wsTypes';

export interface UseFamilySyncOptions {
  familyId?: string;
  role?: string;
  userId?: string;
  token?: string;
  onSleepStatusChanged?: (payload: SleepStatusChangedPayload) => void;
  onSettingsUpdated?: (payload: SettingsUpdatedPayload) => void;
  onPresenceChanged?: (onlineRoles: string[]) => void;
  onMessage?: (event: WsServerEvent) => void;
}

export interface UseFamilySyncResult {
  isConnected: boolean;
  onlineRoles: string[];
  isMomOnline: boolean;
  isDadOnline: boolean;
  sendMessage: (message: any) => void;
  reconnect: () => void;
}

export function useFamilySync(options: UseFamilySyncOptions = {}): UseFamilySyncResult {
  const {
    familyId,
    role,
    userId,
    token,
    onSleepStatusChanged,
    onSettingsUpdated,
    onPresenceChanged,
    onMessage,
  } = options;

  const [isConnected, setIsConnected] = useState<boolean>(familySocket.getIsConnected());
  const [onlineRoles, setOnlineRoles] = useState<string[]>(familySocket.getOnlineRoles());

  const onSleepStatusChangedRef = useRef(onSleepStatusChanged);
  onSleepStatusChangedRef.current = onSleepStatusChanged;

  const onSettingsUpdatedRef = useRef(onSettingsUpdated);
  onSettingsUpdatedRef.current = onSettingsUpdated;

  const onPresenceChangedRef = useRef(onPresenceChanged);
  onPresenceChangedRef.current = onPresenceChanged;

  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (familyId) {
      familySocket.joinFamily(familyId, role, userId, token);
    } else {
      familySocket.connect();
    }

    const unsubStatus = familySocket.onStatusChange((connected) => {
      setIsConnected(connected);
    });

    const unsubPresence = familySocket.onPresenceChange((roles) => {
      setOnlineRoles(roles);
      onPresenceChangedRef.current?.(roles);
    });

    const unsubMessage = familySocket.onMessage((event) => {
      onMessageRef.current?.(event);
      if (event.type === 'SLEEP_STATUS_CHANGED') {
        onSleepStatusChangedRef.current?.(event.payload);
      } else if (event.type === 'SETTINGS_UPDATED') {
        onSettingsUpdatedRef.current?.(event.payload);
      }
    });

    return () => {
      unsubStatus();
      unsubPresence();
      unsubMessage();
    };
  }, [familyId, role, userId, token]);

  const isMomOnline =
    isConnected &&
    onlineRoles.some((r) => r.toLowerCase() === 'мама' || r.toLowerCase() === 'mom');
  const isDadOnline =
    isConnected &&
    onlineRoles.some((r) => r.toLowerCase() === 'папа' || r.toLowerCase() === 'dad');

  const sendMessage = useCallback((msg: any) => {
    familySocket.send(msg);
  }, []);

  const reconnect = useCallback(() => {
    familySocket.connect();
  }, []);

  return {
    isConnected,
    onlineRoles,
    isMomOnline,
    isDadOnline,
    sendMessage,
    reconnect,
  };
}
