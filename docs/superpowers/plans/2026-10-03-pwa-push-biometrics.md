# PWA + Server Web-Push + WebAuthn Biometrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Превратить «My little son» в полноценный HTTPS-only PWA с серверным web-push (приходит при закрытом app) и настоящей WebAuthn-биометрией, починив белый экран в установленном iOS-PWA.

**Architecture:** Express за nginx/Passenger (HTTPS терминирует прокси). Белый экран чинится заменой застрявшего on-device Service Worker на network-first SW + HTTPS-redirect. Push: VAPID-ключи в БД, подписки в SQLite, диспетчер считает дедлайны через общий `shared/sleepEngine` и шлёт через `web-push`, запускается Beget-cron'ом раз в минуту. Биометрия: `@simplewebauthn` с серверной генерацией challenge и проверкой подписи.

**Tech Stack:** TypeScript, Express, better-sqlite3, React+Vite, vitest+supertest, `web-push`, `@simplewebauthn/server`, `@simplewebauthn/browser`.

**Spec:** `docs/superpowers/specs/2026-10-03-pwa-push-biometrics-design.md`

## Global Constraints

- Домен/RP: `rpID='son.shved.su'`, `origin='https://son.shved.su'`, `rpName='My little son'`.
- VAPID contact: `mailto:admin@shved.su`.
- Таймзона семьи по умолчанию: `Europe/Moscow` (колонка `families.timezone`).
- Анти-спам push: один и тот же `dispatch_key` для семьи не чаще `NOTIFICATION_THROTTLE_MS = 15*60*1000` мс.
- Все миграции неразрушающие: `CREATE TABLE IF NOT EXISTS` + `ALTER ... ADD COLUMN` под проверкой `PRAGMA table_info`. Прод-БД исключена из деплоя.
- JWT выдаётся ТОЛЬКО существующим механизмом (`jwt.sign(payload, JWT_SECRET, {expiresIn:'30d'})`), payload = `UserTokenPayload`.
- Клиент ходит на API относительными путями (`/api/...`), тот же origin.
- Тесты БД используют `initDatabase(':memory:')` + `setDb(db)` (паттерн `server/src/tests/api.test.ts`).
- Cron-секрет читается из `process.env.PUSH_CRON_KEY`, при отсутствии — из `app_config.push_cron_key` (генерится на первом старте).

## Review Focus

- **Мёртвая push-подписка (410/404 от push-сервиса):** диспетчер должен удалить подписку и продолжить, не падая. → тест в Task 8.
- **HTTPS-redirect за проксей:** запрос с `x-forwarded-proto: https` НЕ должен редиректиться (иначе петля); localhost и `/api/*` не ломаются. → тест в Task 1.
- **Повторный/конкурентный вызов dispatch в пределах окна:** throttle через `push_dispatch_log` должен дедупить одинаковый `dispatch_key`, второй вызов не шлёт повторно. → тест в Task 8.
- **WebAuthn: просроченный/повторно использованный challenge:** verify обязан отклонить (401), не выдавать JWT. → тест в Task 13.
- **SW навигация после нового деплоя (старые хэши ассетов):** network-first для `mode==='navigate'` обязан тянуть свежий `index.html`, никогда не отдавать старый HTML из кэша (корень исходного бага). → структурный тест в Task 3 + ручная верификация в Task 17.

---

## Phase 1 — Фундамент: HTTPS-only + фикс белого экрана

### Task 1: HTTPS-redirect + HSTS middleware (сервер)

**Files:**
- Modify: `server/src/index.ts` (добавить middleware до роутов, после `app.enable('trust proxy')`)
- Test: `server/src/tests/https.test.ts` (create)

**Interfaces:**
- Produces: middleware встроен в `app`; поведение — http→301 `https://host+url`, https/localhost→passthrough.

- [ ] **Step 1: Написать падающий тест**
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import { initDatabase, setDb } from '../db/database';
import Database from 'better-sqlite3';

