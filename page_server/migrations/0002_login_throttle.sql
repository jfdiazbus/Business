CREATE TABLE IF NOT EXISTS blog_login_attempts (
  address_hash TEXT NOT NULL,
  attempted_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS blog_login_attempts_window_idx
  ON blog_login_attempts (address_hash, attempted_at);
