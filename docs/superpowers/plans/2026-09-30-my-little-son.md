# План реализации приложения «My little son»

> **Для автономных исполнителей:** ОБЯЗАТЕЛЬНЫЙ НАВЫК: Используйте `superpowers:subagent-driven-development` (рекомендуется) или `superpowers:executing-plans` для пошаговой реализации плана. Шаги используют синтаксис чекбоксов (`- [ ]`) для отслеживания прогресса.

**Цель:** Разработать full-stack мобильное приложение «My little son» для трекинга и умного планирования сна ребенка мамой и папой со строгим соблюдением обновленного Bento-дизайна из файла `My little son (1).html`.

**Архитектура:** Клиентское приложение React 18 + Vite (PWA) с попиксельной версткой Bento Grid, шрифтом Geologica, офлайн-кэшированием и мгновенным откликом (Optimistic UI), соединенное с легковесным Node.js + Express + SQLite бэкендом и WebSocket-сервером для мгновенной синхронизации статусов сна между мамой и папой.

**Стек технологий:** React 18, TypeScript, Vite, CSS Modules/Tailwind, Framer Motion/CSS Spring, Node.js, Express, better-sqlite3, ws (WebSocket), Vitest/Jest.

## Глобальные ограничения и правила
* **Дизайн-система:** Строгое следование макетам из `My little son (1).html`:
  - Шрифт: `Geologica` (поддерживает русский язык).
  - Палитра: фон `#ECEEE6`, хвойный темный `#23372A`, свежий лайм `#D4F27A`, чистый белый `#FFFFFF`, приглушенные `#4A5A4C`, `#B7C4B4`, `#E3E7DA`, янтарный `#D08A1E`.
  - Скругления карточек: `24px`–`28px`, кнопки от `44px` до `64px` (удобно для пальца одной руки).
* **Мобильная эргономика:** Плавные мягкие анимации (spring physics, 60fps), отсутствие скачков интерфейса при тикании таймеров, крупные кнопки быстрого ввода в 1 тап.
* **Автономность бэкенда:** Локальная база SQLite (`data/my_little_son.db`) без сторонних платных облачных аккаунтов.

---

### Задача 1: Базовая структура проекта и окружение

**Файлы:**
- Создать: `package.json` (root)
- Создать: `tsconfig.base.json`
- Создать: `server/package.json`, `server/tsconfig.json`, `server/src/index.ts`
- Создать: `client/package.json`, `client/tsconfig.json`, `client/vite.config.ts`, `client/index.html`, `client/src/main.tsx`

**Интерфейсы:**
- Конфигурация запуска обеих частей: `npm run dev` запускает сервер (порт 3001) и клиент (порт 3000) параллельно.

- [ ] **Шаг 1: Создать корневой `package.json` и структуру каталогов**
- [ ] **Шаг 2: Создать серверный `server/package.json` и базовый сервер Express**
- [ ] **Шаг 3: Создать клиентский `client/package.json`, Vite конфигурацию и базовый React App**
- [ ] **Шаг 4: Установить зависимости и проверить сборку обеих частей**
  Запуск: `npm install && npm run build`
  Ожидание: успешная компиляция TypeScript для сервера и Vite сборка для клиента.
- [ ] **Шаг 5: Закоммитить изменения**
  `git add . && git commit -m "chore: scaffold project structure for server and client"`

---

### Задача 2: Математический движок адаптивных рекомендаций сна (TDD)

**Файлы:**
- Создать: `shared/sleepEngine.ts`
- Тест: `shared/sleepEngine.test.ts`

**Интерфейсы:**
- `calculateDaySchedule(input: ScheduleInput): ScheduleOutput`
- `validateSettings(settings: SettingsInput): ValidationResult`

