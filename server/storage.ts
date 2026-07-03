import {
  sessions,
  pathwayEnrollments,
  favoriteAffirmations,
  journalEntries,
  preferences,
  userProfiles,
  kidsStickers,
  favoriteAsanas,
  milestones,
  poseNotes,
  mobilityCheckIns,
  coachSessions,
} from "@shared/schema";
import type {
  Session,
  InsertSession,
  Enrollment,
  InsertEnrollment,
  Favorite,
  InsertFavorite,
  Journal,
  InsertJournal,
  Preferences,
  InsertPreferences,
  UserProfile,
  Sticker,
  InsertSticker,
  FavoriteAsana,
  Milestone,
  InsertMilestone,
  PoseNote,
  MobilityCheckIn,
  InsertMobilityCheckIn,
  CoachSession,
  InsertCoachSession,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

// Ensure tables exist (no migration step needed for this template)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    asanas TEXT NOT NULL DEFAULT '[]',
    pathway_slug TEXT,
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS pathway_enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pathway_slug TEXT NOT NULL,
    start_date TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS favorite_affirmations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    affirmation_text TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    title TEXT,
    body TEXT NOT NULL DEFAULT '',
    mood TEXT,
    tags TEXT NOT NULL DEFAULT '[]'
  );
  CREATE TABLE IF NOT EXISTS preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    motion_enabled INTEGER NOT NULL DEFAULT 1,
    voice_enabled INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS user_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id TEXT NOT NULL,
    activated_at TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS kids_stickers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pose_slug TEXT NOT NULL,
    earned_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS favorite_asanas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    reached_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pose_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    body TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS mobility_check_ins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pathway_slug TEXT NOT NULL,
    day INTEGER NOT NULL,
    front_split_inches INTEGER NOT NULL,
    back_split_inches INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS coach_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    check_in TEXT NOT NULL,
    composed TEXT NOT NULL,
    outcome TEXT,
    post_mood TEXT,
    created_at TEXT NOT NULL
  );
