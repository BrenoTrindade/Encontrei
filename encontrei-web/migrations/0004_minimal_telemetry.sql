ALTER TABLE invitation ADD COLUMN telemetry_consent_at TEXT;

CREATE TABLE participant_event (
  id TEXT NOT NULL,
  invitation_id TEXT NOT NULL REFERENCES invitation(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL CHECK (event_name IN (
    'radar_viewed', 'day_changed', 'opportunity_viewed', 'map_opened', 'feedback_started'
  )),
  opportunity_id TEXT REFERENCES opportunity_snapshot(id),
  local_date TEXT,
  occurred_at TEXT NOT NULL,
  PRIMARY KEY (invitation_id, id),
  CHECK (
    (event_name IN ('opportunity_viewed', 'feedback_started') AND opportunity_id IS NOT NULL AND local_date IS NULL)
    OR (event_name IN ('radar_viewed', 'day_changed', 'map_opened') AND opportunity_id IS NULL AND local_date IS NOT NULL)
  )
);
CREATE INDEX participant_event_date_idx ON participant_event(occurred_at, event_name);
