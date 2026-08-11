-- Auto-applied at server startup (idempotent). Mirrors shared/schema.ts (Postgres).
-- owner_id scopes every row to an anonymous device identity (X-Device-Id / cookie).

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  planned_minutes INTEGER,
  poses_completed INTEGER,
  poses_skipped INTEGER,
  asanas TEXT NOT NULL DEFAULT '[]',
  pathway_slug TEXT,
  notes TEXT,
  kind TEXT NOT NULL DEFAULT 'asana',
  pre_mood TEXT,
  post_mood TEXT
);

-- RPE for adaptive recovery (nullable for legacy rows)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS rpe INTEGER;

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
-- Duration accounting: duration_minutes is elapsed time; planned_minutes is
-- what the session was designed to take. Nullable so legacy rows stay valid.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS planned_minutes INTEGER;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS poses_completed INTEGER;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS poses_skipped INTEGER;
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
CREATE INDEX IF NOT EXISTS sessions_owner_date_idx ON sessions (owner_id, date);
CREATE INDEX IF NOT EXISTS preferences_owner_idx ON preferences (owner_id);
CREATE INDEX IF NOT EXISTS pathway_enrollments_owner_idx ON pathway_enrollments (owner_id);
CREATE INDEX IF NOT EXISTS favorite_affirmations_owner_idx ON favorite_affirmations (owner_id);
CREATE INDEX IF NOT EXISTS journal_entries_owner_idx ON journal_entries (owner_id);
CREATE INDEX IF NOT EXISTS journal_entries_owner_date_idx ON journal_entries (owner_id, date);
CREATE INDEX IF NOT EXISTS user_profiles_owner_idx ON user_profiles (owner_id);
CREATE INDEX IF NOT EXISTS kids_stickers_owner_idx ON kids_stickers (owner_id);
CREATE INDEX IF NOT EXISTS favorite_asanas_owner_idx ON favorite_asanas (owner_id);
CREATE INDEX IF NOT EXISTS milestones_owner_idx ON milestones (owner_id);
CREATE INDEX IF NOT EXISTS mobility_check_ins_owner_idx ON mobility_check_ins (owner_id);
CREATE INDEX IF NOT EXISTS custom_flows_owner_idx ON custom_flows (owner_id);

-- Optional accounts (v6). Guests keep using an anonymous device owner id.
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);
-- Existing rows stay verified; new signups set email_verified = false explicitly.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id SERIAL PRIMARY KEY,
  token TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_token_idx ON auth_sessions (token);
CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions (user_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_hash_idx ON password_reset_tokens (token_hash);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens (user_id);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS email_verification_tokens_hash_idx ON email_verification_tokens (token_hash);
CREATE INDEX IF NOT EXISTS email_verification_tokens_user_idx ON email_verification_tokens (user_id);

-- Billing entitlements, keyed by owner id (device/account). One durable row per
-- owner — this is where Stripe subscription state lives now (was a JSON file on
-- Render's ephemeral disk). Mirrors shared/schema.ts.
CREATE TABLE IF NOT EXISTS entitlements (
  id SERIAL PRIMARY KEY,
  owner_id TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  renews_at TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  updated_at TEXT NOT NULL DEFAULT ''
);
-- Migrate an earlier user_id-based scaffold (if present) to the owner-based shape.
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS renews_at TEXT;
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS updated_at TEXT NOT NULL DEFAULT '';
-- Legacy NOT NULL columns must not block owner-based inserts. Ignore if absent.
DO $$ BEGIN
  ALTER TABLE entitlements ALTER COLUMN user_id DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE entitlements ALTER COLUMN created_at DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS entitlements_owner_id_unique ON entitlements (owner_id);

-- Backfill FKs on databases created before REFERENCES existed (ignore if already present).
DO $$ BEGIN
  ALTER TABLE auth_sessions
    ADD CONSTRAINT auth_sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