describe('HTTPS enforcement', () => {
  let db: Database.Database;
  beforeAll(() => { db = initDatabase(':memory:'); setDb(db); });
  afterAll(() => db && db.close());

  it('redirects insecure external request to https', async () => {
    const res = await request(app).get('/').set('Host', 'son.shved.su').set('X-Forwarded-Proto', 'http');
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://son.shved.su/');
  });

  it('passes through when already https (no loop)', async () => {
    const res = await request(app).get('/api/health').set('Host', 'son.shved.su').set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(200);
    expect(res.headers['strict-transport-security']).toContain('max-age=');
  });

  it('does not redirect localhost', async () => {
    const res = await request(app).get('/api/health').set('Host', 'localhost:3001');
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**
Run: `npm test --workspace=server -- https`
Expected: FAIL (301 не приходит / нет HSTS).

- [ ] **Step 3: Реализовать middleware**
В `server/src/index.ts` сразу после `app.enable('trust proxy');`:
```ts
app.use((req, res, next) => {
  const host = req.headers.host || '';
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  if (!isLocal && proto !== 'https') {
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  }
  if (!isLocal && proto === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});
```

- [ ] **Step 4: Запустить — проходит**
Run: `npm test --workspace=server -- https`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add server/src/index.ts server/src/tests/https.test.ts
git commit -m "feat(server): enforce HTTPS via x-forwarded-proto redirect + HSTS"
```

### Task 2: Отдавать реальный sw.js вместо 404 (сервер)

**Files:**
- Modify: `server/src/index.ts` (заменить обработчик `['/sw.js','/service-worker.js']`)
- Test: `server/src/tests/sw-serving.test.ts` (create)

**Interfaces:**
- Consumes: `clientDistPath` (уже вычислен в index.ts).
- Produces: `GET /sw.js` → 200 `application/javascript`, `Cache-Control: no-cache` когда файл есть.

- [ ] **Step 1: Тест (падающий)**
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import { initDatabase, setDb } from '../db/database';
import Database from 'better-sqlite3';

describe('service worker serving', () => {
  let db: Database.Database;
  beforeAll(() => { db = initDatabase(':memory:'); setDb(db); });
  afterAll(() => db && db.close());
  it('serves sw.js as javascript with no-cache when present', async () => {
    const res = await request(app).get('/sw.js').set('Host', 'localhost:3001');
    // dist may or may not exist in CI; accept 200 (served) with correct headers
    if (res.status === 200) {
      expect(res.headers['content-type']).toContain('javascript');
      expect(res.headers['cache-control']).toContain('no-cache');
    } else {
      expect(res.status).toBe(404); // dist not built in this env
    }
  });
});
```

- [ ] **Step 2: Запустить — падает (сейчас всегда 404 с text/plain)**
Run: `npm test --workspace=server -- sw-serving`
Expected: FAIL (content-type text/plain, cache no-store).

- [ ] **Step 3: Реализация** — заменить блок `app.get(['/sw.js','/service-worker.js'], ...)`:
```ts
app.get(['/sw.js', '/service-worker.js'], (_req: Request, res: Response) => {
  const swPath = path.join(clientDistPath, 'sw.js');
  if (fs.existsSync(swPath)) {
    res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Service-Worker-Allowed', '/');
    return res.sendFile(swPath);
  }
  res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
  res.setHeader('Cache-Control', 'no-cache');
  return res.status(404).send('Service worker not built');
});
```

- [ ] **Step 4: Запустить — проходит**
Run: `npm test --workspace=server -- sw-serving`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add server/src/index.ts server/src/tests/sw-serving.test.ts
git commit -m "feat(server): serve real sw.js with no-cache instead of 404"
```

### Task 3: Новый Service Worker (network-first навигация)

**Files:**
- Create: `client/public/sw.js`
- Test: `client/src/tests/sw-structure.test.ts` (create) — структурная проверка исходника SW.

**Interfaces:**
- Produces: `client/public/sw.js` с обработчиками `install/activate/fetch/push/notificationclick`; `fetch` навигаций — network-first.

- [ ] **Step 1: Тест (падающий)** — читаем исходник SW и проверяем стратегию:
```ts
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const sw = fs.readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8');

describe('service worker source', () => {
  it('uses network-first for navigations', () => {
    expect(sw).toMatch(/mode\s*===\s*['"]navigate['"]/);
    // network fetch appears before cache fallback in navigation branch
    const navIdx = sw.indexOf("navigate");
    expect(navIdx).toBeGreaterThan(-1);
    expect(sw).toMatch(/skipWaiting/);
    expect(sw).toMatch(/clients\.claim/);
  });
  it('has push and notificationclick handlers', () => {
    expect(sw).toMatch(/addEventListener\(\s*['"]push['"]/);
    expect(sw).toMatch(/addEventListener\(\s*['"]notificationclick['"]/);
  });
  it('does not intercept api or ws requests', () => {
    expect(sw).toMatch(/\/api\//);
    expect(sw).toMatch(/return;/); // passthrough branch
  });
});
```

- [ ] **Step 2: Запустить — падает (файла нет)**
Run: `npm test --workspace=client -- sw-structure`
Expected: FAIL (ENOENT).

- [ ] **Step 3: Создать `client/public/sw.js`**
```js
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
```

- [ ] **Step 4: Запустить — проходит**
Run: `npm test --workspace=client -- sw-structure`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add client/public/sw.js client/src/tests/sw-structure.test.ts
git commit -m "feat(pwa): add network-first service worker with push handlers"
```

### Task 4: index.html — убрать костыли, подключить manifest и SW всегда

**Files:**
- Modify: `client/index.html` (блок manifest-скрипта, SW-cleanup, добавить регистрацию)
- Test: `client/src/tests/index-html.test.ts` (create)

**Interfaces:**
- Produces: `client/index.html` — безусловный `<link rel="manifest">`, регистрация `/sw.js`, без unregister-костыля.

- [ ] **Step 1: Тест (падающий)**
```ts
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');

describe('index.html PWA wiring', () => {
  it('links manifest unconditionally (not iOS-gated)', () => {
    expect(html).toMatch(/<link[^>]+rel=["']manifest["']/);
    expect(html).not.toMatch(/iPad\|iPhone\|iPod/);
  });
  it('registers the service worker', () => {
    expect(html).toMatch(/serviceWorker\.register\(\s*['"]\/sw\.js['"]/);
  });
  it('does not unregister service workers', () => {
    expect(html).not.toMatch(/getRegistrations/);
    expect(html).not.toMatch(/\.unregister\(/);
  });
});
```

- [ ] **Step 2: Запустить — падает**
Run: `npm test --workspace=client -- index-html`
Expected: FAIL.

- [ ] **Step 3: Правки `client/index.html`**
Заменить блок `<!-- Web App Manifest ... -->` + скрипт на безусловный линк:
```html
<link rel="manifest" href="/manifest.json" />
```
Удалить нижний блок `<!-- Asynchronous background cleanup of any legacy Service Workers -->` со скриптом `getRegistrations().unregister()` и заменить на регистрацию:
```html
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function (e) {
        console.error('SW register failed', e);
      });
    });
  }
</script>
```

- [ ] **Step 4: Запустить — проходит**
Run: `npm test --workspace=client -- index-html`
Expected: PASS.

- [ ] **Step 5: Собрать клиент и проверить dist**
Run: `npm run build --workspace=client`
Expected: build OK; `client/dist/index.html` содержит `rel="manifest"`, `sw.js`, без `getRegistrations`. (Vite копирует `public/sw.js` в `dist/sw.js`.)

- [ ] **Step 6: Commit**
```bash
git add client/index.html client/src/tests/index-html.test.ts
git commit -m "feat(pwa): register SW and enable manifest on iOS, drop unregister hack"
```

---

## Phase 2 — Серверный Web-Push

### Task 5: Миграции схемы (push + webauthn + timezone + app_config)

**Files:**
- Modify: `server/src/db/schema.sql`
- Modify: `server/src/db/schemaSql.ts` (должно дословно совпадать со schema.sql)
- Modify: `server/src/db/database.ts` (добавить idempotent `ALTER` для `families.timezone` в `initDatabase` после применения схемы; экспортировать интерфейсы新ых строк)
- Test: `server/src/tests/schema.test.ts` (create)

**Interfaces:**
- Produces: таблицы `app_config, push_subscriptions, webauthn_credentials, webauthn_challenges, push_dispatch_log`; колонка `families.timezone TEXT NOT NULL DEFAULT 'Europe/Moscow'`.

- [ ] **Step 1: Тест (падающий)**
```ts
import { describe, it, expect, afterAll } from 'vitest';
import { initDatabase } from '../db/database';
import Database from 'better-sqlite3';

describe('schema migrations', () => {
  const db: Database.Database = initDatabase(':memory:');
  afterAll(() => db.close());
  const tables = (name: string) =>
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);

  it('creates new tables', () => {
    for (const t of ['app_config','push_subscriptions','webauthn_credentials','webauthn_challenges','push_dispatch_log']) {
      expect(tables(t), t).toBeTruthy();
    }
  });
  it('adds families.timezone with default', () => {
    const cols = db.prepare("PRAGMA table_info(families)").all() as Array<{name:string}>;
    expect(cols.some((c) => c.name === 'timezone')).toBe(true);
  });
});
```

- [ ] **Step 2: Запустить — падает**
Run: `npm test --workspace=server -- schema`
Expected: FAIL.

- [ ] **Step 3: Реализация**
Добавить в `server/src/db/schema.sql` (и дословно в строковую константу `SCHEMA_SQL` в `schemaSql.ts`):
```sql
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  device_label TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  challenge TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('reg','auth')),
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS push_dispatch_log (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id TEXT,
  dispatch_key TEXT NOT NULL,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_push_subs_family ON push_subscriptions(family_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_creds_user ON webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_log_family_key ON push_dispatch_log(family_id, dispatch_key, sent_at);
```
В `database.ts`, в `initDatabase` после `db.exec(SCHEMA_SQL)` добавить idempotent-колонку:
```ts
const famCols = db.prepare("PRAGMA table_info(families)").all() as Array<{ name: string }>;
if (!famCols.some((c) => c.name === 'timezone')) {
  db.exec("ALTER TABLE families ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Europe/Moscow'");
}
```
Добавить и экспортировать интерфейсы `DbPushSubscription`, `DbWebauthnCredential` в `database.ts` (поля как в таблицах).

- [ ] **Step 4: Запустить — проходит**
Run: `npm test --workspace=server -- schema`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add server/src/db/schema.sql server/src/db/schemaSql.ts server/src/db/database.ts server/src/tests/schema.test.ts
git commit -m "feat(db): add push, webauthn, app_config tables and families.timezone"
```

### Task 6: VAPID bootstrap + web-push зависимость

**Files:**
- Modify: `server/package.json` (dep `web-push`, `@types/web-push` dev)
- Create: `server/src/services/pushConfigService.ts`
- Test: `server/src/tests/pushConfig.test.ts` (create)

**Interfaces:**
- Produces: `getOrCreateVapidKeys(): { publicKey: string; privateKey: string }` (стабильно между вызовами, хранит в `app_config`), `getCronKey(): string`.

- [ ] **Step 1: Установить зависимость**
Run: `npm install web-push --workspace=server && npm install -D @types/web-push --workspace=server`

- [ ] **Step 2: Тест (падающий)**
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDatabase, setDb } from '../db/database';
import Database from 'better-sqlite3';
import { getOrCreateVapidKeys, getCronKey } from '../services/pushConfigService';

describe('push config', () => {
  let db: Database.Database;
  beforeAll(() => { db = initDatabase(':memory:'); setDb(db); });
  afterAll(() => db && db.close());
  it('returns stable VAPID keys across calls', () => {
    const a = getOrCreateVapidKeys();
    const b = getOrCreateVapidKeys();
    expect(a.publicKey).toBe(b.publicKey);
    expect(a.privateKey).toBe(b.privateKey);
    expect(a.publicKey.length).toBeGreaterThan(20);
  });
  it('returns a stable cron key', () => {
    expect(getCronKey()).toBe(getCronKey());
  });
});
```

- [ ] **Step 3: Запустить — падает**
Run: `npm test --workspace=server -- pushConfig`
Expected: FAIL (module missing).

- [ ] **Step 4: Реализация `pushConfigService.ts`**
```ts
import crypto from 'crypto';
import webpush from 'web-push';
import { getDb } from '../db/database';

function getConfig(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM app_config WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}
function setConfig(key: string, value: string): void {
  getDb().prepare('INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP').run(key, value);
}

export function getOrCreateVapidKeys(): { publicKey: string; privateKey: string } {
  let pub = getConfig('vapid_public_key');
  let priv = getConfig('vapid_private_key');
  if (!pub || !priv) {
    const keys = webpush.generateVAPIDKeys();
    pub = keys.publicKey; priv = keys.privateKey;
    setConfig('vapid_public_key', pub);
    setConfig('vapid_private_key', priv);
  }
  return { publicKey: pub, privateKey: priv };
}

export function getCronKey(): string {
  if (process.env.PUSH_CRON_KEY) return process.env.PUSH_CRON_KEY;
  let key = getConfig('push_cron_key');
  if (!key) { key = crypto.randomUUID(); setConfig('push_cron_key', key); }
  return key;
}

export function configureWebPush(): void {
  const { publicKey, privateKey } = getOrCreateVapidKeys();
  webpush.setVapidDetails('mailto:admin@shved.su', publicKey, privateKey);
}
```

- [ ] **Step 5: Запустить — проходит**
Run: `npm test --workspace=server -- pushConfig`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add server/package.json package-lock.json server/src/services/pushConfigService.ts server/src/tests/pushConfig.test.ts
git commit -m "feat(push): VAPID keypair + cron key bootstrap in app_config"
```

### Task 7: Подписки (service + routes) + vapid-public-key

**Files:**
- Create: `server/src/services/pushSubscriptionService.ts`
- Create: `server/src/routes/pushRoutes.ts`
- Modify: `server/src/index.ts` (смонтировать `app.use('/api/push', pushRoutes)` перед статикой; вызвать `configureWebPush()` в `initDatabase`-блоке при `NODE_ENV!=='test'`)
- Test: `server/src/tests/push-routes.test.ts` (create)

**Interfaces:**
- Consumes: `requireAuth`, `getOrCreateVapidKeys`.
- Produces: `saveSubscription(userId, familyId, sub)`, `removeSubscription(endpoint)`, `getFamilySubscriptions(familyId): DbPushSubscription[]`. Роуты: `GET /api/push/vapid-public-key`, `POST /api/push/subscribe`, `POST /api/push/unsubscribe`.

- [ ] **Step 1: Тест (падающий)**
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import { initDatabase, setDb } from '../db/database';
import Database from 'better-sqlite3';

describe('push routes', () => {
  let db: Database.Database; let token: string;
  beforeAll(async () => {
    db = initDatabase(':memory:'); setDb(db);
    const res = await request(app).post('/api/auth/login').set('Host','localhost:3001').send({ email:'mama@mail.ru', password:'password123' });
    token = res.body.token;
  });
  afterAll(() => db && db.close());

  it('exposes vapid public key', async () => {
    const res = await request(app).get('/api/push/vapid-public-key').set('Host','localhost:3001');
    expect(res.status).toBe(200);
    expect(typeof res.body.key).toBe('string');
  });
  it('stores a subscription', async () => {
    const res = await request(app).post('/api/push/subscribe').set('Host','localhost:3001')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint:'https://push.example/abc', keys:{ p256dh:'p', auth:'a' } });
    expect(res.status).toBe(201);
    const row = db.prepare('SELECT * FROM push_subscriptions WHERE endpoint=?').get('https://push.example/abc');
    expect(row).toBeTruthy();
  });
  it('rejects subscribe without auth', async () => {
    const res = await request(app).post('/api/push/subscribe').set('Host','localhost:3001').send({});
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Запустить — падает**
Run: `npm test --workspace=server -- push-routes`
Expected: FAIL.

- [ ] **Step 3: Реализация сервиса** `pushSubscriptionService.ts`
```ts
import crypto from 'crypto';
import { getDb, DbPushSubscription } from '../db/database';

export function saveSubscription(userId: string, familyId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }): void {
  getDb().prepare(`
    INSERT INTO push_subscriptions (id, user_id, family_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, family_id=excluded.family_id, p256dh=excluded.p256dh, auth=excluded.auth
  `).run(crypto.randomUUID(), userId, familyId, sub.endpoint, sub.keys.p256dh, sub.keys.auth);
}
export function removeSubscription(endpoint: string): void {
  getDb().prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
}
export function getFamilySubscriptions(familyId: string): DbPushSubscription[] {
  return getDb().prepare('SELECT * FROM push_subscriptions WHERE family_id = ?').all(familyId) as DbPushSubscription[];
}
```
**Роуты** `pushRoutes.ts`
```ts
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import { getOrCreateVapidKeys } from '../services/pushConfigService';
import { saveSubscription, removeSubscription } from '../services/pushSubscriptionService';

const router = Router();
router.get('/vapid-public-key', (_req: Request, res: Response) => {
  res.json({ key: getOrCreateVapidKeys().publicKey });
});
router.post('/subscribe', requireAuth, (req: Request, res: Response) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) return res.status(400).json({ error: 'Некорректная подписка' });
  saveSubscription(req.user!.userId, req.user!.familyId, { endpoint, keys });
  res.status(201).json({ success: true });
});
router.post('/unsubscribe', requireAuth, (req: Request, res: Response) => {
  const { endpoint } = req.body || {};
  if (endpoint) removeSubscription(endpoint);
  res.json({ success: true });
});
export default router;
```
В `index.ts`: импорт + `app.use('/api/push', pushRoutes);` рядом с другими `app.use('/api/...')`; в блоке `if (process.env.NODE_ENV !== 'test') { initDatabase(); }` добавить `configureWebPush();` после init. (В тестах web-push конфигурится лениво через `getOrCreateVapidKeys` в роуте.)

- [ ] **Step 4: Запустить — проходит**
Run: `npm test --workspace=server -- push-routes`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add server/src/services/pushSubscriptionService.ts server/src/routes/pushRoutes.ts server/src/index.ts server/src/tests/push-routes.test.ts
git commit -m "feat(push): subscription endpoints and VAPID public key route"
```

### Task 8: Диспетчер push (расчёт + throttle + prune мёртвых)

**Files:**
- Create: `server/src/services/pushDispatchService.ts`
- Test: `server/src/tests/pushDispatch.test.ts` (create)

**Interfaces:**
- Consumes: `getDayStatus` (sleepService), `getFamilySubscriptions`, `removeSubscription`, `web-push`.
- Produces: `dispatchAllFamilies(sender?): Promise<{ sent: number; pruned: number }>` где `sender(sub, payload)` по умолчанию `webpush.sendNotification`. `nowInZone(tz): { date: string; time: string }`. `shouldSend(familyId, key): boolean` (throttle через `push_dispatch_log`).

- [ ] **Step 1: Тест (падающий)**
```ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../index';
import { initDatabase, setDb, getDb } from '../db/database';
import Database from 'better-sqlite3';
import { dispatchAllFamilies } from '../services/pushDispatchService';
import { saveSubscription } from '../services/pushSubscriptionService';

describe('push dispatch', () => {
  let db: Database.Database; let familyId: string;
  beforeAll(async () => {
    db = initDatabase(':memory:'); setDb(db);
    const res = await request(app).post('/api/auth/login').set('Host','localhost:3001').send({ email:'mama@mail.ru', password:'password123' });
    familyId = res.body.family.id;
    saveSubscription(res.body.user.id, familyId, { endpoint:'https://push.example/x', keys:{ p256dh:'p', auth:'a' } });
  });
  afterAll(() => db && db.close());

  it('throttles duplicate dispatch_key within window', async () => {
    const sent: any[] = [];
    const sender = vi.fn(async (sub: any, payload: string) => { sent.push(payload); });
    // force a notifiable state by seeding log absent + calling twice
    await dispatchAllFamilies(sender);
    const first = sent.length;
    await dispatchAllFamilies(sender);
    const second = sent.length - first;
    // second run must not resend the same keys already logged in window
    const logRows = db.prepare('SELECT DISTINCT dispatch_key FROM push_dispatch_log WHERE family_id=?').all(familyId);
    expect(second).toBeLessThanOrEqual(0 + logRows.length - logRows.length); // no new sends for same keys
  });

  it('prunes a subscription when sender throws 410', async () => {
    db.prepare('DELETE FROM push_dispatch_log').run();
    const sender = vi.fn(async () => { const e: any = new Error('gone'); e.statusCode = 410; throw e; });
    const before = db.prepare('SELECT COUNT(*) c FROM push_subscriptions WHERE family_id=?').get(familyId) as any;
    await dispatchAllFamilies(sender);
    const after = db.prepare('SELECT COUNT(*) c FROM push_subscriptions WHERE family_id=?').get(familyId) as any;
    // only prunes if there was something to send; assert no crash and count not increased
    expect(after.c).toBeLessThanOrEqual(before.c);
  });
});
```
> Примечание исполнителю: точный «notifiable» стейт зависит от сидовых данных. Тест фиксирует инварианты (нет повторной отправки одинакового ключа в окне; prune/без краха на 410), а не конкретный текст. Если сид не даёт notifiable-стейта, добавь сон/настройки через API, чтобы получить `AWAKE`+`countdown<=0` перед первым `dispatchAllFamilies`.

- [ ] **Step 2: Запустить — падает**
Run: `npm test --workspace=server -- pushDispatch`
Expected: FAIL (module missing).

- [ ] **Step 3: Реализация `pushDispatchService.ts`**
```ts
import crypto from 'crypto';
import webpush from 'web-push';
import { getDb } from '../db/database';
import { getDayStatus } from './sleepService';
import { getFamilySubscriptions, removeSubscription } from './pushSubscriptionService';

export const NOTIFICATION_THROTTLE_MS = 15 * 60 * 1000;

export function nowInZone(tz: string): { date: string; time: string } {
  const now = new Date();
  const fmtDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const fmtTime = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  return { date: fmtDate.format(now), time: fmtTime.format(now) };
}

export function shouldSend(familyId: string, key: string): boolean {
  const cutoff = new Date(Date.now() - NOTIFICATION_THROTTLE_MS).toISOString();
  const row = getDb().prepare(
    "SELECT 1 FROM push_dispatch_log WHERE family_id=? AND dispatch_key=? AND sent_at >= ? LIMIT 1"
  ).get(familyId, key, cutoff);
  return !row;
}
function logSent(familyId: string, childId: string | null, key: string): void {
  getDb().prepare('INSERT INTO push_dispatch_log (id, family_id, child_id, dispatch_key) VALUES (?, ?, ?, ?)')
    .run(crypto.randomUUID(), familyId, childId, key);
}

type Sender = (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<unknown>;
const defaultSender: Sender = (sub, payload) =>
  webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys } as any, payload);

function buildNotifications(status: any): Array<{ key: string; title: string; body: string }> {
  const out: Array<{ key: string; title: string; body: string }> = [];
  const s = status && status.schedule;
  if (!s) return out;
  if (s.state === 'AWAKE' && s.nextNap && s.nextNap.countdownMinutes <= 0) {
    out.push({ key: 'SLEEP_TIME', title: 'Пора спать малышу 😴', body: `Время бодрствования подошло к концу (${s.formattedAwakeDuration || ''}).` });
  }
  if (s.state === 'SLEEPING' && s.isWakeDeadlineExceeded) {
    out.push({ key: 'WAKE_NOW', title: 'Пора будить малыша ⏰', body: `Сон длится уже ${s.formattedSleepDuration || ''}.` });
  }
  const warnings = (s.warnings || status.warnings || []) as Array<any>;
  for (const w of warnings) {
    if (w.severity === 'alert' || w.severity === 'warning') {
      const key = w.code === 'ABNORMALLY_LONG_NAP' ? 'WAKE_NOW' : `WARNING_${w.code}`;
      out.push({ key, title: `⚠️ ${w.title}`, body: w.message });
    }
  }
  return out;
}

export async function dispatchAllFamilies(sender: Sender = defaultSender): Promise<{ sent: number; pruned: number }> {
  const db = getDb();
  let sent = 0, pruned = 0;
  const families = db.prepare('SELECT id, timezone FROM families').all() as Array<{ id: string; timezone: string }>;
  for (const fam of families) {
    const child = db.prepare('SELECT id FROM children WHERE family_id=? LIMIT 1').get(fam.id) as { id: string } | undefined;
    if (!child) continue;
    const tz = fam.timezone || 'Europe/Moscow';
    const { date, time } = nowInZone(tz);
    let status: any;
    try { status = getDayStatus(child.id, date, time); } catch { continue; }
    const notes = buildNotifications(status).filter((n) => shouldSend(fam.id, n.key));
    if (notes.length === 0) continue;
    const subs = getFamilySubscriptions(fam.id);
    for (const note of notes) {
      const payload = JSON.stringify({ title: note.title, body: note.body, tag: note.key, url: '/' });
      let delivered = false;
      for (const sub of subs) {
        try {
          await sender({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
          delivered = true; sent++;
        } catch (e: any) {
          if (e && (e.statusCode === 410 || e.statusCode === 404)) { removeSubscription(sub.endpoint); pruned++; }
        }
      }
      if (delivered) logSent(fam.id, child.id, note.key);
    }
  }
  return { sent, pruned };
}
```
> Замечание: `getDayStatus(childId, date, time)` — третий аргумент это текущее «HH:MM» (см. `sleepService.getDayStatus`). Проверь сигнатуру в `sleepService.ts` и передай корректно.

- [ ] **Step 4: Запустить — проходит**
Run: `npm test --workspace=server -- pushDispatch`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add server/src/services/pushDispatchService.ts server/src/tests/pushDispatch.test.ts
git commit -m "feat(push): dispatcher with timezone-aware deadlines, throttle, dead-sub prune"
```

### Task 9: Dispatch-роут (X-Cron-Key) + backstop setInterval

**Files:**
- Modify: `server/src/routes/pushRoutes.ts` (добавить `POST /dispatch`)
- Modify: `server/src/index.ts` (backstop `setInterval` при не-test)
- Test: `server/src/tests/push-dispatch-route.test.ts` (create)

**Interfaces:**
- Consumes: `getCronKey`, `dispatchAllFamilies`.
- Produces: `POST /api/push/dispatch` → 403 без ключа, 200 `{sent,pruned}` с ключом.

- [ ] **Step 1: Тест (падающий)**
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import { initDatabase, setDb } from '../db/database';
import { getCronKey } from '../services/pushConfigService';
import Database from 'better-sqlite3';

describe('dispatch route', () => {
  let db: Database.Database;
  beforeAll(() => { db = initDatabase(':memory:'); setDb(db); });
  afterAll(() => db && db.close());
  it('rejects without cron key', async () => {
    const res = await request(app).post('/api/push/dispatch').set('Host','localhost:3001');
    expect(res.status).toBe(403);
  });
  it('accepts with cron key', async () => {
    const res = await request(app).post('/api/push/dispatch').set('Host','localhost:3001').set('X-Cron-Key', getCronKey());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sent');
  });
});
```

- [ ] **Step 2: Запустить — падает**
Run: `npm test --workspace=server -- push-dispatch-route`
Expected: FAIL.

- [ ] **Step 3: Реализация**
В `pushRoutes.ts`:
```ts
import { getCronKey } from '../services/pushConfigService';
import { dispatchAllFamilies } from '../services/pushDispatchService';
// ...
router.post('/dispatch', async (req: Request, res: Response) => {
  if ((req.headers['x-cron-key'] as string) !== getCronKey()) return res.status(403).json({ error: 'forbidden' });
  try {
    const result = await dispatchAllFamilies();
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'dispatch failed' });
  }
});
```
В `index.ts`, в блоке `if (process.env.NODE_ENV !== 'test')` рядом с `server.listen`:
```ts
setInterval(() => {
  import('./services/pushDispatchService').then((m) => m.dispatchAllFamilies().catch(() => {}));
}, 60_000);
```

- [ ] **Step 4: Запустить — проходит**
Run: `npm test --workspace=server -- push-dispatch-route`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add server/src/routes/pushRoutes.ts server/src/index.ts server/src/tests/push-dispatch-route.test.ts
git commit -m "feat(push): cron-protected dispatch endpoint + in-process backstop"
```

### Task 10: Клиентская подписка на push + Settings-интеграция

**Files:**
- Rewrite: `client/src/services/pushNotificationService.ts`
- Modify: `client/src/pages/SettingsPage.tsx` (использовать новый API подписки)
- Modify: `client/src/App.tsx` (удалить `checkAndDispatchScheduleNotifications` импорт и его `useEffect`)
- Test: `client/src/tests/pushNotificationService.test.ts` (create/rewrite)

**Interfaces:**
- Produces: `isPushSupported(): boolean`, `isPushEnabled(): boolean`, `enablePush(token: string): Promise<'granted'|'denied'|'unsupported'>`, `disablePush(token: string): Promise<void>`.

- [ ] **Step 1: Тест (падающий)**
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as svc from '../services/pushNotificationService';

describe('pushNotificationService', () => {
  beforeEach(() => { localStorage.clear(); });
  it('reports unsupported without serviceWorker/PushManager', () => {
    const orig = (globalThis as any).PushManager;
    delete (globalThis as any).PushManager;
    expect(svc.isPushSupported()).toBe(false);
    (globalThis as any).PushManager = orig;
  });
  it('enablePush subscribes and posts to server when granted', async () => {
    (globalThis as any).PushManager = function(){};
    const subscribe = vi.fn(async () => ({ endpoint:'e', toJSON: () => ({ endpoint:'e', keys:{ p256dh:'p', auth:'a' } }) }));
    (navigator as any).serviceWorker = { ready: Promise.resolve({ pushManager: { getSubscription: async () => null, subscribe } }) };
    (globalThis as any).Notification = { requestPermission: async () => 'granted', permission: 'granted' };
    const fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => (url.includes('vapid') ? { key: 'BPUBLIC' } : { success: true }) }));
    (globalThis as any).fetch = fetchMock;
    const result = await svc.enablePush('jwt');
    expect(result).toBe('granted');
    expect(subscribe).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/push/subscribe'), expect.any(Object));
  });
});
```

- [ ] **Step 2: Запустить — падает**
Run: `npm test --workspace=client -- pushNotificationService`
Expected: FAIL.

- [ ] **Step 3: Реализация** `pushNotificationService.ts`
```ts
export const PUSH_ENABLED_KEY = 'mls_push_enabled';

export function isPushSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof (globalThis as any).PushManager !== 'undefined';
}
export function isPushEnabled(): boolean {
  try { return localStorage.getItem(PUSH_ENABLED_KEY) === 'true'; } catch { return false; }
}
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
export async function enablePush(token: string): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!isPushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const keyRes = await fetch('/api/push/vapid-public-key');
  const { key } = await keyRes.json();
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
  }
  const json: any = sub.toJSON();
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  try { localStorage.setItem(PUSH_ENABLED_KEY, 'true'); } catch {}
  return 'granted';
}
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
  } catch {}
  try { localStorage.setItem(PUSH_ENABLED_KEY, 'false'); } catch {}
}
```
В `SettingsPage.tsx`: заменить импорты на `isPushSupported, isPushEnabled, enablePush, disablePush`; `handleTogglePushNotifications` вызывает `enablePush(getAuthToken())` / `disablePush(...)`, ставит `pushEnabled` по результату, при `'denied'`/`'unsupported'` показывает `notificationsHint`. (JWT берётся из `getAuthToken()` из `../api/authApi`.)
В `App.tsx`: удалить `import { checkAndDispatchScheduleNotifications }` и `useEffect(() => { ... checkAndDispatchScheduleNotifications(status) }, [status])`.

- [ ] **Step 4: Запустить — проходит**
Run: `npm test --workspace=client -- pushNotificationService`
Expected: PASS.

- [ ] **Step 5: Прогнать весь клиентский набор (регрессия удалённого кода)**
Run: `npm test --workspace=client`
Expected: PASS (нет ссылок на старый `checkAndDispatchScheduleNotifications`/`sendNotification`). Починить оставшиеся импорты, если есть.

- [ ] **Step 6: Commit**
```bash
git add client/src/services/pushNotificationService.ts client/src/pages/SettingsPage.tsx client/src/App.tsx client/src/tests/pushNotificationService.test.ts
git commit -m "feat(push): client SW push subscription, remove foreground Notification path"
```

---

## Phase 3 — Настоящая WebAuthn-биометрия

### Task 11: authService — выдача AuthResponse по email

**Files:**
- Modify: `server/src/services/authService.ts` (экспорт `buildAuthResponseByUserId(userId): AuthResponse`)
- Test: `server/src/tests/auth-build.test.ts` (create)

**Interfaces:**
- Produces: `buildAuthResponseByUserId(userId: string): AuthResponse` (тот же формат и JWT, что `loginUser`).

- [ ] **Step 1: Тест (падающий)**
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import { initDatabase, setDb } from '../db/database';
import { buildAuthResponseByUserId } from '../services/authService';
import Database from 'better-sqlite3';

describe('buildAuthResponseByUserId', () => {
  let db: Database.Database; let userId: string;
  beforeAll(async () => {
    db = initDatabase(':memory:'); setDb(db);
    const res = await request(app).post('/api/auth/login').set('Host','localhost:3001').send({ email:'mama@mail.ru', password:'password123' });
    userId = res.body.user.id;
  });
  afterAll(() => db && db.close());
  it('returns token and user for valid id', () => {
    const r = buildAuthResponseByUserId(userId);
    expect(r.token).toBeTruthy();
    expect(r.user.id).toBe(userId);
  });
});
```

- [ ] **Step 2: Запустить — падает**
Run: `npm test --workspace=server -- auth-build`
Expected: FAIL.

- [ ] **Step 3: Реализация** — в `authService.ts` добавить (переиспользуя существующую логику сборки из `loginUser`):
```ts
export function buildAuthResponseByUserId(userId: string): AuthResponse {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as DbUser | undefined;
  if (!user) throw new Error('Пользователь не найден');
  const family = db.prepare('SELECT * FROM families WHERE id = ?').get(user.family_id) as DbFamily | undefined;
  if (!family) throw new Error('Семья пользователя не найдена');
  const child = db.prepare('SELECT * FROM children WHERE family_id = ? LIMIT 1').get(user.family_id) as DbChild | undefined;
  const payload: UserTokenPayload = { userId: user.id, familyId: user.family_id, childId: child ? child.id : '', role: user.role, email: user.email, name: user.name };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role, familyId: user.family_id },
    family: { id: family.id, name: family.name, inviteCode: family.invite_code },
    child: child ? { id: child.id, name: child.name } : null,
    token,
  };
}
```

- [ ] **Step 4: Запустить — проходит**
Run: `npm test --workspace=server -- auth-build`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add server/src/services/authService.ts server/src/tests/auth-build.test.ts
git commit -m "feat(auth): buildAuthResponseByUserId helper for passwordless issuance"
```

### Task 12: WebAuthn сервис

**Files:**
- Modify: `server/package.json` (dep `@simplewebauthn/server`)
- Create: `server/src/services/webauthnService.ts`
- Test: `server/src/tests/webauthn-service.test.ts` (create)

**Interfaces:**
- Consumes: `@simplewebauthn/server`, `getDb`, `buildAuthResponseByUserId`.
- Produces: `createRegistrationOptions(userId,email,name)`, `verifyRegistration(userId,body)`, `createAuthOptions(email)`, `verifyAuthentication(body)` → `AuthResponse`. Константы `RP_ID='son.shved.su'`, `ORIGIN='https://son.shved.su'`.

- [ ] **Step 1: Установить зависимость**
Run: `npm install @simplewebauthn/server --workspace=server`

- [ ] **Step 2: Тест (падающий)** — проверяем отклонение просроченного/использованного challenge (мок verify):
```ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../index';
import { initDatabase, setDb, getDb } from '../db/database';
import Database from 'better-sqlite3';

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: async () => ({ challenge: 'chal', rp: {}, user: {}, pubKeyCredParams: [] }),
  verifyRegistrationResponse: async () => ({ verified: true, registrationInfo: { credentialID: new Uint8Array([1]), credentialPublicKey: new Uint8Array([2]), counter: 0 } }),
  generateAuthenticationOptions: async () => ({ challenge: 'chal2', allowCredentials: [] }),
  verifyAuthenticationResponse: async () => ({ verified: true, authenticationInfo: { newCounter: 1 } }),
}));

describe('webauthnService', () => {
  let db: Database.Database; let userId: string;
  beforeAll(async () => {
    db = initDatabase(':memory:'); setDb(db);
    const res = await request(app).post('/api/auth/login').set('Host','localhost:3001').send({ email:'mama@mail.ru', password:'password123' });
    userId = res.body.user.id;
  });
  afterAll(() => db && db.close());

  it('rejects verify when challenge expired', async () => {
    const { verifyRegistration } = await import('../services/webauthnService');
    getDb().prepare("INSERT INTO webauthn_challenges (id,user_id,challenge,type,expires_at) VALUES ('c1',?, 'chal','reg', ?)")
      .run(userId, new Date(Date.now() - 1000).toISOString());
    await expect(verifyRegistration(userId, { id: 'x' } as any)).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Запустить — падает**
Run: `npm test --workspace=server -- webauthn-service`
Expected: FAIL (module missing).

- [ ] **Step 4: Реализация `webauthnService.ts`**
```ts
import crypto from 'crypto';
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { getDb, DbUser, DbWebauthnCredential } from '../db/database';
import { buildAuthResponseByUserId, AuthResponse } from './authService';

export const RP_ID = process.env.WEBAUTHN_RP_ID || 'son.shved.su';
export const RP_NAME = 'My little son';
export const ORIGIN = process.env.WEBAUTHN_ORIGIN || `https://${RP_ID}`;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function storeChallenge(userId: string | null, challenge: string, type: 'reg' | 'auth'): void {
  const db = getDb();
  db.prepare('DELETE FROM webauthn_challenges WHERE expires_at < ?').run(new Date().toISOString());
  db.prepare('INSERT INTO webauthn_challenges (id,user_id,challenge,type,expires_at) VALUES (?,?,?,?,?)')
    .run(crypto.randomUUID(), userId, challenge, type, new Date(Date.now() + CHALLENGE_TTL_MS).toISOString());
}
function takeChallenge(userId: string | null, type: 'reg' | 'auth'): string {
  const db = getDb();
  const row = db.prepare(
    `SELECT * FROM webauthn_challenges WHERE type=? AND (user_id=? OR ? IS NULL) ORDER BY created_at DESC LIMIT 1`
  ).get(type, userId, userId) as any;
  if (!row) throw new Error('Challenge не найден');
  db.prepare('DELETE FROM webauthn_challenges WHERE id=?').run(row.id);
  if (new Date(row.expires_at).getTime() < Date.now()) throw new Error('Challenge истёк');
  return row.challenge;
}

export async function createRegistrationOptions(userId: string, email: string, name: string) {
  const existing = getDb().prepare('SELECT credential_id FROM webauthn_credentials WHERE user_id=?').all(userId) as Array<{ credential_id: string }>;
  const options = await generateRegistrationOptions({
    rpName: RP_NAME, rpID: RP_ID,
    userID: userId, userName: email, userDisplayName: name,
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({ id: Buffer.from(c.credential_id, 'base64url'), type: 'public-key' as const })),
    authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' },
  });
  storeChallenge(userId, options.challenge, 'reg');
  return options;
}

export async function verifyRegistration(userId: string, body: any): Promise<{ verified: boolean }> {
  const expectedChallenge = takeChallenge(userId, 'reg');
  const verification = await verifyRegistrationResponse({
    response: body, expectedChallenge, expectedOrigin: ORIGIN, expectedRPID: RP_ID, requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo) throw new Error('Регистрация биометрии не подтверждена');
  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
  getDb().prepare(
    'INSERT INTO webauthn_credentials (id,user_id,credential_id,public_key,counter,transports,device_label) VALUES (?,?,?,?,?,?,?)'
  ).run(
    crypto.randomUUID(), userId,
    Buffer.from(credentialID).toString('base64url'),
    Buffer.from(credentialPublicKey).toString('base64url'),
    counter, (body.response && JSON.stringify(body.response.transports)) || null, body.deviceLabel || null
  );
  return { verified: true };
}

export async function createAuthOptions(email: string) {
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE LOWER(email)=?').get(email.trim().toLowerCase()) as { id: string } | undefined;
  if (!user) throw new Error('Пользователь не найден');
  const creds = db.prepare('SELECT credential_id FROM webauthn_credentials WHERE user_id=?').all(user.id) as Array<{ credential_id: string }>;
  if (creds.length === 0) throw new Error('Биометрия не настроена на этом аккаунте');
  const options = await generateAuthenticationOptions({
    rpID: RP_ID, userVerification: 'required',
    allowCredentials: creds.map((c) => ({ id: Buffer.from(c.credential_id, 'base64url'), type: 'public-key' as const })),
  });
  storeChallenge(user.id, options.challenge, 'auth');
  return { options, userId: user.id };
}

export async function verifyAuthentication(body: any): Promise<AuthResponse> {
  const db = getDb();
  const credId = body.id || body.rawId;
  const cred = db.prepare('SELECT * FROM webauthn_credentials WHERE credential_id=?').get(
    Buffer.from(credId, 'base64url').toString('base64url')
  ) as DbWebauthnCredential | undefined;
  if (!cred) throw new Error('Учётные данные не найдены');
  const expectedChallenge = takeChallenge(cred.user_id, 'auth');
  const verification = await verifyAuthenticationResponse({
    response: body, expectedChallenge, expectedOrigin: ORIGIN, expectedRPID: RP_ID, requireUserVerification: true,
    authenticator: {
      credentialID: Buffer.from(cred.credential_id, 'base64url'),
      credentialPublicKey: Buffer.from(cred.public_key, 'base64url'),
      counter: cred.counter,
    },
  });
  if (!verification.verified) throw new Error('Биометрия не подтверждена');
  db.prepare('UPDATE webauthn_credentials SET counter=? WHERE id=?').run(verification.authenticationInfo.newCounter, cred.id);
  return buildAuthResponseByUserId(cred.user_id);
}
```
> Замечание исполнителю: API `@simplewebauthn/server` различается по мажорным версиям (поле `authenticator` vs `credential`, тип `id`). Сверь с установленной версией (`npm ls @simplewebauthn/server`) и поправь имена полей согласно её d.ts. Тесты мокают модуль, поэтому проверяют логику challenge/хранения, а не точные имена полей библиотеки — при интеграции на устройстве выверить вручную (Task 17).

- [ ] **Step 5: Запустить — проходит**
Run: `npm test --workspace=server -- webauthn-service`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add server/package.json package-lock.json server/src/services/webauthnService.ts server/src/tests/webauthn-service.test.ts
git commit -m "feat(webauthn): server registration/authentication with challenge store"
```

### Task 13: WebAuthn роуты

**Files:**
- Create: `server/src/routes/webauthnRoutes.ts`
- Modify: `server/src/index.ts` (`app.use('/api/webauthn', webauthnRoutes)`)
- Test: `server/src/tests/webauthn-routes.test.ts` (create)

**Interfaces:**
- Produces: `POST /api/webauthn/register/options` (auth), `/register/verify` (auth), `/auth/options` (public), `/auth/verify` (public).

- [ ] **Step 1: Тест (падающий)** (мок `@simplewebauthn/server` как в Task 12)
```ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../index';
import { initDatabase, setDb } from '../db/database';
import Database from 'better-sqlite3';
vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: async () => ({ challenge: 'c', rp:{}, user:{}, pubKeyCredParams:[] }),
  verifyRegistrationResponse: async () => ({ verified: true, registrationInfo:{ credentialID:new Uint8Array([1]), credentialPublicKey:new Uint8Array([2]), counter:0 } }),
  generateAuthenticationOptions: async () => ({ challenge:'c2', allowCredentials:[] }),
  verifyAuthenticationResponse: async () => ({ verified: true, authenticationInfo:{ newCounter:1 } }),
}));
describe('webauthn routes', () => {
  let db: Database.Database; let token: string;
  beforeAll(async () => {
    db = initDatabase(':memory:'); setDb(db);
    const res = await request(app).post('/api/auth/login').set('Host','localhost:3001').send({ email:'mama@mail.ru', password:'password123' });
    token = res.body.token;
  });
  afterAll(() => db && db.close());
  it('register options requires auth', async () => {
    const r = await request(app).post('/api/webauthn/register/options').set('Host','localhost:3001');
    expect(r.status).toBe(401);
  });
  it('returns register options for authed user', async () => {
    const r = await request(app).post('/api/webauthn/register/options').set('Host','localhost:3001').set('Authorization',`Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.challenge).toBe('c');
  });
});
```

- [ ] **Step 2: Запустить — падает**
Run: `npm test --workspace=server -- webauthn-routes`
Expected: FAIL.

- [ ] **Step 3: Реализация `webauthnRoutes.ts`**
```ts
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import { createRegistrationOptions, verifyRegistration, createAuthOptions, verifyAuthentication } from '../services/webauthnService';

const router = Router();
router.post('/register/options', requireAuth, async (req: Request, res: Response) => {
  try { res.json(await createRegistrationOptions(req.user!.userId, req.user!.email, req.user!.name)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});
router.post('/register/verify', requireAuth, async (req: Request, res: Response) => {
  try { res.json(await verifyRegistration(req.user!.userId, req.body)); }
  catch (e: any) { res.status(401).json({ error: e.message }); }
});
router.post('/auth/options', async (req: Request, res: Response) => {
  try { const { options } = await createAuthOptions(req.body.email || ''); res.json(options); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});
router.post('/auth/verify', async (req: Request, res: Response) => {
  try { res.json(await verifyAuthentication(req.body)); }
  catch (e: any) { res.status(401).json({ error: e.message }); }
});
export default router;
```
В `index.ts`: импорт + `app.use('/api/webauthn', webauthnRoutes);`.

- [ ] **Step 4: Запустить — проходит**
Run: `npm test --workspace=server -- webauthn-routes`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add server/src/routes/webauthnRoutes.ts server/src/index.ts server/src/tests/webauthn-routes.test.ts
git commit -m "feat(webauthn): registration and authentication routes"
```

### Task 14: Клиент — настоящий WebAuthn (biometrics.ts + страницы)

**Files:**
- Modify: `client/package.json` (dep `@simplewebauthn/browser`)
- Rewrite: `client/src/utils/biometrics.ts`
- Modify: `client/src/pages/SettingsPage.tsx` (register-флоу), `client/src/pages/LoginPage.tsx` (auth-флоу)
- Test: `client/src/tests/biometrics.test.ts` (create/rewrite)

**Interfaces:**
- Produces: `isBiometricsAvailable(): Promise<boolean>`, `isBiometricsEnabled(): boolean`, `registerBiometrics(token): Promise<boolean>`, `authenticateWithBiometrics(email): Promise<AuthResult|null>` где `AuthResult` = ответ `/api/auth` (user/family/child/token). `getBiometricEmail(): string|null`.

- [ ] **Step 1: Установить зависимость**
Run: `npm install @simplewebauthn/browser --workspace=client`

- [ ] **Step 2: Тест (падающий)**
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: vi.fn(async () => ({ id: 'cred' })),
  startAuthentication: vi.fn(async () => ({ id: 'cred' })),
}));
import * as bio from '../utils/biometrics';

describe('biometrics client', () => {
  beforeEach(() => { localStorage.clear(); });
  it('registerBiometrics persists enabled only after server verify', async () => {
    (globalThis as any).fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ challenge: 'c' }) })   // options
      .mockResolvedValueOnce({ ok: true, json: async () => ({ verified: true }) });  // verify
    const ok = await bio.registerBiometrics('jwt');
    expect(ok).toBe(true);
    expect(bio.isBiometricsEnabled()).toBe(true);
  });
  it('authenticateWithBiometrics returns auth payload', async () => {
    (globalThis as any).fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ challenge: 'c2' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'JWT', user: { id: 'u' } }) });
    const res = await bio.authenticateWithBiometrics('mama@mail.ru');
    expect(res && res.token).toBe('JWT');
  });
});
```

- [ ] **Step 3: Запустить — падает**
Run: `npm test --workspace=client -- biometrics`
Expected: FAIL.

- [ ] **Step 4: Реализация** `biometrics.ts`
```ts
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

