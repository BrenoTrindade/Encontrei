PRAGMA foreign_keys = ON;

CREATE TABLE saved_opportunity (
  invitation_id TEXT NOT NULL REFERENCES invitation(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL REFERENCES opportunity_snapshot(id),
  saved_at TEXT NOT NULL,
  intent_to_go INTEGER NOT NULL CHECK (intent_to_go IN (0, 1)),
  PRIMARY KEY (invitation_id, opportunity_id)
);

CREATE INDEX saved_opportunity_opportunity_idx
  ON saved_opportunity(opportunity_id, intent_to_go);

CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL REFERENCES invitation(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL REFERENCES opportunity_snapshot(id),
  went_to_beach INTEGER NOT NULL CHECK (went_to_beach IN (0, 1)),
  followed_window INTEGER NOT NULL CHECK (followed_window IN (0, 1)),
  decision_effect TEXT NOT NULL CHECK (decision_effect IN ('changed', 'confirmed', 'no_effect')),
  result_category TEXT NOT NULL CHECK (
    result_category IN ('found_relevant', 'found_other', 'nothing', 'not_applicable')
  ),
  information_correct INTEGER NOT NULL CHECK (information_correct IN (0, 1)),
  comment TEXT CHECK (comment IS NULL OR length(comment) <= 500),
  submitted_at TEXT NOT NULL,
  UNIQUE (invitation_id, opportunity_id),
  CHECK (
    (went_to_beach = 0 AND followed_window = 0 AND result_category = 'not_applicable')
    OR
    (went_to_beach = 1 AND result_category <> 'not_applicable')
  )
);

CREATE INDEX feedback_opportunity_idx
  ON feedback(opportunity_id, submitted_at);
