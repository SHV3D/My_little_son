// Minimal service worker — PUSH ONLY, zero Cache API usage.
// Why so bare: on iOS standalone (WKWebView) the Cache Storage API can hang,
// leaving the SW stuck in "activating" and wedging page loads for the whole
// origin (app opened once in Safari, then the PWA — and Safari — hung). This SW
// touches NO cache storage and installs NO fetch handler, so it can never stall
// a navigation. It exists solely to receive Web Push.
const VERSION = 'mls-v3';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Only claim clients. No Cache API calls — nothing here can hang.
  event.waitUntil(self.clients.claim());
});

// No 'fetch' listener on purpose. Navigations/assets always go to the network.

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