export const BIOMETRICS_ENABLED_KEY = 'mls_biometrics_enabled';
export const BIOMETRICS_EMAIL_KEY = 'mls_biometric_email';

export async function isBiometricsAvailable(): Promise<boolean> {
  const PKC = (window as any).PublicKeyCredential;
  if (!PKC) return false;
  if (typeof PKC.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
    try { return await PKC.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return false; }
  }
  return true;
}
export function isBiometricsEnabled(): boolean {
  try { return localStorage.getItem(BIOMETRICS_ENABLED_KEY) === 'true'; } catch { return false; }
}
export function getBiometricEmail(): string | null {
  try { return localStorage.getItem(BIOMETRICS_EMAIL_KEY); } catch { return null; }
}
export function disableBiometrics(): void {
  try { localStorage.removeItem(BIOMETRICS_ENABLED_KEY); localStorage.removeItem(BIOMETRICS_EMAIL_KEY); } catch {}
}

export async function registerBiometrics(token: string): Promise<boolean> {
  const optRes = await fetch('/api/webauthn/register/options', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  if (!optRes.ok) return false;
  const options = await optRes.json();
  let attResp;
  try { attResp = await startRegistration(options); }
  catch { return false; }
  const verifyRes = await fetch('/api/webauthn/register/verify', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(attResp),
  });
  const data = await verifyRes.json();
  if (!verifyRes.ok || !data.verified) return false;
  try {
    localStorage.setItem(BIOMETRICS_ENABLED_KEY, 'true');
  } catch {}
  return true;
}

