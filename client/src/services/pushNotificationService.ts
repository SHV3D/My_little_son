export const PUSH_ENABLED_KEY = 'mls_push_enabled';

/**
 * Checks if the browser supports SW-based Web Push.
 */
export function isPushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof (globalThis as any).PushManager !== 'undefined'
  );
}

/**
 * Returns whether push notifications are enabled by the user in settings.
 */
export function isPushEnabled(): boolean {
  try {
    return localStorage.getItem(PUSH_ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * Requests notification permission, subscribes via the Service Worker's
 * PushManager (reusing an existing subscription if present), and registers
 * the subscription with the server.
 */
export async function enablePush(token: string): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!isPushSupported()) return 'unsupported';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  const keyRes = await fetch('/api/push/vapid-public-key');
  const { key } = await keyRes.json();

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    });
  }

  const json: any = sub.toJSON();
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });

  try {
    localStorage.setItem(PUSH_ENABLED_KEY, 'true');
  } catch {
    // Ignore storage restriction errors
  }
  return 'granted';
}

/**
 * Unsubscribes from push, informs the server, and clears the enabled flag.
 */
export async function disablePush(token: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
  } catch {
    // Ignore unsubscribe/network errors; still clear local flag below
  }
  try {
    localStorage.setItem(PUSH_ENABLED_KEY, 'false');
  } catch {
    // Ignore storage restriction errors
  }
}
