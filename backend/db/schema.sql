CREATE TABLE IF NOT EXISTS users (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  ggg_account_name  TEXT NOT NULL UNIQUE,
  ggg_uuid          TEXT NOT NULL UNIQUE,
  access_token      TEXT NOT NULL,
  refresh_token     TEXT,
  token_expiry      TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