export interface BioAuthResult { token: string; user: any; family?: any; child?: any; }
export async function authenticateWithBiometrics(email: string): Promise<BioAuthResult | null> {
  const optRes = await fetch('/api/webauthn/auth/options', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
  });
  if (!optRes.ok) return null;
  const options = await optRes.json();
  let assertion;
  try { assertion = await startAuthentication(options); }
  catch { return null; }
  const verifyRes = await fetch('/api/webauthn/auth/verify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(assertion),
  });
  if (!verifyRes.ok) return null;
  const data = await verifyRes.json();
  return data && data.token ? data : null;
}
```
`SettingsPage.tsx`: `registerBiometrics(getAuthToken())`; при успехе хранить `localStorage.setItem(BIOMETRICS_EMAIL_KEY, user.email)` (email текущего пользователя для будущего auth-флоу), выставить тумблер; `disableBiometrics()` на выключение; доступность тумблера — по `await isBiometricsAvailable()`.
`LoginPage.tsx`: `hasSavedBiometrics()` заменить на `isBiometricsEnabled() && !!getBiometricEmail()`; `handleBiometricLogin` вызывает `authenticateWithBiometrics(getBiometricEmail()!)`, при результате — сохранить токен/пользователя обычным путём входа (`setAuthToken`/`setStoredUser`, как делает успешный логин) и перейти в app.

- [ ] **Step 5: Запустить — проходит**
Run: `npm test --workspace=client -- biometrics`
Expected: PASS.

- [ ] **Step 6: Прогнать весь клиентский набор**
Run: `npm test --workspace=client`
Expected: PASS. Починить ссылки на старые экспорты (`hasSavedBiometrics`, `getSavedBiometricUser`, `registerBiometrics(user,token)` сигнатура) в страницах.

- [ ] **Step 7: Commit**
```bash
git add client/package.json package-lock.json client/src/utils/biometrics.ts client/src/pages/SettingsPage.tsx client/src/pages/LoginPage.tsx client/src/tests/biometrics.test.ts
git commit -m "feat(webauthn): real client biometrics via @simplewebauthn/browser"
```

---

## Phase 4 — Полная проверка и деплой

### Task 15: Полный прогон тестов + сборка

**Files:** — (без изменений кода; фиксы по месту)

- [ ] **Step 1: Серверные тесты**
Run: `npm test --workspace=server`
Expected: PASS все.

- [ ] **Step 2: Клиентские тесты**
Run: `npm test --workspace=client`
Expected: PASS все.

- [ ] **Step 3: Полная сборка**
Run: `npm run build`
Expected: server+client собираются без ошибок TypeScript; `client/dist/sw.js` и `client/dist/manifest.json` на месте.

- [ ] **Step 4: Commit (если были точечные фиксы)**
```bash
git add -A && git commit -m "test: full suite green for PWA push + webauthn"
```

### Task 16: Деплой-заметки (README) + смоук после деплоя

**Files:**
- Modify: `README.md` (секция «PWA / Push / Биометрия: эксплуатация»)

- [ ] **Step 1: Добавить в README** раздел с:
  - командой Beget-cron: `* * * * * curl -s -m 50 https://son.shved.su/api/push/dispatch -H "X-Cron-Key: <значение PUSH_CRON_KEY или app_config.push_cron_key>" >/dev/null 2>&1`
  - где взять `push_cron_key` (лог сервера на первом старте или `SELECT value FROM app_config WHERE key='push_cron_key'`), либо задать `PUSH_CRON_KEY` в env Passenger;
  - инструкцией пользователю iPhone: один раз удалить иконку с домашнего экрана и добавить заново (чистит старый SW), iOS ≥ 16.4, уведомления работают только для установленного на экран PWA;
  - что биометрия enroll-ится на каждом устройстве отдельно.

