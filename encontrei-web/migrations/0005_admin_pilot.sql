CREATE TABLE admin_session (
  token_hash TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE admin_login_window (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);
CREATE TABLE admin_audit (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);
