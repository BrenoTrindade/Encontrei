PRAGMA foreign_keys = ON;

CREATE TABLE source_batch (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('chm_tide_table', 'open_meteo_weather', 'open_meteo_marine')),
  provider TEXT NOT NULL,
  source_url TEXT NOT NULL,
  terms_url TEXT NOT NULL,
  retrieved_at_utc TEXT NOT NULL,
  period_start_utc TEXT NOT NULL,
  period_end_utc TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  parser_version TEXT,
  request_parameters_json TEXT NOT NULL CHECK (json_valid(request_parameters_json)),
  source_timezone TEXT NOT NULL,
  vertical_datum TEXT,
  model TEXT,
  license_status TEXT NOT NULL CHECK (license_status IN ('local_only_pending', 'non_commercial', 'approved')),
  quality_status TEXT NOT NULL CHECK (quality_status IN ('pending', 'accepted', 'rejected')),
  quality_notes TEXT NOT NULL,
  UNIQUE(provider, sha256)
);

CREATE TABLE tide_prediction (
  station_id TEXT NOT NULL REFERENCES tide_station(id),
  predicted_at_utc TEXT NOT NULL,
  predicted_at_local TEXT NOT NULL,
  local_date TEXT NOT NULL,
  timezone TEXT NOT NULL,
  utc_offset_seconds INTEGER NOT NULL,
  height_meters REAL NOT NULL,
  vertical_datum TEXT NOT NULL,
  extremum_kind TEXT NOT NULL CHECK (extremum_kind IN ('high', 'low')),
  kind_derivation TEXT NOT NULL,
  source_batch_id TEXT NOT NULL REFERENCES source_batch(id),
  quality_status TEXT NOT NULL CHECK (quality_status IN ('pending', 'accepted', 'rejected')),
  PRIMARY KEY(station_id, predicted_at_utc, source_batch_id)
);

CREATE INDEX tide_prediction_station_date_idx
  ON tide_prediction(station_id, local_date, quality_status);

CREATE TABLE forecast_snapshot (
  id TEXT PRIMARY KEY,
  weather_source_batch_id TEXT NOT NULL REFERENCES source_batch(id),
  marine_source_batch_id TEXT NOT NULL REFERENCES source_batch(id),
  beach_id TEXT NOT NULL REFERENCES beach(id),
  valid_at_utc TEXT NOT NULL,
  requested_latitude REAL NOT NULL,
  requested_longitude REAL NOT NULL,
  weather_grid_latitude REAL NOT NULL,
  weather_grid_longitude REAL NOT NULL,
  marine_grid_latitude REAL NOT NULL,
  marine_grid_longitude REAL NOT NULL,
  retrieved_at_utc TEXT NOT NULL,
  fresh_until_utc TEXT NOT NULL,
  usable_until_utc TEXT NOT NULL,
  precipitation_probability REAL NOT NULL,
  precipitation_mm REAL NOT NULL,
  weather_code INTEGER NOT NULL,
  wind_speed_kmh REAL NOT NULL,
  wind_direction_degrees REAL NOT NULL,
  wind_gusts_kmh REAL NOT NULL,
  wave_height_m REAL NOT NULL,
  wave_direction_degrees REAL NOT NULL,
  wave_period_seconds REAL NOT NULL,
  swell_height_m REAL NOT NULL,
  swell_direction_degrees REAL NOT NULL,
  swell_period_seconds REAL NOT NULL,
  UNIQUE(weather_source_batch_id, marine_source_batch_id, beach_id, valid_at_utc)
);

CREATE INDEX forecast_snapshot_beach_time_idx
  ON forecast_snapshot(beach_id, valid_at_utc, usable_until_utc);

ALTER TABLE opportunity_snapshot
  ADD COLUMN confidence_reasons_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(confidence_reasons_json));

ALTER TABLE opportunity_snapshot
  ADD COLUMN stale_at TEXT;

ALTER TABLE opportunity_snapshot
  ADD COLUMN inputs_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(inputs_json));
