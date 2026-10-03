/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as svc from '../services/pushNotificationService';

describe('pushNotificationService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reports unsupported without serviceWorker/PushManager', () => {
    const orig = (globalThis as any).PushManager;
    delete (globalThis as any).PushManager;
    expect(svc.isPushSupported()).toBe(false);
    (globalThis as any).PushManager = orig;
  });

  it('enablePush subscribes and posts to server when granted', async () => {
    (globalThis as any).PushManager = function () {};
    const subscribe = vi.fn(async () => ({
      endpoint: 'e',
      toJSON: () => ({ endpoint: 'e', keys: { p256dh: 'p', auth: 'a' } }),
    }));
    (navigator as any).serviceWorker = {
      ready: Promise.resolve({
        pushManager: { getSubscription: async () => null, subscribe },
      }),
    };
    (globalThis as any).Notification = {
      requestPermission: async () => 'granted',
      permission: 'granted',
    };
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.includes('vapid') ? { key: 'BPUBLIC' } : { success: true }),
    }));
    (globalThis as any).fetch = fetchMock;

    const result = await svc.enablePush('jwt');

    expect(result).toBe('granted');
    expect(subscribe).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/push/subscribe'),
      expect.any(Object)
    );
  });

  it('enablePush returns denied when permission is not granted', async () => {
    (globalThis as any).PushManager = function () {};
    (navigator as any).serviceWorker = {
      ready: Promise.resolve({
        pushManager: { getSubscription: async () => null, subscribe: vi.fn() },
      }),
    };
    (globalThis as any).Notification = {
      requestPermission: async () => 'denied',
      permission: 'denied',
    };
    const result = await svc.enablePush('jwt');
    expect(result).toBe('denied');
  });

  it('enablePush returns unsupported when PushManager is missing', async () => {
    const orig = (globalThis as any).PushManager;
    delete (globalThis as any).PushManager;
    const result = await svc.enablePush('jwt');
    expect(result).toBe('unsupported');
    (globalThis as any).PushManager = orig;
  });

  it('isPushEnabled reflects localStorage flag set by enablePush', async () => {
    (globalThis as any).PushManager = function () {};
    const subscribe = vi.fn(async () => ({
      endpoint: 'e',
      toJSON: () => ({ endpoint: 'e', keys: { p256dh: 'p', auth: 'a' } }),
    }));
    (navigator as any).serviceWorker = {
      ready: Promise.resolve({
        pushManager: { getSubscription: async () => null, subscribe },
      }),
    };
    (globalThis as any).Notification = {
      requestPermission: async () => 'granted',
      permission: 'granted',
    };
    (globalThis as any).fetch = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.includes('vapid') ? { key: 'BPUBLIC' } : { success: true }),
    }));

    expect(svc.isPushEnabled()).toBe(false);
    await svc.enablePush('jwt');
    expect(svc.isPushEnabled()).toBe(true);
  });

  it('disablePush unsubscribes and posts to server, clearing the flag', async () => {
    localStorage.setItem('mls_push_enabled', 'true');
    const unsubscribe = vi.fn(async () => true);
    const existingSub = { endpoint: 'e', unsubscribe };
    (navigator as any).serviceWorker = {
      ready: Promise.resolve({
        pushManager: { getSubscription: async () => existingSub },
      }),
    };
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }));
    (globalThis as any).fetch = fetchMock;

    await svc.disablePush('jwt');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/push/unsubscribe'),
      expect.any(Object)
    );
    expect(unsubscribe).toHaveBeenCalled();
    expect(svc.isPushEnabled()).toBe(false);
  });
});
