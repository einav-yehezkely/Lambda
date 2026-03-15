// ─── Users ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
}

// ─── Course Templates ─────────────────────────────────────────────────────────

export type Subject = string;

export interface CourseTemplate {
  id: string;
  title: string;
  subject: Subject;
  description: string | null;
  created_by: string;
  created_at: string;
}

// ─── Course Versions ──────────────────────────────────────────────────────────

export type Visibility = 'public' | 'private';

export interface CourseVersion {
  id: string;
  template_id: string;
  title: string;
  institution: string | null;
  year: number | null;
  semester: string | null;
  description: string | null;
  author_id: string;
  author?: { username: string; display_name: string | null; avatar_url: string | null };
  based_on_version_id: string | null;
  visibility: Visibility;
  is_recommended: boolean;
  content_types: { label: string; value: string; default_sections?: { label: string; content: string }[] }[] | null;
  created_at: string;
  updated_at: string;
}

// ─── Topics ───────────────────────────────────────────────────────────────────

export interface Topic {
  id: string;
  version_id: string;
  title: string;
  description: string | null;
  order_index: number;
  created_at: string;
}

// ─── Content Items ────────────────────────────────────────────────────────────

export type ContentType = 'proof' | 'exam_question' | 'exercise_question' | 'algorithm' | 'other';
export type Difficulty = 'easy' | 'medium' | 'hard';

export type QuestionFormat = 'open' | 'multiple_choice' | 'flashcard' | 'other';

export interface AlgorithmMetadata {
  algorithm?: string;
  proof?: string;
  runtime?: string;
  sections?: Array<{ label: string; content: string }>;
  question_format?: QuestionFormat;
  correct_option?: 'A' | 'B' | 'C' | 'D';
}

export interface ContentItem {
  id: string;
  type: ContentType;
  title: string;
  content: string;       // LaTeX-supported
  solution: string | null; // LaTeX-supported
  difficulty: Difficulty | null;
  tags: string[];
  metadata: AlgorithmMetadata | null;
  author_id: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

// Junction: content item as it appears in a specific version/topic
export interface VersionContentItem {
  version_id: string;
  content_item_id: string;
  topic_id: string | null;
  content_item: ContentItem;
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export type ProgressStatus = 'solved' | 'incorrect' | 'needs_review' | 'skipped';

export interface UserProgress {
  id: string;
  user_id: string;
  content_item_id: string;
  version_id: string;
  status: ProgressStatus;
  last_attempt_at: string | null;
}

// ─── Attempts ─────────────────────────────────────────────────────────────────

export interface Attempt {
  id: string;
  user_id: string;
  content_item_id: string;
  answer: string | null;
  is_correct: boolean | null;
  time_spent_seconds: number | null;
  created_at: string;
}

// ─── Progress Summary ─────────────────────────────────────────────────────────

export interface ActiveVersionProgress {
  version_id: string;
  version_title: string;
  course_id: string;
  course_title: string;
  subject: string;
  total: number;
  solved: number;
  last_attempt_at: string | null;
  enrolled: boolean;
}

export interface VersionProgressSummary {
  version_id: string;
  total: number;
  solved: number;
  incorrect: number;
  needs_review: number;
  skipped: number;
  unseen: number;
}

// ─── Extended types ───────────────────────────────────────────────────────────

export interface CourseVersionWithTemplate extends CourseVersion {
  course_templates: { id: string; title: string; subject: Subject };
}

// ─── Solutions ────────────────────────────────────────────────────────────────

export interface Solution {
  id: string;
  content_item_id: string;
  author_id: string;
  author?: { username: string; display_name: string | null; avatar_url: string | null };
  content: string;
  vote_count: number;
  user_vote?: 1 | -1 | null;
  created_at: string;
  updated_at: string;
}

// ─── Announcements ────────────────────────────────────────────────────────────

export interface Announcement {
  id: string;
  title: string;
  content: string | null;
  created_by: string;
  created_at: string;
  is_read: boolean;
}

// ─── Practice ─────────────────────────────────────────────────────────────────

export type PracticeMode = 'random' | 'topic' | 'exam' | 'spaced_repetition';

export interface PracticeSession {
  version_id: string;
  topic_id: string | null;
  mode: PracticeMode;
  items: VersionContentItem[];
}
