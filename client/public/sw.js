// Minimal service worker — PUSH ONLY. It intentionally does NOT register a
// `fetch` handler. On iOS a navigation-intercepting service worker can wedge
// repeat loads (the Cache API stalls in standalone/WKWebView), which made the
// app "open once, then hang forever on reload". Web Push needs only the push
// and notificationclick handlers below — no fetch interception required.
const VERSION = 'mls-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Purge every cache left by older SW versions that cached navigations/HTML.
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// NOTE: no 'fetch' listener on purpose. All navigations and assets go straight
// to the network, so the SW can never stall page loads.

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'My little son', body: event.data && event.data.text() }; }
  const title = data.title || 'My little son';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
    tag: data.tag,
    renotify: !!data.tag,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if ('focus' in client) { client.navigate(target); return client.focus(); }
    }
    return self.clients.openWindow(target);
  })());
});