- [ ] **Шаг 1: Написать провальные unit-тесты для движка рекомендаций**
  - Тест 1: Ребенок бодрствует, расчет интервала до следующего сна и 7-сегментной батарейки.
  - Тест 2: Ребенок спит, расчет критического времени подъема («Разбудить до...»).
  - Тест 3: Распределение снов (длинный сон + короткий сон-мостик).
  - Тест 4: Адаптивное сжатие последнего сна при задержках (Schedule crunch).
  - Тест 5: Валидация сходимости настроек режима.
- [ ] **Шаг 2: Запустить тесты и убедиться в провале**
  Запуск: `npx vitest run shared/sleepEngine.test.ts`
  Ожидание: FAIL
- [ ] **Шаг 3: Реализовать алгоритм в `shared/sleepEngine.ts`**
  - Поддержка диапазонов бодрствования `[W_min, W_max]`.
  - Формула 7 делений столбикового индикатора бодрствования.
  - Расчет оставшихся дневных снов и дедлайна подъема.
  - Валидатор сходимости дневного баланса.
- [ ] **Шаг 4: Запустить тесты и убедиться в успешном прохождении**
  Запуск: `npx vitest run shared/sleepEngine.test.ts`
  Ожидание: PASS (5/5 tests passed)
- [ ] **Шаг 5: Закоммитить изменения**
  `git add shared/ && git commit -m "feat(engine): add adaptive sleep recommendation engine with unit tests"`

---

### Задача 3: База данных SQLite, репозитории и REST API

**Файлы:**
- Создать: `server/src/db/schema.sql`
- Создать: `server/src/db/database.ts`
- Создать: `server/src/services/authService.ts`
- Создать: `server/src/services/sleepService.ts`
- Создать: `server/src/routes/authRoutes.ts`
- Создать: `server/src/routes/sleepRoutes.ts`
- Создать: `server/src/routes/settingsRoutes.ts`
- Создать: `server/src/routes/calendarRoutes.ts`
- Тест: `server/src/tests/api.test.ts`

**Интерфейсы:**
- `POST /api/auth/register` (создание пользователя + семьи или вход по коду)
- `POST /api/auth/login`
- `GET /api/sleep/status` (текущий статус, таймеры, рекомендации)
- `POST /api/sleep/fell-asleep` (время: сейчас или оффсет/ручной ввод)
- `POST /api/sleep/woke-up` (время: сейчас или оффсет/ручной ввод)
- `POST /api/sleep/retroactive` (добавление сна задним числом)
- `GET /api/settings`, `PUT /api/settings`
- `GET /api/calendar/month?year=2026&month=9`

- [ ] **Шаг 1: Написать интеграционный тест для REST API**
- [ ] **Шаг 2: Реализовать схему SQLite и инициализацию БД с предзаполненными демо-данными (30.09.2026)**
- [ ] **Шаг 3: Реализовать сервисы авторизации, настроек, журнала снов и календаря**
- [ ] **Шаг 4: Подключить роуты в `server/src/index.ts`**
- [ ] **Шаг 5: Запустить тесты API и проверить работоспособность**
  Запуск: `npx vitest run server/src/tests/api.test.ts`
  Ожидание: PASS
- [ ] **Шаг 6: Закоммитить изменения**
  `git add server/ && git commit -m "feat(server): add SQLite database, services and REST API endpoints"`

---

### Задача 4: WebSocket сервер реального времени и клиентский хук

**Файлы:**
- Создать: `server/src/ws/wsServer.ts`
- Модифицировать: `server/src/index.ts`
- Создать: `client/src/api/socket.ts`
- Создать: `client/src/hooks/useFamilySync.ts`
- Тест: `server/src/tests/ws.test.ts`

**Интерфейсы:**
- WS события: `CLIENT_JOIN_FAMILY`, `SLEEP_STATUS_CHANGED`, `SETTINGS_UPDATED`
- При любом действии мамы (`fell-asleep`, `woke-up`) событие за <50ms прилетает папе.

