# Design: Полноценный PWA + серверный Web Push + настоящая WebAuthn-биометрия (HTTPS-only)

**Дата:** 2026-10-03
**Домен:** `son.shved.su`
**Статус:** Утверждён к реализации (ожидает ревью спеки)

---

## 1. Контекст и цель

Приложение «My little son» (React+Vite клиент, Express+better-sqlite3 сервер, деплой на Beget через Passenger за nginx) должно стать **полноценным установимым PWA**, работающим **только по HTTPS**, с **реальными push-уведомлениями** (приходят даже при закрытом приложении) и **настоящей биометрией** (WebAuthn/passkey с серверной проверкой).

### Проблемы, которые решаем
1. **Белый экран в установленном PWA по HTTPS** (по HTTP работает). Корень: на устройстве остался старый закэшированный Service Worker из прежних деплоев. SW живёт только в secure-context (HTTPS) — отсюда асимметрия HTTP↔HTTPS. Старый SW отдаёт устаревший `index.html` со старыми хэшами ассетов → 404 → белый экран. Серверная часть при этом чистая: `curl` показал идентичный свежий контент на HTTP и HTTPS, все ресурсы 200, `sw.js`→404.
2. **Иконка не сохраняется на домашний экран по HTTPS** — следствие того же сломанного PWA-слоя.
3. **Push не работает на iPhone.** Текущий код использует legacy `new Notification()` (не поддерживается iOS Safari, работает только на переднем плане). Настоящий iOS web-push требует установленного PWA + Service Worker + Push API, но прежние «фиксы» отключили manifest на iOS и удалили SW — т.е. сами убили возможность push.
4. **Биометрия — фикция.** Текущий код вызывает `navigator.credentials.create/get`, но **игнорирует результат** и всегда отдаёт токен из localStorage. Вход проходит даже если WebAuthn не сработала. Challenge захардкожен, серверной проверки нет.

### Критерий успеха
- Установка на домашний экран iPhone по HTTPS: сохраняется правильная иконка, запуск открывает рабочее приложение (не белый экран).
- Приложение доступно только по HTTPS (http → 301 на https), с HSTS.
- Push-уведомления «пора спать» / «пора будить» приходят на установленный PWA (iOS 16.4+) даже при закрытом приложении.
- Вход по Face ID/отпечатку защищён настоящей WebAuthn-проверкой на сервере; без успешной биометрии вход не выдаётся.
- Существующие данные в проде не теряются.

### Явно вне scope
- Android/desktop push тестируется попутно, но целевая платформа — iPhone.
- Синхронизация passkey между устройствами (device-bound, enroll на каждом устройстве отдельно).
- Миграция/ротация VAPID-ключей после первой генерации.

---

## 2. Архитектурные решения (зафиксировано)

| Решение | Выбор | Причина |
|---|---|---|
| Доставка push | **Beget cron → защищённый `POST /api/push/dispatch` раз в минуту** | Надёжно при закрытом app; Passenger засыпает при простое, in-process `setInterval` пропустит. |
| Backstop планировщик | in-process `setInterval` (идемпотентный через `push_dispatch_log`) | Срабатывает, если cron не настроен/процесс жив. Не основной путь. |
| HTTPS-only | Express-редирект по `x-forwarded-proto` + HSTS | `trust proxy` уже включён; `.htaccess` Beget не трогаем. |
| SW-стратегия | **network-first для навигаций**, версионированный кэш ассетов, `skipWaiting`+`clients.claim`, чистка старых кэшей на `activate` | Никогда не запирает старый HTML; новый SW перезаписывает застрявший старый. |
| VAPID-ключи | Генерируются один раз на первом старте, хранятся в БД (`app_config`) | Меньше возни с env на Beget Passenger; публичный ключ отдаётся по API. |
| Биометрия | `@simplewebauthn/server` + `@simplewebauthn/browser`, device-bound | Настоящая криптопроверка на сервере. |
| Таймзона | `families.timezone`, дефолт `Europe/Moscow` | Нужна для расчёта дедлайнов сна на сервере. |

---

## 3. Компоненты и потоки данных

### 3.1 HTTPS-only + фикс белого экрана

**Сервер (`server/src/index.ts`):**
- Middleware (до роутов и статики): если `req.secure === false` и `req.get('x-forwarded-proto') !== 'https'` и хост не localhost → `301` на `https://{host}{originalUrl}`.
- Заголовок `Strict-Transport-Security: max-age=31536000; includeSubDomains` на все ответы (только когда реально https).
- `GET /sw.js` больше НЕ отдаёт 404 — отдаёт реальный файл `client/dist/sw.js` с `Content-Type: application/javascript`, `Cache-Control: no-cache` (SW-скрипт не кэшируется, чтобы обновления доходили).
- `GET /index.html` и навигации: `Cache-Control: no-cache` (уже `max-age=0`).

