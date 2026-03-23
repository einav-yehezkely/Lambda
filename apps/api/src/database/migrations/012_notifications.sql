-- Add target_user_id to announcements for personal (per-user) notifications.
-- When target_user_id is NULL  → visible to everyone (global announcement).
-- When target_user_id is set   → visible only to that user (personal notification).
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES users(id) ON DELETE CASCADE;

-- Allow system-generated notifications that have no specific "created_by" admin.
ALTER TABLE announcements
  ALTER COLUMN created_by DROP NOT NULL;
