-- Allow custom content types (relax fixed enum check)
ALTER TABLE content_items DROP CONSTRAINT IF EXISTS content_items_type_check;
ALTER TABLE content_items ADD CONSTRAINT content_items_type_check CHECK (type <> '');

-- Store custom type definitions per version
ALTER TABLE course_versions ADD COLUMN IF NOT EXISTS content_types JSONB DEFAULT '[]';
