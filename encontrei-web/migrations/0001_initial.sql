PRAGMA foreign_keys = ON;

CREATE TABLE tide_station (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  source_url TEXT NOT NULL,
  source_retrieved_at TEXT NOT NULL
);

CREATE TABLE beach (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  municipality TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  tide_station_id TEXT NOT NULL REFERENCES tide_station(id),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE invitation (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  participant_code TEXT NOT NULL UNIQUE,
  session_hash TEXT UNIQUE,
  issued_at TEXT NOT NULL,
  accepted_at TEXT,
  revoked_at TEXT,
  last_seen_at TEXT
);

CREATE INDEX invitation_session_hash_idx ON invitation(session_hash);

CREATE TABLE opportunity_snapshot (
  id TEXT PRIMARY KEY,
  beach_id TEXT NOT NULL REFERENCES beach(id),
  local_date TEXT NOT NULL,
  recommended_start_utc TEXT NOT NULL,
  recommended_end_utc TEXT NOT NULL,
  score_internal INTEGER NOT NULL CHECK (score_internal BETWEEN 0 AND 100),
  score_band TEXT NOT NULL CHECK (score_band IN ('low', 'medium', 'high')),
  score_version TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  summary TEXT NOT NULL,
  restriction_status TEXT NOT NULL CHECK (
    restriction_status IN ('allowed_to_recommend', 'needs_verification', 'not_recommended')
  ),
  restriction_summary TEXT NOT NULL,
  breakdown_json TEXT NOT NULL CHECK (json_valid(breakdown_json)),
  sources_json TEXT NOT NULL CHECK (json_valid(sources_json)),
  generated_at TEXT NOT NULL,
  published_at TEXT,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'hidden', 'expired'))
);

CREATE INDEX opportunity_local_date_status_idx
  ON opportunity_snapshot(local_date, status, expires_at);
