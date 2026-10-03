const CACHE_NAME = 'my-little-son-v3';

const STATIC_PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon.svg',
  '/logo.svg',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/apple-touch-icon-180x180.png',
  '/apple-touch-icon-180x180-precomposed.png',
  '/apple-touch-icon-167x167.png',
  '/apple-touch-icon-152x152.png',
  '/apple-touch-icon-120x120.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of STATIC_PRECACHE) {
        try {
          await cache.add(url);
        } catch (err) {
          // Precache failure for a single file should never fail SW installation
          console.warn('[SW] Non-critical precache warning for:', url, err);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never intercept non-GET requests or WebSockets
  if (request.method !== 'GET' || url.pathname.startsWith('/ws')) {
    return;
  }

  // 2. Network-first strategy for API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // 3. Network-first strategy for navigation (HTML documents)
  // Ensures fresh Vite bundle hashes on every deployment
  const isNavigation = request.mode === 'navigate' || request.destination === 'document';
  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            try {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put('/index.html', copy);
              }).catch(() => {});
            } catch (cloneErr) {
              console.warn('[SW] Could not clone navigation response:', cloneErr);
            }
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = (await caches.match(request)) || (await caches.match('/index.html'));
          if (cached) return cached;
          return fetch(request);
        })
    );
    return;
  }

  // 4. Cache-first strategy for static assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        const contentType = networkResponse.headers.get('content-type') || '';
        // Guard against HTML returned for missing scripts/stylesheets
        if (url.pathname.endsWith('.js') && contentType.includes('text/html')) {
          return new Response('/* missing script */', {
            status: 404,
            statusText: 'Not Found',
            headers: { 'Content-Type': 'application/javascript' },
          });
        }

        try {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          }).catch(() => {});
        } catch (cloneErr) {
          console.warn('[SW] Asset clone warning:', cloneErr);
        }

        return networkResponse;
      });
    })
  );
});
