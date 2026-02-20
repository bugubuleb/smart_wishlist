CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  username VARCHAR(60) UNIQUE,
  preferred_language VARCHAR(2),
  preferred_currency VARCHAR(3) NOT NULL DEFAULT 'RUB',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wishlists (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  title VARCHAR(150) NOT NULL,
  slug VARCHAR(180) UNIQUE NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  min_contribution INTEGER NOT NULL DEFAULT 100,
  recipient_mode VARCHAR(12) NOT NULL DEFAULT 'self',
  recipient_user_id INTEGER REFERENCES users(id),
  recipient_name VARCHAR(120),
  hide_from_recipient BOOLEAN NOT NULL DEFAULT FALSE,
  due_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id SERIAL PRIMARY KEY,
  wishlist_id INTEGER NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  product_url TEXT NOT NULL,
  image_url TEXT,
  target_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  priority VARCHAR(10) NOT NULL DEFAULT 'medium',
  item_status VARCHAR(20) NOT NULL DEFAULT 'active',
  removed_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservations (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES wishlist_items(id) ON DELETE CASCADE,
  reserver_alias VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'reserved',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contributions (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES wishlist_items(id) ON DELETE CASCADE,
  contributor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  contributor_alias VARCHAR(80) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contribution_credits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wishlist_id INTEGER NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  source_item_id INTEGER REFERENCES wishlist_items(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contribution_credits_lookup
  ON contribution_credits(user_id, wishlist_id, status);

CREATE TABLE IF NOT EXISTS user_activity_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wishlist_id INTEGER REFERENCES wishlists(id) ON DELETE SET NULL,
  source_item_title VARCHAR(200),
  moved_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  refunded_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_notifications_user_unread
  ON user_activity_notifications(user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS item_responsibles (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL UNIQUE REFERENCES wishlist_items(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wishlist_hidden_users (
  id SERIAL PRIMARY KEY,
  wishlist_id INTEGER NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT wishlist_hidden_users_unique UNIQUE (wishlist_id, user_id)
);

CREATE TABLE IF NOT EXISTS friendships (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT friendships_no_self CHECK (user_id <> friend_user_id),
  CONSTRAINT friendships_unique UNIQUE (user_id, friend_user_id)
);

CREATE TABLE IF NOT EXISTS friend_requests (
  id SERIAL PRIMARY KEY,
  from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT friend_requests_no_self CHECK (from_user_id <> to_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_pending_unique_idx
  ON friend_requests (from_user_id, to_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_wishlists_owner ON wishlists(owner_id);
CREATE INDEX IF NOT EXISTS idx_items_wishlist ON wishlist_items(wishlist_id);
CREATE INDEX IF NOT EXISTS idx_reservations_item ON reservations(item_id);
CREATE INDEX IF NOT EXISTS idx_contributions_item ON contributions(item_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to_user ON friend_requests(to_user_id);