- [ ] **Шаг 1: Написать тест на широковещательную рассылку WebSocket внутри одной семьи**
- [ ] **Шаг 2: Реализовать WS сервер с авторизацией по family_id и heartbeat**
- [ ] **Шаг 3: Реализовать клиентский модуль `socket.ts` и хук `useFamilySync` с автоматическим реконнектом**
- [ ] **Шаг 4: Проверить тест WebSocket**
  Запуск: `npx vitest run server/src/tests/ws.test.ts`
  Ожидание: PASS
- [ ] **Шаг 5: Закоммитить изменения**
  `git add server/src/ws client/src/api/socket.ts client/src/hooks/useFamilySync.ts && git commit -m "feat(sync): add real-time WebSocket family synchronization"`

---

### Задача 5: Дизайн-система Geologica, Bento-компоненты и верстка

**Файлы:**
- Создать: `client/src/styles/theme.css`
- Создать: `client/src/components/common/Header.tsx`
- Создать: `client/src/components/common/BottomNav.tsx`
- Создать: `client/src/components/bento/BentoCard.tsx`
- Создать: `client/src/components/bento/AwakeBatteryBar.tsx` (7 делений)
- Создать: `client/src/components/bento/DayTimelineBar.tsx` (суточная шкала)

**Интерфейсы:**
- Точное воспроизведение стилей из `My little son (1).html`:
  - Шрифты Onest / Geologica.
  - Bento-блоки с радиусом `24px`–`28px`.
  - Цвета: `#ECEEE6`, `#23372A`, `#D4F27A`, `#FFFFFF`.

- [ ] **Шаг 1: Настроить шрифты, CSS-переменные и тему Bento Natural**
- [ ] **Шаг 2: Создать адаптивную мобильную обертку (центрирование, safe-areas для iOS)**
- [ ] **Шаг 3: Реализовать компонент 7-сегментной батарейки бодрствования (`AwakeBatteryBar`)**
- [ ] **Шаг 4: Реализовать нижнюю навигационную панель `BottomNav` с мягкими переключениями**
- [ ] **Шаг 5: Закоммитить изменения**
  `git add client/src/styles client/src/components/ && git commit -m "feat(ui): add Bento design system, typography and reusable components"`

---

### Задача 6: Экран «Сегодня — бодрствует» (`01_today_awake.html`)

**Файлы:**
- Создать: `client/src/pages/TodayAwakePage.tsx`
- Создать: `client/src/components/today/AwakeHeroCard.tsx`
- Создать: `client/src/components/today/BentoMetricsGrid.tsx`

**Интерфейсы:**
- Отображение даты `Среда, 30.09` и статуса `Мама · Папа`.
- Темный Bento-блок с таймером `64px`, бейджем «Бодрствует с ЧЧ:ММ» и 7 столбиками.
- Карточки «Следующий сон», «Ночной сон», «Днём X / Y», «Осталось снов», «Потом: сон 3».
- Кнопка «Уснул» (хвойный цвет `#23372A` с лаймовым полумесяцем), открывающая шторку.

- [ ] **Шаг 1: Реализовать таймер реального времени, плавно тикающий каждую секунду без ререндера всей страницы**
- [ ] **Шаг 2: Реализовать темную карточку `AwakeHeroCard` с живыми данными и индикатором**
- [ ] **Шаг 3: Реализовать Bento-сетку метрик рекомендаций дня**
- [ ] **Шаг 4: Реализовать кнопку «Уснул»**
- [ ] **Шаг 5: Проверить визуальное соответствие макету `01_today_awake.html`**
- [ ] **Шаг 6: Закоммитить изменения**
  `git add client/src/pages/TodayAwakePage.tsx client/src/components/today/ && git commit -m "feat(ui): implement Today Awake screen matching Bento design"`

---

### Задача 7: Экран «Сегодня — спит» (`03_today_sleeping.html`)

**Файлы:**
- Создать: `client/src/pages/TodaySleepingPage.tsx`
- Создать: `client/src/components/today/SleepingHeroCard.tsx`
- Создать: `client/src/components/today/DayLogsList.tsx`

