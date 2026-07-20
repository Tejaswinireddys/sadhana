-- Auto-applied at server startup (idempotent). Mirrors shared/schema.ts (Postgres).
-- owner_id scopes every row to an anonymous device identity (X-Device-Id / cookie).

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL DEFAULT '',
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
  owner_id TEXT NOT NULL DEFAULT '',
  motion_enabled INTEGER NOT NULL DEFAULT 1,
  voice_enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS pathway_enrollments (
  id SERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL DEFAULT '',
  pathway_slug TEXT NOT NULL,
  start_date TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS favorite_affirmations (
  id SERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL DEFAULT '',
  affirmation_text TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id SERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL DEFAULT '',
  mood TEXT,
  tags TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id SERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL DEFAULT '',
  profile_id TEXT NOT NULL,
  activated_at TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS kids_stickers (
  id SERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL DEFAULT '',
  pose_slug TEXT NOT NULL,
  earned_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS favorite_asanas (
  id SERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS milestones (
  id SERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,
  reached_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pose_notes (
  id SERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mobility_check_ins (
  id SERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL DEFAULT '',
  pathway_slug TEXT NOT NULL,
  day INTEGER NOT NULL,
  front_split_inches INTEGER NOT NULL,
  back_split_inches INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_flows (
  id SERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  description TEXT,
  pose_sequence TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

-- Migrate pre-existing databases that were created without owner_id.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS owner_id TEXT NOT NULL DEFAULT '';
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS owner_id TEXT NOT NULL DEFAULT '';
ALTER TABLE pathway_enrollments ADD COLUMN IF NOT EXISTS owner_id TEXT NOT NULL DEFAULT '';
ALTER TABLE favorite_affirmations ADD COLUMN IF NOT EXISTS owner_id TEXT NOT NULL DEFAULT '';
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS owner_id TEXT NOT NULL DEFAULT '';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS owner_id TEXT NOT NULL DEFAULT '';
ALTER TABLE kids_stickers ADD COLUMN IF NOT EXISTS owner_id TEXT NOT NULL DEFAULT '';
ALTER TABLE favorite_asanas ADD COLUMN IF NOT EXISTS owner_id TEXT NOT NULL DEFAULT '';
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS owner_id TEXT NOT NULL DEFAULT '';
ALTER TABLE pose_notes ADD COLUMN IF NOT EXISTS owner_id TEXT NOT NULL DEFAULT '';
ALTER TABLE mobility_check_ins ADD COLUMN IF NOT EXISTS owner_id TEXT NOT NULL DEFAULT '';
ALTER TABLE custom_flows ADD COLUMN IF NOT EXISTS owner_id TEXT NOT NULL DEFAULT '';

-- Drop legacy global unique on pose slug so notes can be per-owner.
ALTER TABLE pose_notes DROP CONSTRAINT IF EXISTS pose_notes_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS pose_notes_owner_slug_idx ON pose_notes (owner_id, slug);
CREATE INDEX IF NOT EXISTS sessions_owner_idx ON sessions (owner_id);
CREATE INDEX IF NOT EXISTS preferences_owner_idx ON preferences (owner_id);
