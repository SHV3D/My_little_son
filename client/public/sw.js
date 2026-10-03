const VERSION = 'mls-v1';
const CACHE = `mls-cache-${VERSION}`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // passthrough: cross-origin, API, websockets
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) {
    return;
  }

  // navigations: network-first, cache index as offline fallback only
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('/index.html', fresh.clone());
        return fresh;
      } catch (e) {
        const cache = await caches.open(CACHE);
        const cached = await cache.match('/index.html');
        return cached || Response.error();
      }
    })());
    return;
  }

  // static assets: stale-while-revalidate
  if (url.pathname.startsWith('/assets/') || /\.(png|svg|css|js|woff2?)$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const network = fetch(req).then((resp) => {
        if (resp && resp.status === 200) cache.put(req, resp.clone());
        return resp;
      }).catch(() => cached);
      return cached || network;
    })());
  }
});

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
