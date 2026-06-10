CREATE TABLE IF NOT EXISTS users (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  ggg_account_name  TEXT NOT NULL UNIQUE,
  ggg_uuid          TEXT NOT NULL UNIQUE,
  access_token      TEXT NOT NULL,
  refresh_token     TEXT,
  token_expiry      TEXT NOT NULL,
  selected_league   TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  league      TEXT NOT NULL,
  total_chaos REAL NOT NULL,
  taken_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_snapshots_user_league_taken
  ON snapshots(user_id, league, taken_at DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_taken_at
  ON snapshots(taken_at);

CREATE TABLE IF NOT EXISTS price_cache (
  league      TEXT NOT NULL,
  category    TEXT NOT NULL,
  data_json   TEXT NOT NULL,
  fetched_at  TEXT NOT NULL,
  PRIMARY KEY (league, category)
);
