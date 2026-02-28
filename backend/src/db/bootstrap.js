import { pool } from "./pool.js";

async function assignDefaultUsernames() {
  const usersWithoutUsername = await pool.query(
    `SELECT id
     FROM users
     WHERE username IS NULL OR username = ''
     ORDER BY id ASC`,
  );

  if (!usersWithoutUsername.rowCount) return;

  const candidates = ["user1", "user2"];

  for (let i = 0; i < usersWithoutUsername.rows.length; i += 1) {
    const userId = usersWithoutUsername.rows[i].id;

    let username = candidates[i] || `user${userId}`;

    const taken = await pool.query("SELECT 1 FROM users WHERE username = $1 LIMIT 1", [username]);
    if (taken.rowCount) {
      username = `user${userId}`;
    }

    await pool.query("UPDATE users SET username = $2 WHERE id = $1", [userId, username]);
  }
}

export async function bootstrapDatabase() {
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS username VARCHAR(60)
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(2)
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(3) NOT NULL DEFAULT 'RUB'
  `);

  await pool.query(`
    ALTER TABLE wishlists
    ADD COLUMN IF NOT EXISTS min_contribution INTEGER NOT NULL DEFAULT 100
  `);

  await pool.query(`
    ALTER TABLE wishlists
    ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
  `);

  await pool.query(`
    ALTER TABLE wishlists
    ADD COLUMN IF NOT EXISTS recipient_mode VARCHAR(12) NOT NULL DEFAULT 'self'
  `);

  await pool.query(`
    ALTER TABLE wishlists
    ADD COLUMN IF NOT EXISTS recipient_user_id INTEGER REFERENCES users(id)
  `);

  await pool.query(`
    ALTER TABLE wishlists
    ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(120)
  `);

  await pool.query(`
    ALTER TABLE wishlists
    ADD COLUMN IF NOT EXISTS hide_from_recipient BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await pool.query(`
    ALTER TABLE wishlists
    ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) NOT NULL DEFAULT 'RUB'
  `);

  await pool.query(`
    ALTER TABLE wishlist_items
    ALTER COLUMN product_url TYPE TEXT
  `);

  await pool.query(`
    ALTER TABLE wishlist_items
    ALTER COLUMN image_url TYPE TEXT
  `);

  await pool.query(`
    ALTER TABLE wishlist_items
    ADD COLUMN IF NOT EXISTS priority VARCHAR(10) NOT NULL DEFAULT 'medium'
  `);

  await pool.query(`
    ALTER TABLE contributions
    ADD COLUMN IF NOT EXISTS contributor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
  `);

  await pool.query(`
    ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS reserver_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contribution_credits (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      wishlist_id INTEGER NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
      source_item_id INTEGER REFERENCES wishlist_items(id) ON DELETE SET NULL,
      amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
      status VARCHAR(20) NOT NULL DEFAULT 'available',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_contribution_credits_lookup
    ON contribution_credits(user_id, wishlist_id, status)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_activity_notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      wishlist_id INTEGER REFERENCES wishlists(id) ON DELETE SET NULL,
      source_item_title VARCHAR(200),
      moved_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      refunded_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_activity_notifications_user_unread
    ON user_activity_notifications(user_id, is_read, created_at DESC)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS item_responsibles (
      id SERIAL PRIMARY KEY,
      item_id INTEGER NOT NULL UNIQUE REFERENCES wishlist_items(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wishlist_hidden_users (
      id SERIAL PRIMARY KEY,
      wishlist_id INTEGER NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT wishlist_hidden_users_unique UNIQUE (wishlist_id, user_id)
    )
  `);

  await pool.query(`
    UPDATE wishlists
    SET due_at = created_at + INTERVAL '30 days'
    WHERE due_at IS NULL
  `);

  await pool.query(`
    UPDATE wishlists w
    SET currency_code = COALESCE(u.preferred_currency, 'RUB')
    FROM users u
    WHERE w.owner_id = u.id
      AND (w.currency_code IS NULL OR w.currency_code = '')
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx
    ON users (username)
    WHERE username IS NOT NULL
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS friendships (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      friend_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT friendships_no_self CHECK (user_id <> friend_user_id),
      CONSTRAINT friendships_unique UNIQUE (user_id, friend_user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS friend_requests (
      id SERIAL PRIMARY KEY,
      from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      from_visible_wishlist_ids INTEGER[] NOT NULL DEFAULT '{}',
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT friend_requests_no_self CHECK (from_user_id <> to_user_id)
    )
  `);

  await pool.query(`
    ALTER TABLE friend_requests
    ADD COLUMN IF NOT EXISTS from_visible_wishlist_ids INTEGER[] NOT NULL DEFAULT '{}'
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_pending_unique_idx
    ON friend_requests (from_user_id, to_user_id)
    WHERE status = 'pending'
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(60) NOT NULL,
      title VARCHAR(180) NOT NULL,
      body TEXT NOT NULL,
      link_url VARCHAR(240) NOT NULL DEFAULT '/',
      data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications(user_id, is_read, created_at DESC)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      wishlist_shared_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      reservation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      funded_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      friend_requests_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT push_subscriptions_unique UNIQUE (user_id, endpoint)
    )
  `);

  await assignDefaultUsernames();
}
