-- Auto-applied at server startup (idempotent). Mirrors shared/schema.ts (Postgres).
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  asanas TEXT NOT NULL DEFAULT '[]',
  pathway_slug TEXT,
  notes TEXT,
  kind TEXT NOT NULL DEFAULT 'asana',
  pre_mood TEXT,
  post_mood TEXT
);

CREATE TABLE IF NOT EXISTS preferences (
  id SERIAL PRIMARY KEY,
  motion_enabled INTEGER NOT NULL DEFAULT 1,
  voice_enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS pathway_enrollments (
  id SERIAL PRIMARY KEY,
  pathway_slug TEXT NOT NULL,
  start_date TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS favorite_affirmations (
  id SERIAL PRIMARY KEY,
  affirmation_text TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL DEFAULT '',
  mood TEXT,
  tags TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id SERIAL PRIMARY KEY,
  profile_id TEXT NOT NULL,
  activated_at TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS kids_stickers (
  id SERIAL PRIMARY KEY,
  pose_slug TEXT NOT NULL,
  earned_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS favorite_asanas (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS milestones (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  reached_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pose_notes (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  body TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mobility_check_ins (
  id SERIAL PRIMARY KEY,
  pathway_slug TEXT NOT NULL,
  day INTEGER NOT NULL,
  front_split_inches INTEGER NOT NULL,
  back_split_inches INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_flows (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  pose_sequence TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

-- Ensure a single preferences row exists
INSERT INTO preferences (motion_enabled, voice_enabled)
SELECT 1, 1
WHERE NOT EXISTS (SELECT 1 FROM preferences);
