-- Add optional lecturer_name and course_number to course_versions
ALTER TABLE course_versions
  ADD COLUMN IF NOT EXISTS lecturer_name TEXT,
  ADD COLUMN IF NOT EXISTS course_number TEXT;
