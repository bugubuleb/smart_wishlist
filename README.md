# Smart Wishlist


## РУС

### 1. О проекте
`Smart Wishlist` — веб-приложение для социальных вишлистов:
- пользователь создает списки подарков;
- делится ими с друзьями;
- друзья вносят вклады на подарки;
- есть realtime-обновления;
- поддерживаются приватные сценарии (скрытие списка от конкретных пользователей).

Проект сделан как полноценный fullstack-продукт на JS-стеке с PostgreSQL.

### 2. Основные возможности

#### 2.1 Аутентификация и профиль
- Регистрация/вход по `email + password`.
- Учет `username` (для дружбы и приватных сценариев).
- Профиль хранит пользовательские предпочтения:
  - язык интерфейса (`ru/en`);
  - валюта (`RUB`, `USD`, `EUR` и др.).

#### 2.2 Вишлисты
- Создание списка с:
  - названием;
  - минимальным вкладом;
  - датой исполнения;
  - режимом получателя (`для себя` / `для друга`);
  - настройкой видимости (`публичный/непубличный`);
  - списком пользователей, от которых скрыт список.
- Владелец видит собственные списки.
- Друзья видят доступные публичные списки, если их не скрыли настройками.

#### 2.3 Товары внутри вишлиста
- Добавление товара:
  - название;
  - ссылка;
  - картинка (URL или загрузка файла);
  - целевая цена;
  - приоритет (`high/medium/low`).
- Приоритет влияет на сортировку.

#### 2.4 Вклады и финансирование
- Внесение суммы с проверкой минимального вклада.
- Полоса прогресса по каждому подарку.
- Когда подарок полностью профинансирован:
  - карточка подсвечивается зеленоватым фоном;
  - поле суммы и кнопка вклада скрываются.

#### 2.5 Ответственный за подарок
- Пользователь может стать ответственным.
- Можно снять ответственность повторным нажатием.

#### 2.6 Удаление товара (бизнес-логика)
- Полностью профинансированный товар удалить нельзя.
- Если товар удален до полного сбора:
  - взносы по нему удаляются;
  - суммарный вклад пользователей в этот вишлист уменьшается на соответствующие суммы.

#### 2.7 Realtime
- Изменения в списке (вклады, удаление, ответственность, видимость и т.д.) отправляются в realtime через WebSocket.
- Клиент обновляет состояние без перезагрузки страницы.

#### 2.8 Социальный слой
- Запросы в друзья (отправка, принятие, отклонение).
- Вкладка друзей как отдельный раздел.
- Уведомления по новым вишлистам и по изменениям вкладов.

#### 2.9 Темы, локализация, валюта
- Темная/светлая тема.
- Интерфейс на `ru/en`.
- Автоопределение языка по браузеру (с приоритетом RU-группы).
- Выбранные язык и валюта сохраняются на пользователя.

### 3. Автозаполнение товара по ссылке

#### Что делает
При вставке URL (если включена галка автозаполнения):
- пытается подтянуть `название`, `картинку`, `цену`;
- конвертирует цену в выбранную валюту;
- показывает подпись вида `EUR -> RUB` под полем цены.

#### Что уже доработано
- Общие источники: `meta og:*`, `twitter:*`, JSON-LD, `img/srcset`.
- Специальные ветки для `Apple`, `Ozon`, `Wildberries`.
- Дополнительная фильтрация служебных изображений (иконки/логотипы и т.д.).
- Для Ozon/WB есть доменные fallback-стратегии, включая API-источники.

#### Важное ограничение (честный статус)
Автозаполнение **работает, но пока не на все товары 100% идеально**:
- некоторые карточки магазинов могут отдавать неполные данные;
- из-за anti-bot, A/B-разметки и региональных версий сайтов иногда выбирается не лучший title/image/price;
- для таких кейсов оставлен ручной override (можно поправить поля вручную).

### 4. Архитектура

#### 4.1 Общая схема
- `frontend` (`Next.js`, React) — UI и клиентская логика.
- `backend` (`Node.js`, `Express`) — API и бизнес-правила.
- `PostgreSQL` — хранение данных.
- `WebSocket` (`ws`) — realtime-канал.

#### 4.2 Структура проекта
```text
smart_wishlist/
  backend/
    src/
      routes/         # auth, wishlists, friends, products, health
      services/       # auth, currency, slug, product-preview
      middleware/     # JWT auth / optional auth
      realtime/       # WS rooms, broadcast
      db/             # pool + bootstrap migration
    sql/init.sql      # схема БД
    scripts/init-db.js
  frontend/
    app/              # Next.js routes
    components/       # UI-компоненты
    lib/              # api-client, i18n, realtime, session, currency utils
  run.py              # запуск проекта одной командой
```