`);

// --- Lightweight migration: add sessions.pre_mood / post_mood if missing ---
try {
  const cols = sqlite.prepare(`PRAGMA table_info(sessions)`).all() as { name: string }[];
  if (!cols.some((c) => c.name === "pre_mood")) {
    sqlite.exec(`ALTER TABLE sessions ADD COLUMN pre_mood TEXT`);
  }
  if (!cols.some((c) => c.name === "post_mood")) {
    sqlite.exec(`ALTER TABLE sessions ADD COLUMN post_mood TEXT`);
  }
} catch {
  /* ignore */
}

// --- Lightweight migration: add sessions.kind if it doesn't already exist ---
try {
  const cols = sqlite.prepare(`PRAGMA table_info(sessions)`).all() as { name: string }[];
  if (!cols.some((c) => c.name === "kind")) {
    sqlite.exec(`ALTER TABLE sessions ADD COLUMN kind TEXT NOT NULL DEFAULT 'asana'`);
  }
} catch {
  /* ignore */
}

// --- Lightweight migration: add preferences.voice_enabled if missing ---
try {
  const cols = sqlite.prepare(`PRAGMA table_info(preferences)`).all() as { name: string }[];
  if (!cols.some((c) => c.name === "voice_enabled")) {
    sqlite.exec(`ALTER TABLE preferences ADD COLUMN voice_enabled INTEGER NOT NULL DEFAULT 1`);
  }
} catch {
  /* ignore */
}

// Ensure a single preferences row exists
try {
  const row = sqlite.prepare(`SELECT COUNT(*) AS n FROM preferences`).get() as { n: number };
  if (!row || row.n === 0) {
    sqlite.exec(`INSERT INTO preferences (motion_enabled) VALUES (1)`);
  }
} catch {
  /* ignore */
}

export const db = drizzle(sqlite);

export interface IStorage {
  // sessions
  getSessions(): Promise<Session[]>;
  createSession(data: InsertSession): Promise<Session>;
  // enrollments
  getEnrollments(): Promise<Enrollment[]>;
  createEnrollment(data: InsertEnrollment): Promise<Enrollment>;
  deleteEnrollment(id: number): Promise<void>;
  // favorites
  getFavorites(): Promise<Favorite[]>;
  createFavorite(data: InsertFavorite): Promise<Favorite>;
  deleteFavorite(id: number): Promise<void>;
  // journal
  getJournal(): Promise<Journal[]>;
  createJournal(data: InsertJournal): Promise<Journal>;
  updateJournal(id: number, data: Partial<InsertJournal>): Promise<Journal | undefined>;
  deleteJournal(id: number): Promise<void>;
  // preferences
  getPreferences(): Promise<Preferences>;
  updatePreferences(data: Partial<InsertPreferences>): Promise<Preferences>;
  // profiles
  getActiveProfile(): Promise<UserProfile | undefined>;
  activateProfile(profileId: string): Promise<UserProfile>;
  deactivateProfile(): Promise<void>;
  // kids stickers
  getStickers(): Promise<Sticker[]>;
  createSticker(data: InsertSticker): Promise<Sticker>;
  // favorite asanas (v3.4)
  getFavoriteAsanas(): Promise<FavoriteAsana[]>;
  addFavoriteAsana(slug: string): Promise<FavoriteAsana>;
  removeFavoriteAsana(slug: string): Promise<void>;
  // milestones (v3.4)
  getMilestones(): Promise<Milestone[]>;
  createMilestone(data: InsertMilestone): Promise<Milestone>;
  // pose notes (v3.4)
  getPoseNote(slug: string): Promise<PoseNote | undefined>;
  upsertPoseNote(slug: string, body: string): Promise<PoseNote>;
  // mobility check-ins (v3.5)
  getMobilityCheckIns(pathwaySlug: string): Promise<MobilityCheckIn[]>;
  createMobilityCheckIn(data: InsertMobilityCheckIn): Promise<MobilityCheckIn>;
  deleteMobilityCheckIn(id: number): Promise<void>;
  // coach sessions (v4)
  getCoachSessions(limit?: number): Promise<CoachSession[]>;
  createCoachSession(data: InsertCoachSession): Promise<CoachSession>;
  updateCoachSessionOutcome(
    id: number,
    outcome: string,
    postMood: string | null,
  ): Promise<CoachSession | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getSessions(): Promise<Session[]> {
    return db.select().from(sessions).orderBy(desc(sessions.date)).all();
  }
  async createSession(data: InsertSession): Promise<Session> {
    return db.insert(sessions).values(data).returning().get();
  }

  async getEnrollments(): Promise<Enrollment[]> {
    return db.select().from(pathwayEnrollments).all();
  }
  async createEnrollment(data: InsertEnrollment): Promise<Enrollment> {
    return db.insert(pathwayEnrollments).values(data).returning().get();
  }
  async deleteEnrollment(id: number): Promise<void> {
    db.delete(pathwayEnrollments).where(eq(pathwayEnrollments.id, id)).run();
  }

  async getFavorites(): Promise<Favorite[]> {
    return db.select().from(favoriteAffirmations).orderBy(desc(favoriteAffirmations.createdAt)).all();
  }
  async createFavorite(data: InsertFavorite): Promise<Favorite> {
    return db.insert(favoriteAffirmations).values(data).returning().get();
  }
  async deleteFavorite(id: number): Promise<void> {
    db.delete(favoriteAffirmations).where(eq(favoriteAffirmations.id, id)).run();
  }

  async getJournal(): Promise<Journal[]> {
    return db.select().from(journalEntries).orderBy(desc(journalEntries.date)).all();
  }
  async createJournal(data: InsertJournal): Promise<Journal> {
    return db.insert(journalEntries).values(data).returning().get();
  }
  async updateJournal(id: number, data: Partial<InsertJournal>): Promise<Journal | undefined> {
    return db.update(journalEntries).set(data).where(eq(journalEntries.id, id)).returning().get();
  }
  async deleteJournal(id: number): Promise<void> {
    db.delete(journalEntries).where(eq(journalEntries.id, id)).run();
  }

  async getPreferences(): Promise<Preferences> {
    let row = db.select().from(preferences).limit(1).get();
    if (!row) {
      row = db.insert(preferences).values({ motionEnabled: 1, voiceEnabled: 1 }).returning().get();
    }
    return row;
  }
  async updatePreferences(data: Partial<InsertPreferences>): Promise<Preferences> {
    const current = await this.getPreferences();
    return db
      .update(preferences)
      .set(data)
      .where(eq(preferences.id, current.id))
      .returning()
      .get();
  }

  async getActiveProfile(): Promise<UserProfile | undefined> {
    return db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.active, true))
      .orderBy(desc(userProfiles.id))
      .limit(1)
      .get();
  }
  async activateProfile(profileId: string): Promise<UserProfile> {
    // Deactivate all existing active profiles, then insert a new active row
    db.update(userProfiles).set({ active: false }).where(eq(userProfiles.active, true)).run();
    return db
      .insert(userProfiles)
      .values({ profileId, activatedAt: new Date().toISOString(), active: true })
      .returning()
      .get();
  }
  async deactivateProfile(): Promise<void> {
    db.update(userProfiles).set({ active: false }).where(eq(userProfiles.active, true)).run();
  }

  async getStickers(): Promise<Sticker[]> {
    return db.select().from(kidsStickers).orderBy(desc(kidsStickers.earnedAt)).all();
  }
  async createSticker(data: InsertSticker): Promise<Sticker> {
    return db.insert(kidsStickers).values(data).returning().get();
  }

  async getFavoriteAsanas(): Promise<FavoriteAsana[]> {
    return db.select().from(favoriteAsanas).orderBy(desc(favoriteAsanas.createdAt)).all();
  }
  async addFavoriteAsana(slug: string): Promise<FavoriteAsana> {
    const existing = db.select().from(favoriteAsanas).where(eq(favoriteAsanas.slug, slug)).get();
    if (existing) return existing;
    return db
      .insert(favoriteAsanas)
      .values({ slug, createdAt: new Date().toISOString() })
      .returning()
      .get();
  }
  async removeFavoriteAsana(slug: string): Promise<void> {
    db.delete(favoriteAsanas).where(eq(favoriteAsanas.slug, slug)).run();
  }

  async getMilestones(): Promise<Milestone[]> {
    return db.select().from(milestones).orderBy(desc(milestones.reachedAt)).all();
  }
  async createMilestone(data: InsertMilestone): Promise<Milestone> {
    const existing = db.select().from(milestones).where(eq(milestones.kind, data.kind)).get();
    if (existing) return existing;
    return db.insert(milestones).values(data).returning().get();
  }

  async getPoseNote(slug: string): Promise<PoseNote | undefined> {
    return db.select().from(poseNotes).where(eq(poseNotes.slug, slug)).get();
  }
  async upsertPoseNote(slug: string, body: string): Promise<PoseNote> {
    const now = new Date().toISOString();
    const existing = db.select().from(poseNotes).where(eq(poseNotes.slug, slug)).get();
    if (existing) {
      return db
        .update(poseNotes)
        .set({ body, updatedAt: now })
        .where(eq(poseNotes.slug, slug))
        .returning()
        .get();
    }
    return db.insert(poseNotes).values({ slug, body, updatedAt: now }).returning().get();
  }

  async getMobilityCheckIns(pathwaySlug: string): Promise<MobilityCheckIn[]> {
    return db
      .select()
      .from(mobilityCheckIns)
      .where(eq(mobilityCheckIns.pathwaySlug, pathwaySlug))
      .orderBy(mobilityCheckIns.day)
      .all();
  }
  async createMobilityCheckIn(data: InsertMobilityCheckIn): Promise<MobilityCheckIn> {
    return db.insert(mobilityCheckIns).values(data).returning().get();
  }
  async deleteMobilityCheckIn(id: number): Promise<void> {
    db.delete(mobilityCheckIns).where(eq(mobilityCheckIns.id, id)).run();
  }

  async getCoachSessions(limit = 20): Promise<CoachSession[]> {
    return db
      .select()
      .from(coachSessions)
      .orderBy(desc(coachSessions.createdAt))
      .limit(limit)
      .all();
  }
  async createCoachSession(data: InsertCoachSession): Promise<CoachSession> {
    return db.insert(coachSessions).values(data).returning().get();
  }
  async updateCoachSessionOutcome(
    id: number,
    outcome: string,
    postMood: string | null,
  ): Promise<CoachSession | undefined> {
    return db
      .update(coachSessions)
      .set({ outcome, postMood })
      .where(eq(coachSessions.id, id))
      .returning()
      .get();
  }
}

export const storage = new DatabaseStorage();
