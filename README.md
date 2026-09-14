# Где ДПС?

Веб-приложение с картой постов ДПС в реальном времени: работает как обычный сайт,
Telegram Mini App, VK Mini App и (в перспективе) внутри MAX. Стек: **Next.js 14
(App Router) + TypeScript + Tailwind CSS + Leaflet/OpenStreetMap + Supabase (Postgres)**.

## Возможности

- Полноэкранная бесплатная карта на OpenStreetMap (без платных API), геолокация пользователя.
- Кнопка «Добавить метку ДПС» — ставит эмблему патрульной машины в текущей точке пользователя.
- Клик по метке открывает карточку: автор, время, комментарии, кнопка «Всё ещё там» (продлевает жизнь метки на 2 часа).
- Метка автоматически исчезает через 2 часа, если её никто не подтвердил.
- Авторизация: Telegram (Login Widget + Mini App initData), VK (VK ID OAuth + VK Bridge launch params для Mini App), MAX (заготовка под phone-share), веб — все три кнопки на `/login`.
- Роли пользователей `user` / `admin`. Админ видит на карте/в карточке метки кнопку мгновенного удаления и отдельную панель `/admin` со статистикой (всего пользователей, активные за 24ч, разбивка по платформам, список активных меток).
- Адаптивная тёмная/светлая тема, safe-area отступы для iOS/Android, PWA-манифест и favicon/apple-touch-icon генерируются автоматически (`app/icon.tsx`, `app/apple-icon.tsx`).

## Структура проекта

```
app/
  page.tsx                  главная карта (динамический импорт MapView без SSR)
  login/page.tsx            страница входа + автологин внутри Mini App
  login/vk-callback/page.tsx обмен кода VK ID на сессию
  admin/page.tsx             админ-панель (статистика + удаление меток)
  api/
    auth/telegram|vk|max/route.ts   проверка подписи провайдера, upsert пользователя, выдача сессии
    auth/me, logout/route.ts        текущая сессия / выход
    markers/route.ts                GET активных меток / POST новая метка
    markers/[id]/route.ts           DELETE (только admin)
    markers/[id]/confirm/route.ts   POST «всё ещё там» (+2 часа)
    markers/[id]/comments/route.ts  POST комментарий
    admin/stats/route.ts            статистика для админ-панели
    cron/cleanup/route.ts           плановая зачистка просроченных меток (Vercel Cron)
  icon.tsx, apple-icon.tsx, manifest.ts   иконки и PWA-манифест
components/
  MapView.tsx        Leaflet-карта, геолокация, слой меток, тулбар
  MarkerModal.tsx     карточка метки: комментарии, подтверждение, admin-delete
  LoginButtons.tsx    кнопки Telegram / VK / MAX для веб-версии
  AuthProvider.tsx    React-контекст текущего пользователя
  dpsIcon.tsx          SVG-эмблема патрульной машины и точка пользователя
lib/
  supabase/client.ts, server.ts   клиенты Supabase (браузер / service-role)
  auth/telegram.ts, vk.ts, max.ts верификация подписи каждой платформы
  auth/session.ts, upsertUser.ts  JWT-сессия в httpOnly cookie, upsert профиля
  platform.ts                     определение среды (Telegram/VK/MAX/веб)
supabase/schema.sql   таблицы app_users, dps_markers, dps_marker_comments + RLS
vercel.json            cron-задача на очистку просроченных меток
```

## 1. Настройка Supabase