**Service Worker (`client/public/sw.js`, новый):**
```
const VERSION = 'mls-v<hash/date>';
install  → self.skipWaiting()
activate → clients.claim(); удалить все кэши != VERSION
fetch:
  - navigation request (mode==='navigate'): network-first,
    при сетевой ошибке → кэш index.html (офлайн-фолбэк)
  - /assets/* и статика: stale-while-revalidate в кэш VERSION
  - /api/*, /ws, cross-origin: НЕ перехватывать (passthrough)
push            → event.waitUntil(showNotification(title, {body, icon, badge, data}))
notificationclick → focus существующего client или openWindow('/')
```

**index.html (`client/index.html` + пересборка в `dist`):**
- Убрать скрипт-костыль «unregister всех SW».
- Убрать условие «manifest только для non-iOS» — подключать `manifest.json` всегда.
- Добавить регистрацию: `navigator.serviceWorker.register('/sw.js')` после `load`.
- Оставить splash-skeleton и boot-error box (полезная диагностика).

**Для уже сломанных установок:** разовая инструкция пользователю — удалить иконку с домашнего экрана и добавить заново (чистит «отравленный» старый SW). В README/release note.

### 3.2 PWA-установка
- `manifest.json`: без изменений структуры (`display: standalone`, иконки валидны). Подключается всем, включая iOS.
- iOS не поддерживает `beforeinstallprompt` → мягкая подсказка в UI (однократный баннер «Поделиться → На экран „Домой"») для iOS Safari не в standalone. Хранить «показано» в localStorage.

### 3.3 Web Push (серверный)

**Клиентский флаг и подписка (`client/src/services/pushNotificationService.ts` — переписать):**
- `isPushSupported()` = `'serviceWorker' in navigator && 'PushManager' in window`.
- При включении в настройках: `Notification.requestPermission()` (в standalone iOS поддержано) → `reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey: <VAPID public>})` → `POST /api/push/subscribe {endpoint, keys:{p256dh, auth}}`.
- Публичный VAPID берём из `GET /api/push/vapid-public-key`.
- Выключение: `subscription.unsubscribe()` + `POST /api/push/unsubscribe`.
- Убрать клиентский `new Notification()` и throttle-map — доставка уходит на сервер. `checkAndDispatchScheduleNotifications` удаляется из клиентского пути (логика переезжает на сервер).

**Service Worker:** обработчики `push` / `notificationclick` (см. 3.1).

**Сервер:**
- Зависимость `web-push`.
- VAPID: на первом старте, если в `app_config` нет ключей — `webpush.generateVAPIDKeys()`, сохранить. `webpush.setVapidDetails('mailto:admin@shved.su', pub, priv)`.
- Роуты `server/src/routes/pushRoutes.ts`:
  - `GET  /api/push/vapid-public-key` → `{ key }`.
  - `POST /api/push/subscribe` (auth JWT) → upsert в `push_subscriptions` по `endpoint`.
  - `POST /api/push/unsubscribe` (auth) → удалить по `endpoint`.
  - `POST /api/push/dispatch` (защита `X-Cron-Key`, НЕ JWT) → прогон диспетчера.
- Диспетчер (`server/src/services/pushDispatchService.ts`):
  - Для каждой семьи с ребёнком и настройками: взять текущее состояние из того же движка, что и клиент (`shared/sleepEngine.ts`), посчитать дедлайны в таймзоне семьи (`families.timezone`).
  - Условия (переносим из текущего клиентского кода):
    - `AWAKE` и `nextNap.countdownMinutes <= 0` → ключ `SLEEP_TIME`, «Пора спать малышу 😴».
    - `SLEEPING` и `isWakeDeadlineExceeded` → ключ `WAKE_NOW`, «Пора будить малыша ⏰».
    - warnings severity `alert|warning` → ключ `WARNING_<code>`.
  - Идемпотентность/анти-спам: перед отправкой проверить `push_dispatch_log` — не слать тот же `key` для семьи чаще, чем `NOTIFICATION_THROTTLE_MS` (15 мин). После успешной отправки — записать.
  - Отправка на все `push_subscriptions` семьи; при `410/404` от push-сервиса — удалить мёртвую подписку.
- Backstop: `setInterval(dispatch, 60_000)` при `NODE_ENV!=='test'`, тот же идемпотентный путь.

### 3.4 WebAuthn-биометрия (настоящая)

**Зависимости:** `@simplewebauthn/server` (сервер), `@simplewebauthn/browser` (клиент).

**Параметры:** `rpID = 'son.shved.su'`, `rpName = 'My little son'`, `origin = 'https://son.shved.su'`.

**Сервер (`server/src/routes/webauthnRoutes.ts` + `services/webauthnService.ts`):**
- `POST /api/webauthn/register/options` (auth JWT) → `generateRegistrationOptions` (excludeCredentials = уже зарегистрированные у user), сохранить `challenge` в `webauthn_challenges` (TTL ~5 мин, type=`reg`). Вернуть options.
- `POST /api/webauthn/register/verify` (auth JWT) → `verifyRegistrationResponse` против сохранённого challenge → при успехе сохранить `credential_id, public_key, counter, transports, device_label` в `webauthn_credentials`. Удалить challenge.
- `POST /api/webauthn/auth/options` (без JWT, body: `{email}`) → найти креды пользователя → `generateAuthenticationOptions(allowCredentials)`, сохранить challenge (type=`auth`). Вернуть options.
- `POST /api/webauthn/auth/verify` (без JWT, body: assertion) → `verifyAuthenticationResponse` → при успехе обновить `counter`, выдать **JWT тем же механизмом, что обычный логин** (`authService`).

**Клиент (`client/src/utils/biometrics.ts` — переписать):**
- Регистрация (в настройках, после обычного входа): options → `startRegistration` → verify. Флаг «включено» ставим только после серверного verify. Хранить в localStorage лишь `email` для быстрого старта auth-флоу (НЕ токен).
- Вход (LoginPage): options по email → `startAuthentication` → verify → получить JWT → обычный вход.
- Удалить всё хранение JWT/пароля в localStorage как «биометрию».
- `isBiometricsAvailable` = `window.PublicKeyCredential && isUserVerifyingPlatformAuthenticatorAvailable()`.

---

## 4. Модель данных (миграции, все `IF NOT EXISTS`, неразрушающие)

Правим `server/src/db/schema.sql` **и** зеркало `server/src/db/schemaSql.ts`.

```sql
ALTER-эквивалент: families.timezone — добавить колонку.
-- better-sqlite3: ALTER TABLE ADD COLUMN идемпотентно обернуть проверкой PRAGMA table_info.

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

`families.timezone` добавляем через безопасную проверку (`PRAGMA table_info(families)` → если нет колонки, `ALTER TABLE families ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Europe/Moscow'`). Прод-БД исключена из деплоя → колонка добавится на первом старте новой версии.

---

## 5. Обработка ошибок
- Push: `410 Gone`/`404` от push-сервиса → удалить подписку. Прочие ошибки — лог, не падать.
- WebAuthn verify fail / истёкший challenge → `401`, понятное сообщение; флаг биометрии не ставится.
- Dispatch endpoint без валидного `X-Cron-Key` → `403`.
- VAPID-ключи отсутствуют и генерация не удалась → push-роуты возвращают `503`, остальное приложение работает.
- Permission `denied` на клиенте → подсказка «разрешите уведомления в настройках iOS», тумблер выкл.

## 6. Тестирование (TDD)
- **Сервер (vitest):**
  - `pushDispatchService`: дедлайны по таймзоне, условия SLEEP_TIME/WAKE_NOW/WARNING, throttle через `push_dispatch_log`, удаление мёртвых подписок (мок web-push).
  - `webauthnService`: verify с валидным/битым/просроченным challenge (мок `@simplewebauthn/server`), обновление counter.
  - push subscribe/unsubscribe upsert.
  - HTTPS-redirect middleware: http→301, https→passthrough, localhost→passthrough.
- **Клиент (vitest/happy-dom):** мок `serviceWorker`/`PushManager`; biometrics register/auth флоу с моком `@simplewebauthn/browser`; тумблеры настроек.
- **Ручная верификация на iPhone (в плане верификации, не автотест):** установка на домашний экран, иконка, запуск без белого экрана, приход push при закрытом app, вход по Face ID.

## 7. Деплой и действия пользователя
- Новые server-зависимости: `web-push`, `@simplewebauthn/server`. Клиент: `@simplewebauthn/browser`. `sharp` (генерация иконок) уже есть.
- Сборка/CI без изменений структуры.
- **Действия пользователя (вне кода):**
  1. Добавить cron в панели Beget: `* * * * * curl -s -m 50 https://son.shved.su/api/push/dispatch -H "X-Cron-Key: <секрет>" >/dev/null 2>&1`
  2. Один раз: удалить иконку приложения с домашнего экрана iPhone и добавить заново (чистит старый SW).
- Секрет cron (`X-Cron-Key`) хранится в `app_config` (генерится на первом старте, вывести в лог/README-инструкцию один раз) или задаётся через env `PUSH_CRON_KEY`.

## 8. Порядок реализации (фазы)
1. **Фундамент:** HTTPS-redirect+HSTS, новый `sw.js`, правка `index.html`, manifest на iOS, регистрация SW. (Чинит белый экран и иконку.)
2. **Push:** зависимости, VAPID в `app_config`, таблицы, роуты subscribe/unsubscribe/vapid/dispatch, диспетчер+backstop, клиентская подписка, SW push-обработчики.
3. **WebAuthn:** зависимости, таблицы, серверные роуты/сервис, переписанный клиент biometrics, интеграция в LoginPage/SettingsPage.
4. **Тесты + ручная верификация на iPhone.**

Каждая фаза — отдельные коммиты; фаза 1 самостоятельно ценна (разблокирует рабочий PWA).
