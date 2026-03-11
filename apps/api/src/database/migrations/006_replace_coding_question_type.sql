-- Replace 'coding_question' content type with 'exercise_question'
UPDATE content_items SET type = 'exercise_question' WHERE type = 'coding_question';

ALTER TABLE content_items DROP CONSTRAINT IF EXISTS content_items_type_check;
ALTER TABLE content_items ADD CONSTRAINT content_items_type_check
  CHECK (type IN ('proof', 'exam_question', 'exercise_question', 'algorithm', 'other'));
