# Backend (Node.js)

## Run locally

```bash
cp .env.example .env
npm install
npm run start
```

## Initialize DB schema

```bash
npm run db:init
```

Base URL: `http://localhost:8000`
- health: `GET /api/health`
- auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- friends:
  - `GET /api/friends`
  - `POST /api/friends/request`
  - `POST /api/friends/requests/:requestId/accept`
  - `POST /api/friends/requests/:requestId/reject`
- wishlists:
  - `GET /api/wishlists/mine`
  - `GET /api/wishlists/shared`
  - `POST /api/wishlists`
  - `GET /api/wishlists/:slug`
  - `POST /api/wishlists/:slug/items`
  - `PATCH /api/wishlists/:slug/visibility`
- items: `POST /api/items/:itemId/reserve`, `POST /api/items/:itemId/contribute`, `POST /api/items/:itemId/remove`
- products: `POST /api/products/preview`
- realtime: `ws://localhost:8000/ws/wishlists/:slug`
