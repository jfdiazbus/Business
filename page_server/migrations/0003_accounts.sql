-- Accounts for orders and blog comments.
--
-- The blog writing desk keeps its own password and is deliberately not part of
-- these tables. Foreign keys are not relied on: D1 does not enforce them on
-- every plan, so a deleted account is cleaned up by the API in one place.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users (email);

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS user_sessions_user ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS user_sessions_expiry ON user_sessions (expires_at);

-- One table for the three things worth slowing down: sign in, registration and
-- comments. The key is a hash, never a network address in the clear.
CREATE TABLE IF NOT EXISTS account_attempts (
  kind TEXT NOT NULL,
  address_hash TEXT NOT NULL,
  attempted_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS account_attempts_lookup
  ON account_attempts (kind, address_hash, attempted_at);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT,
  amount_total INTEGER NOT NULL,
  currency TEXT NOT NULL,
  offer TEXT NOT NULL DEFAULT '',
  payment_status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS orders_user ON orders (user_id, created_at);

CREATE TABLE IF NOT EXISTS blog_comments (
  id TEXT PRIMARY KEY,
  post_slug TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS blog_comments_post ON blog_comments (post_slug, created_at);
CREATE INDEX IF NOT EXISTS blog_comments_user ON blog_comments (user_id);