**Интерфейсы:**
- Темный Bento-блок с бейджем луны «Спит · сон N (уснул в ЧЧ:ММ)» и таймером длительности сна.
- Лаймовая карточка предупреждения: «Разбудить до: ЧЧ:ММ (иначе сдвинется отбой)».
- Карточка пересчитанного отбоя.
- Лаймовая кнопка «Проснулся».
- Список «Записи за день» с отображением автора записи (Мама/Папа) и кнопкой добавления задним числом.

- [ ] **Шаг 1: Реализовать темную карточку сна `SleepingHeroCard` с живым таймером**
- [ ] **Шаг 2: Реализовать карточки пересчитанного отбоя и дедлайна пробуждения**
- [ ] **Шаг 3: Реализовать список записей за день `DayLogsList`**
- [ ] **Шаг 4: Реализовать кнопку «Проснулся»**
- [ ] **Шаг 5: Проверить визуальное соответствие макету `03_today_sleeping.html`**
- [ ] **Шаг 6: Закоммитить изменения**
  `git add client/src/pages/TodaySleepingPage.tsx client/src/components/today/ && git commit -m "feat(ui): implement Today Sleeping screen matching Bento design"`

---

### Задача 8: Шторка быстрого ввода времени («Уснул» / «Проснулся») (`02_fell_asleep_modal.html`)

**Файлы:**
- Создать: `client/src/components/modals/SleepActionModal.tsx`
- Создать: `client/src/components/modals/RetroactiveSleepModal.tsx`

**Интерфейсы:**
- Плавный выезд снизу (slide-up spring animation).
- Вариант 1: Быстрое действие «Сейчас ЧЧ:ММ (одним нажатием)».
- Вариант 2: Селектор времени + быстрые чипы `−5 мин`, `−10 мин`, `−15 мин`, `−30 мин`.
- Подтверждение сохранения.

- [ ] **Шаг 1: Реализовать компонент модальной шторки с backdrop и жестом свайпа вниз**
- [ ] **Шаг 2: Реализовать выбор «Сейчас» и динамическое вычисление времени с чипами сдвига**
- [ ] **Шаг 3: Реализовать модальное окно добавления сна задним числом (время начала и конца)**
- [ ] **Шаг 4: Подключить вызовы API и мгновенный optimistic UI**
- [ ] **Шаг 5: Проверить визуальное соответствие макету `02_fell_asleep_modal.html`**
- [ ] **Шаг 6: Закоммитить изменения**
  `git add client/src/components/modals/ && git commit -m "feat(ui): implement quick-action bottom sheet modal with time offset chips"`

---

### Задача 9: Экран «Календарь» (`04_calendar.html`)

**Файлы:**
- Создать: `client/src/pages/CalendarPage.tsx`
- Создать: `client/src/components/calendar/MonthGrid.tsx`
- Создать: `client/src/components/calendar/DayDetailCard.tsx`

**Интерфейсы:**
- Переключатель месяцев с подсчетом дней.
- Сетка дней 7xN с полосками выполнения нормы дневного сна (хвойный цвет если норма, янтарный `#D08A1E` если меньше нормы).
- Сводка выбранного дня: «Днём X:XX», «Снов X / Y», «Отбой ЧЧ:ММ».
- Горизонтальный суточный таймлайн 07:00–21:00 с лаймовыми плашками снов.
- Список снов дня с кнопкой редактирования.

- [ ] **Шаг 1: Реализовать компонент сетки месяца `MonthGrid` с индикаторами**
- [ ] **Шаг 2: Реализовать компонент суточного таймлайна с точным позиционированием снов**
- [ ] **Шаг 3: Реализовать карточки сводки и детализацию выбранного дня**
- [ ] **Шаг 4: Подключить API загрузки месяца и переключение дат**
- [ ] **Шаг 5: Проверить визуальное соответствие макету `04_calendar.html`**
- [ ] **Шаг 6: Закоммитить изменения**
  `git add client/src/pages/CalendarPage.tsx client/src/components/calendar/ && git commit -m "feat(ui): implement Calendar screen with monthly sleep norm bars and daily timeline"`

