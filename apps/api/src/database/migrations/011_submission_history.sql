-- Track every time a version is submitted for review, with the diff snapshot at that moment.
-- Each row represents one submission round.

CREATE TABLE IF NOT EXISTS submission_events (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id         UUID        NOT NULL REFERENCES course_versions(id) ON DELETE CASCADE,
  base_version_id    UUID        REFERENCES course_versions(id) ON DELETE SET NULL,
  submitted_by       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submitted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- snapshot of content diff at submission time
  added_item_ids     TEXT[]      NOT NULL DEFAULT '{}',
  removed_item_ids   TEXT[]      NOT NULL DEFAULT '{}',
  -- filled in by admin when they act on this submission
  outcome            TEXT        CHECK (outcome IN ('approved', 'rejected', 'changes_requested')),
  outcome_at         TIMESTAMPTZ,
  outcome_by         UUID        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_submission_events_version ON submission_events(version_id);
CREATE INDEX IF NOT EXISTS idx_submission_events_submitted_at ON submission_events(submitted_at);
