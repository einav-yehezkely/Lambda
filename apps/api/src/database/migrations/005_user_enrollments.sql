-- User course enrollments
-- Tracks which course versions a user has explicitly enrolled in
CREATE TABLE user_enrollments (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version_id  UUID NOT NULL REFERENCES course_versions(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, version_id)
);

CREATE INDEX idx_user_enrollments_user ON user_enrollments(user_id);