---

### Задача 10: Экран «Настройки» (`05_settings.html`)

**Файлы:**
- Создать: `client/src/pages/SettingsPage.tsx`
- Создать: `client/src/components/settings/AgePresetsModal.tsx`
- Создать: `client/src/components/settings/SanityBanner.tsx`

**Интерфейсы:**
- Поле «Имя ребёнка» и модалка «Подставить значения по возрасту» (пресеты для 3–5 мес, 6–8 мес, 9–11 мес, 12–18 мес).
- Bento-контролы:
  - Степпер дневных снов (`− 3 +`).
  - Селектор отбоя (`20:30`).
  - Интервалы бодрствования (`от 2:30` до `3:00`).
  - Дневной сон всего (`3 ч 20 м`).
  - Бодрствование за день (`10 ч 00 м`).
- Лаймовая карточка живой валидации сходимости режима.
- Список семьи (Мама, Папа) и кнопка копирования кода приглашения.

- [ ] **Шаг 1: Реализовать Bento-контролы настроек с двусторонней привязкой к состоянию**
- [ ] **Шаг 2: Встроить живую валидацию сходимости графика (Sanity check)**
- [ ] **Шаг 3: Реализовать пресеты по возрасту ребенка**
- [ ] **Шаг 4: Реализовать секцию семьи с генерацией и копированием инвайт-кода**
- [ ] **Шаг 5: Проверить визуальное соответствие макету `05_settings.html`**
- [ ] **Шаг 6: Закоммитить изменения**
  `git add client/src/pages/SettingsPage.tsx client/src/components/settings/ && git commit -m "feat(ui): implement Settings screen with live schedule validation and family members"`

---

### Задача 11: Экраны «Вход» и «Регистрация» (`06_login.html`, `07_register.html`)

**Файлы:**
- Создать: `client/src/pages/LoginPage.tsx`
- Создать: `client/src/pages/RegisterPage.tsx`
- Создать: `client/src/stores/authStore.ts`

**Интерфейсы:**
- Страница входа с логотипом `My little son`.
- Страница регистрации с выбором роли («Мама», «Папа», «Другое») и выбором семьи («Создать новую» или «Есть приглашение»).
- Авторизационный контекст и сохранение токена в LocalStorage.

- [ ] **Шаг 1: Реализовать `authStore` и хранение сессии**
- [ ] **Шаг 2: Сверстать экран входа `LoginPage` строго по макету `06_login.html`**
- [ ] **Шаг 3: Сверстать экран регистрации `RegisterPage` строго по макету `07_register.html`**
- [ ] **Шаг 4: Проверить полный флоу регистрации мамы, генерацию кода семьи и подключение папы по коду**
- [ ] **Шаг 5: Закоммитить изменения**
  `git add client/src/pages/Login* client/src/pages/Register* client/src/stores/ && git commit -m "feat(auth): implement Login and Register screens with family invite codes"`

---

### Задача 12: PWA, плавные анимации и финальное тестирование

**Файлы:**
- Создать: `client/public/manifest.json`
- Создать: `client/public/sw.js`
- Модифицировать: `client/index.html`
- Тест: сквозной сценарий работы

- [ ] **Шаг 1: Настроить манифест PWA (иконки, standalone режим, цвет шапки `#23372A`)**
- [ ] **Шаг 2: Проверить плавность всех анимаций на мобильном эмуляторе (60fps, отсутствие дерганий)**
- [ ] **Шаг 3: Запустить полный набор тестов (unit, API, WS, engine)**
  Запуск: `npm test`
  Ожидание: все тесты проходят без ошибок.
- [ ] **Шаг 4: Провести сквозную проверку пользовательских сценариев (укладывание, пробуждение, пересчет, просмотр календаря, изменение настроек)**
- [ ] **Шаг 5: Закоммитить финальные изменения**
  `git add . && git commit -m "feat: complete My little son full-stack PWA application"`
