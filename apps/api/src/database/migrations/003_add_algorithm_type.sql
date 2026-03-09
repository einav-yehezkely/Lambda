-- Add 'algorithm' content type and metadata column for type-specific fields
ALTER TABLE content_items DROP CONSTRAINT IF EXISTS content_items_type_check;
ALTER TABLE content_items ADD CONSTRAINT content_items_type_check
  CHECK (type IN ('proof', 'exam_question', 'coding_question', 'algorithm'));

ALTER TABLE content_items ADD COLUMN IF NOT EXISTS metadata JSONB;