### 5. Стек и технологии

#### Frontend
- `Next.js 15`
- `React 19`
- CSS (кастомная стилизация в `app/globals.css`)

#### Backend
- `Node.js` (ESM)
- `Express`
- `pg` (PostgreSQL)
- `ws` (WebSocket)
- `zod` (валидация payload)
- `jsonwebtoken`, `bcryptjs` (auth)

#### Infrastructure
- `PostgreSQL`
- Локальный one-command launcher: `run.py`

### 6. База данных (высокоуровнево)
Ключевые сущности:
- `users` — учетка и пользовательские настройки.
- `wishlists` — списки желаний.
- `wishlist_items` — товары.
- `contributions` — вклады.
- `item_responsibles` — ответственные по подаркам.
- `friendships`, `friend_requests` — соцграф.
- `wishlist_hidden_users` — точечные ограничения доступа.
- `user_activity_notifications` — уведомления по изменениям вкладов.

Актуальная схема лежит в `backend/sql/init.sql`.

### 7. API (основные группы)
- `/api/auth/*` — регистрация, логин, профиль, язык, валюта, lookup username.
- `/api/friends/*` — дружба и запросы.
- `/api/wishlists/*` — списки, товары, вклады, видимость, уведомления, ответственность.
- `/api/products/preview` — автопарсинг товара по ссылке.
- `/api/health` — проверка backend.

### 8. Realtime
- WebSocket endpoint: `ws://localhost:8000/ws/wishlists/:slug`
- На фронте используется `connectWishlistSocket`.
- Сервер распределяет события по комнатам (`backend/src/realtime/hub.js`).

### 9. Запуск

#### 9.1 Быстрый запуск (рекомендуется)
```bash
cd /Users/mac/Docs/smart_wishlist
python3 run.py
```

Что делает `run.py`:
- проверяет `node` и `npm`;
- создает `.env` файлы из примеров, если их нет;
- ставит зависимости;
- инициализирует схему БД (`backend npm run db:init`);
- поднимает backend и frontend параллельно.

После старта:
- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:8000/api/health`

#### 9.2 Ручной запуск
1. Запустить PostgreSQL.
2. Backend:
```bash
cd backend
cp .env.example .env
npm install
npm run db:init
npm run dev
```
3. Frontend:
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

### 10. Переменные окружения

#### Backend (`backend/.env`)
- `PORT=8000`
- `DATABASE_URL=postgresql://wishlist:wishlist@localhost:5432/wishlist`
- `JWT_SECRET=...`
- `JWT_EXPIRES_IN=7d`
- `CORS_ORIGIN=http://localhost:3000`

#### Frontend (`frontend/.env.local`)
- `NEXT_PUBLIC_API_URL=http://localhost:8000/api`
- `NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws`

### 11. Ограничения и компромиссы
- OAuth не подключен (только email/password).
- Автопарсинг e-commerce ссылок не может быть абсолютно стабильным без полноценного headless scraping/captcha bypass.
- Некоторые сайты динамически меняют разметку; парсер периодически требует точечной адаптации.
- В текущей реализации нет внешнего object storage; загружаемые картинки сохраняются как `data:image/...` строка.

### 12. Что можно улучшить дальше
- Добавить OAuth (`Google`, `Apple`) и reset password flow.
- Вынести пользовательские изображения в S3-совместимое хранилище.
- Добавить полноценные e2e-тесты критичных сценариев.
- Внедрить кэш и telemetry качества автопарсинга по доменам.

---

## ENG

### 1. Project overview
`Smart Wishlist` is a social wishlist web app where users can:
- create wishlists;
- share them with friends;
- collect contributions for gifts;
- receive realtime updates;
- configure privacy rules (including hiding lists from specific users).

It is implemented as a fullstack JavaScript product with PostgreSQL.

### 2. Core features

#### 2.1 Authentication & profile
- Email/password registration and login.
- `username` support (used in friend flow and privacy logic).
- Per-user preferences:
  - UI language (`ru/en`);
  - currency (`RUB`, `USD`, `EUR`, etc.).

#### 2.2 Wishlists
- Create wishlist with:
  - title;
  - minimum contribution;
  - due date;
  - recipient mode (`self` / `friend`);
  - visibility (`public/private`);
  - per-user hide list.
- Owner sees own wishlists.
- Friends can see eligible public wishlists unless restricted by privacy rules.

