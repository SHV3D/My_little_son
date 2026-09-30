import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FamilySocket } from '../api/socket';

describe('FamilySocket client and presence handling', () => {
  let originalWebSocket: any;
  let mockSockets: any[] = [];

  class MockWs {
    url: string;
    readyState = 0;
    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: ((event: any) => void) | null = null;
    send = vi.fn();
    close = vi.fn(() => {
      this.readyState = 3;
      if (this.onclose) this.onclose();
    });

    constructor(url: string) {
      this.url = url;
      mockSockets.push(this);
    }
  }

  beforeEach(() => {
    mockSockets = [];
    originalWebSocket = globalThis.WebSocket;
    (globalThis as any).WebSocket = MockWs;
  });

  afterEach(() => {
    (globalThis as any).WebSocket = originalWebSocket;
  });

  it('resets onlineRoles and notifies presence listeners on disconnect', () => {
    const socket = new FamilySocket({ url: 'ws://localhost:9999/ws' });
    const presenceChanges: string[][] = [];
    socket.onPresenceChange((roles) => presenceChanges.push(roles));

    socket.connect();
    const wsInstance = mockSockets[0];
    wsInstance.readyState = 1;
    wsInstance.onopen();

    // Simulate receiving presence
    wsInstance.onmessage({
      data: JSON.stringify({
        type: 'FAMILY_PRESENCE',
        onlineRoles: ['Мама', 'Папа'],
      }),
    });

    expect(socket.getOnlineRoles()).toEqual(['Мама', 'Папа']);

    // Trigger disconnect via onerror
    wsInstance.onerror();

    // Presence should be cleared
    expect(socket.getOnlineRoles()).toEqual([]);
    expect(presenceChanges[presenceChanges.length - 1]).toEqual([]);
    socket.disconnect();
  });

  it('detaches ws event listeners and nulls ws on disconnect preventing duplicate handleDisconnect on onerror + onclose', () => {
    const socket = new FamilySocket({ url: 'ws://localhost:9999/ws' });
    let statusChangeCount = 0;
    socket.onStatusChange((connected) => {
      if (!connected) statusChangeCount++;
    });

    socket.connect();
    const wsInstance = mockSockets[0];
    wsInstance.readyState = 1;
    wsInstance.onopen();

    expect(wsInstance.onerror).not.toBeNull();
    expect(wsInstance.onclose).not.toBeNull();

    // Fire onerror
    wsInstance.onerror();

    // Listeners on the WS should now be detached (null)
    expect(wsInstance.onopen).toBeNull();
    expect(wsInstance.onerror).toBeNull();
    expect(wsInstance.onclose).toBeNull();
    expect(wsInstance.onmessage).toBeNull();

    // If onclose were fired manually, it shouldn't be callable via wsInstance.onclose
    expect(wsInstance.onclose).toBeNull();

    // Verify disconnect was processed
    expect(socket.getIsConnected()).toBe(false);

    socket.disconnect();
  });

  it('computes presence factoring in connection state and case-insensitive roles', () => {
    // Test helper mirroring the useFamilySync calculation:
    const calcPresence = (isConnected: boolean, onlineRoles: string[]) => ({
      isMomOnline:
        isConnected &&
        onlineRoles.some((r) => r.toLowerCase() === 'мама' || r.toLowerCase() === 'mom'),
      isDadOnline:
        isConnected &&
        onlineRoles.some((r) => r.toLowerCase() === 'папа' || r.toLowerCase() === 'dad'),
    });

    // When connected
    expect(calcPresence(true, ['Мама'])).toEqual({ isMomOnline: true, isDadOnline: false });
    expect(calcPresence(true, ['mom'])).toEqual({ isMomOnline: true, isDadOnline: false });
    expect(calcPresence(true, ['папа'])).toEqual({ isMomOnline: false, isDadOnline: true });
    expect(calcPresence(true, ['DAD'])).toEqual({ isMomOnline: false, isDadOnline: true });
    expect(calcPresence(true, ['МАМА', 'ПАПА'])).toEqual({ isMomOnline: true, isDadOnline: true });

    // When disconnected, presence must be false even if roles were present
    expect(calcPresence(false, ['Мама', 'Папа'])).toEqual({ isMomOnline: false, isDadOnline: false });
    expect(calcPresence(false, [])).toEqual({ isMomOnline: false, isDadOnline: false });
  });
});