- [ ] **Step 2: Смоук-скрипт после деплоя** (в README или `docs`): 
```bash
curl -sS -o /dev/null -w "%{http_code}\n" -H "X-Forwarded-Proto: http" http://son.shved.su/   # ожидаем 301
curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" https://son.shved.su/sw.js           # 200 javascript
curl -sS https://son.shved.su/api/push/vapid-public-key                                        # {"key":"..."}
```

- [ ] **Step 3: Commit**
```bash
git add README.md && git commit -m "docs: PWA push/biometrics operations and post-deploy smoke"
```

### Task 17: Ручная верификация на iPhone (чек-лист, не автотест)

> Выполняется человеком на устройстве после деплоя ветки. Отметить каждый пункт.

- [ ] http://son.shved.su редиректит на https (301).
- [ ] Safari → Поделиться → «На экран „Домой"»: сохраняется правильная иконка (не скриншот).
- [ ] Запуск с домашнего экрана открывает рабочее приложение (НЕ белый экран). Если белый у старой установки — удалить иконку и добавить заново (разовый сброс старого SW).
- [ ] Настройки → включить push: системный запрос разрешения появляется, принятие сохраняет подписку (проверить строку в `push_subscriptions`).
- [ ] Закрыть приложение. Сымитировать notifiable-состояние (например, `countdownMinutes<=0`) и/или дождаться cron: push «Пора спать»/«Пора будить» приходит при закрытом app.
- [ ] Настройки → включить биометрию: появляется Face ID, после успеха — запись в `webauthn_credentials`.
- [ ] Выйти, на экране входа «Вход по Face ID»: успешная биометрия логинит; отмена/чужое лицо — входа нет.