1. Создайте проект на [supabase.com](https://supabase.com).
2. В SQL Editor выполните `supabase/schema.sql` — создаст таблицы пользователей, меток и комментариев (+ индексы, RLS для публичного чтения).
3. Скопируйте из Project Settings → API: `Project URL`, `anon public key`, `service_role key`.
4. Чтобы назначить первого администратора — после первого входа найдите свою строку в таблице `app_users` и поставьте `role = 'admin'`.

## 2. Переменные окружения

Скопируйте `.env.example` в `.env.local` и заполните:

| Переменная | Назначение |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | доступ к Supabase |
| `SESSION_SECRET` | секрет для подписи JWT-сессии (`openssl rand -hex 32`) |
| `TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | бот, созданный через [@BotFather](https://t.me/BotFather) (нужен и для Login Widget, и для Mini App) |
| `NEXT_PUBLIC_VK_APP_ID`, `VK_APP_SECRET` | приложение VK ID / VK Mini Apps ([id.vk.com/business](https://id.vk.com/business), [vk.com/apps?act=manage](https://vk.com/apps?act=manage)) |
| `NEXT_PUBLIC_MAX_APP_ID`, `MAX_APP_SECRET` | учётные данные MAX (заполняются, когда получите доступ к их API — см. ниже) |
| `CRON_SECRET` | защищает `/api/cron/cleanup`, укажите то же значение в Vercel |

## 3. Локальный запуск

```bash
npm install
npm run dev
```

Откройте http://localhost:3000.

## 4. Деплой на Vercel

1. Импортируйте репозиторий в Vercel.
2. В Project Settings → Environment Variables добавьте все переменные из `.env.example`.
3. `vercel.json` уже содержит cron-задачу `/api/cron/cleanup` (каждые 15 минут) — Vercel включит её автоматически после деплоя (Cron Jobs доступны на планах Pro/Enterprise; на Hobby можно временно дергать этот эндпоинт извне, например через GitHub Actions по расписанию).
4. Деплой: `vercel --prod` либо через автоматическую интеграцию с Git.

## 5. Подключение Telegram Mini App

1. У [@BotFather](https://t.me/BotFather): `/newapp` → привяжите к вашему боту → укажите URL вашего Vercel-деплоя.
2. В `/newbot` или `/setdomain` включите Login Widget для этого домена (нужно для веб-версии).
3. Внутри Mini App `window.Telegram.WebApp.initData` уходит на `/api/auth/telegram` и проверяется HMAC-подписью с `TELEGRAM_BOT_TOKEN` — это уже реализовано (`app/login/page.tsx`, `lib/auth/telegram.ts`).

## 6. Подключение VK Mini App / VK ID

1. Создайте Mini App на [vk.com/apps?act=manage](https://vk.com/apps?act=manage) и подключите VK ID для веб-версии на [id.vk.com/business](https://id.vk.com/business).
2. Укажите Redirect URI: `https://<ваш-домен>/login/vk-callback`.
3. Для Mini App VK передаёт `vk_*` GET-параметры при открытии — они проверяются подписью `sign` (`lib/auth/vk.ts`, `verifyVkLaunchParams`).
4. Для веб-версии используется OAuth-код с PKCE (`components/LoginButtons.tsx` → `/login/vk-callback` → `/api/auth/vk`).

## 7. Подключение MAX

На момент разработки у MAX нет широко опубликованной спецификации API для ботов/Mini Apps, поэтому реализован **адаптер по аналогии с Telegram**: клиент присылает HMAC-подписанный пакет `{ id, phone, first_name, last_name, ts, sign }`, сервер проверяет подпись (`lib/auth/max.ts`) и создаёт сессию. Когда получите официальные ключи/документацию MAX:

1. Обновите `lib/auth/max.ts` под реальный формат данных и алгоритм подписи.
2. Обновите `app/api/auth/max/route.ts`, если изменится набор полей.
3. В `components/LoginButtons.tsx` замените заглушку `loginWithMax()` на настоящий вызов MAX SDK / bridge.

Остальная часть системы (сессии, роли, БД, карта) уже не зависит от провайдера и менять не потребуется.

## 8. Автоудаление меток через 2 часа

- Каждая метка создаётся с `expires_at = now() + 2 часа`.
- Кнопка «Всё ещё там» в карточке метки (`/api/markers/[id]/confirm`) продлевает `expires_at` ещё на 2 часа.
- `GET /api/markers` отдаёт только метки с `expires_at > now()`, поэтому просроченные пропадают с карты сразу же у всех пользователей.
- `GET /api/cron/cleanup` (по расписанию из `vercel.json`) физически удаляет из базы записи с истёкшим сроком — держит таблицу компактной.

## 9. Роли и админ-панель

- Кнопка удаления метки (карта и `/admin`) видна только пользователям с `role = 'admin'` в таблице `app_users`.
- `/admin` показывает: всего пользователей, активных за 24 часа, разбивку по платформам (Telegram/VK/MAX/Веб), список активных меток с быстрым удалением.
- Доступ к `/admin` и ко всем admin API-роутам проверяется на сервере по сессии — обход через фронтенд невозможен.