#### 2.3 Items
- Add item with:
  - title;
  - product URL;
  - image (URL or file upload);
  - target price;
  - priority (`high/medium/low`).
- Priority affects item ordering.

#### 2.4 Contributions
- Contribution amount validation against minimum threshold.
- Progress bar per gift.
- Fully funded gift behavior:
  - card gets a green-tinted background;
  - amount input and contribute button are hidden.

#### 2.5 Responsible person
- User can become responsible for a gift.
- User can remove responsibility (toggle action).

#### 2.6 Item deletion rules
- Fully funded gifts cannot be deleted.
- If an item is removed before full funding:
  - contributions for that item are removed;
  - each contributor’s invested total in that wishlist is reduced accordingly.

#### 2.7 Realtime
- Realtime updates via WebSocket for contributions, item changes, visibility changes, responsibility updates, etc.
- UI updates without page reload.

#### 2.8 Social layer
- Friend requests (send/accept/reject).
- Dedicated friends tab.
- Notifications for new wishlists and contribution-related updates.

#### 2.9 Themes, localization, currency
- Dark/light theme.
- RU/EN localization.
- Browser-based language auto-detection (RU-near locales prioritized).
- Selected language and currency are persisted per user.

### 3. Product autofill by URL

#### What it does
When URL is pasted (and autofill is enabled), the app attempts to extract:
- title;
- image;
- price;
- and converts price into selected user currency.

#### What is already improved
- Generic sources: `og:*`, `twitter:*`, JSON-LD, `img/srcset`.
- Domain-specific logic for `Apple`, `Ozon`, `Wildberries`.
- Additional filtering of utility assets (icons/logos).
- Ozon/WB include domain fallback strategies, including API-based sources.

#### Important limitation (current status)
Autofill **works, but not perfectly for all products yet**:
- some storefront pages expose partial/inconsistent metadata;
- anti-bot behavior, A/B templates and regional layouts can still cause wrong title/image/price selection;
- manual field override is supported and expected for edge cases.

### 4. Architecture

#### 4.1 High-level
- `frontend` (`Next.js`, React) — UI and client logic.
- `backend` (`Node.js`, `Express`) — API and business logic.
- `PostgreSQL` — persistence.
- `WebSocket` (`ws`) — realtime transport.

#### 4.2 Repository layout
```text
smart_wishlist/
  backend/
    src/routes
    src/services
    src/middleware
    src/realtime
    src/db
    sql/init.sql
    scripts/init-db.js
  frontend/
    app
    components
    lib
  run.py
```

### 5. Tech stack

#### Frontend
- Next.js 15
- React 19
- Custom CSS (`frontend/app/globals.css`)

#### Backend
- Node.js (ESM)
- Express
- PostgreSQL (`pg`)
- WebSocket (`ws`)
- Zod validation
- JWT + bcrypt auth

### 6. Database (high-level entities)
- `users`
- `wishlists`
- `wishlist_items`
- `contributions`
- `item_responsibles`
- `friendships`, `friend_requests`
- `wishlist_hidden_users`
- `user_activity_notifications`

Source of truth: `backend/sql/init.sql`.

### 7. API groups
- `/api/auth/*`
- `/api/friends/*`
- `/api/wishlists/*`
- `/api/products/preview`
- `/api/health`

### 8. Realtime
- WS endpoint: `ws://localhost:8000/ws/wishlists/:slug`
- Client helper: `frontend/lib/realtime.js`
- Room broadcast hub: `backend/src/realtime/hub.js`

### 9. Running locally

#### 9.1 One-command start (recommended)
```bash
cd /Users/mac/Docs/smart_wishlist
python3 run.py
```

`run.py` will:
- verify required commands;
- create env files from examples if missing;
- install dependencies;
- initialize DB schema;
- start backend and frontend.

After startup:
- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:8000/api/health`

#### 9.2 Manual start
Backend:
```bash
cd backend
cp .env.example .env
npm install
npm run db:init
npm run dev
```
Frontend:
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

### 10. Environment variables

#### Backend (`backend/.env`)
- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGIN`

#### Frontend (`frontend/.env.local`)
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL`

### 11. Known limitations
- No OAuth yet (email/password only).
- Autofill cannot be 100% deterministic across all e-commerce pages without full headless scraping/captcha handling.
- Dynamic storefront markup may require periodic parser adjustments.
- Uploaded images are currently stored as data URLs, not external object storage.

### 12. Next improvements
- OAuth providers and password reset flow.
- Move uploaded images to object storage (S3-compatible).
- Add stronger e2e coverage for critical product flows.
- Domain-level telemetry and cache tuning for autofill quality.