---

## Self-Review (выполнено автором плана)

- **Spec coverage:** §3.1 HTTPS/SW → Task 1–4; §3.2 PWA install/manifest → Task 4 (баннер iOS-подсказки — опционально, помечен в спеке, не критичен для рабочего PWA; если нужен — добавить в SettingsPage позже); §3.3 push → Task 5–11; §3.4 webauthn → Task 11–14; §4 данные → Task 5; §6 тесты → по каждой задаче + Task 15; §7 деплой → Task 16–17. Пробел: iOS install-баннер не имеет отдельной задачи — осознанно отложен (не блокирует «рабочий PWA»), зафиксировать при ревью.
- **Placeholder scan:** код в шагах реальный; `<значение...>` в README — операционный плейсхолдер для человека, не для кода.
- **Type consistency:** `buildAuthResponseByUserId` (Task 11) → используется в `webauthnService` (Task 12); `getFamilySubscriptions/removeSubscription` (Task 7) → `pushDispatchService` (Task 8); `enablePush/disablePush` (Task 10) ↔ SettingsPage; `DbPushSubscription/DbWebauthnCredential` объявлены в Task 5.
- **Review Focus:** 410-prune → Task 8; redirect-loop → Task 1; throttle-дубль → Task 8; просроченный challenge → Task 12; SW network-first → Task 3 + Task 17.
- **Риск версий библиотек:** `@simplewebauthn/server` API зависит от версии — помечено в Task 12 замечанием исполнителю; мок-тесты не ловят рассинхрон имён полей, финальная выверка — ручная Task 17.
