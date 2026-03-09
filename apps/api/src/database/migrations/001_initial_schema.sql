-- ============================================================
-- Lambda Platform — Initial Schema
-- Run in Supabase SQL Editor or via migration tool
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── USERS ───────────────────────────────────────────────────
-- Mirrors Supabase Auth users. Populated via trigger on auth.users.
CREATE TABLE users (
  id           UUID PRIMARY KEY,   -- same as auth.users.id
  email        TEXT UNIQUE NOT NULL,
  username     TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── COURSE TEMPLATES ────────────────────────────────────────
-- The abstract course concept (e.g. "Algorithms", "Linear Algebra")
CREATE TABLE course_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  subject     TEXT NOT NULL CHECK (subject IN ('cs', 'math', 'other')),
  description TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── COURSE VERSIONS ─────────────────────────────────────────
-- A specific version of a course (Algorithms - HUJI - 2025).
-- Forms a version tree via based_on_version_id (Git-like).
CREATE TABLE course_versions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id         UUID NOT NULL REFERENCES course_templates(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  institution         TEXT,
  year                INTEGER,
  description         TEXT,
  author_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  based_on_version_id UUID REFERENCES course_versions(id) ON DELETE SET NULL,
  visibility          TEXT NOT NULL DEFAULT 'public'
                        CHECK (visibility IN ('public', 'private')),
  is_recommended      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── TOPICS ──────────────────────────────────────────────────
-- Chapters/sections within a specific version.
-- Topics are VERSION-SPECIFIC: copied as new rows on fork.
CREATE TABLE topics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id  UUID NOT NULL REFERENCES course_versions(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (version_id, order_index)
);

-- ─── CONTENT ITEMS ───────────────────────────────────────────
-- Shared content objects: proofs, exam questions, coding questions.
-- NOT tied to a specific version — membership is via junction table.
-- Supports LaTeX in content and solution fields (stored as strings).
CREATE TABLE content_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type         TEXT NOT NULL CHECK (type IN ('proof', 'exam_question', 'coding_question')),
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,        -- LaTeX strings supported
  solution     TEXT,                 -- LaTeX strings supported
  difficulty   TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  tags         TEXT[] NOT NULL DEFAULT '{}',
  author_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── VERSION CONTENT ITEMS (junction) ────────────────────────
-- Tracks WHICH content items belong to WHICH version, and under WHICH topic.
--
-- On fork (version A → version B):
--   1. New topic rows are created for B (copies of A's topics).
--   2. Junction rows are copied: (version_id=A, item=X, topic=T_A)
--      becomes (version_id=B, item=X, topic=T_B).
--   Content items themselves are NOT duplicated.
CREATE TABLE version_content_items (
  version_id      UUID NOT NULL REFERENCES course_versions(id) ON DELETE CASCADE,
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  topic_id        UUID REFERENCES topics(id) ON DELETE SET NULL,
  PRIMARY KEY (version_id, content_item_id)
);

-- ─── USER PROGRESS ───────────────────────────────────────────
-- Tracks a user's status on each content item.
CREATE TABLE user_progress (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_item_id  UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  status           TEXT NOT NULL
                     CHECK (status IN ('solved', 'incorrect', 'needs_review', 'skipped')),
  last_attempt_at  TIMESTAMPTZ,
  UNIQUE (user_id, content_item_id)
);

-- ─── ATTEMPTS ────────────────────────────────────────────────
-- Each individual practice attempt.
CREATE TABLE attempts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_item_id    UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  answer             TEXT,
  is_correct         BOOLEAN,
  time_spent_seconds INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── CONTENT VOTES ───────────────────────────────────────────
-- Community quality voting on content items.
CREATE TABLE content_votes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_item_id  UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  vote             SMALLINT NOT NULL CHECK (vote IN (1, -1)),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, content_item_id)
);

-- ─── INDEXES ─────────────────────────────────────────────────
CREATE INDEX idx_course_versions_template   ON course_versions(template_id);
CREATE INDEX idx_course_versions_author     ON course_versions(author_id);
CREATE INDEX idx_topics_version             ON topics(version_id);
CREATE INDEX idx_vci_version               ON version_content_items(version_id);
CREATE INDEX idx_vci_content_item          ON version_content_items(content_item_id);
CREATE INDEX idx_vci_topic                 ON version_content_items(topic_id);
CREATE INDEX idx_user_progress_user        ON user_progress(user_id);
CREATE INDEX idx_attempts_user             ON attempts(user_id);
CREATE INDEX idx_attempts_content_item     ON attempts(content_item_id);

-- ─── TRIGGERS ────────────────────────────────────────────────

-- Auto-update updated_at on course_versions
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_course_versions_updated_at
  BEFORE UPDATE ON course_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_content_items_updated_at
  BEFORE UPDATE ON content_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Sync new Supabase Auth users into the users table
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, username, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
