-- Allow any text value for subject (remove enum constraint)
ALTER TABLE course_templates
  DROP CONSTRAINT IF EXISTS course_templates_subject_check;
