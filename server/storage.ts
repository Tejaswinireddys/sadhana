import {
  sessions,
  pathwayEnrollments,
  favoriteAffirmations,
  journalEntries,
  preferences,
  userProfiles,
  kidsStickers,
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
`);

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
}

export const storage = new DatabaseStorage();
