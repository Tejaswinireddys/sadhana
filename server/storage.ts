import {
  sessions,
  pathwayEnrollments,
  favoriteAffirmations,
  journalEntries,
  preferences,
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
    motion_enabled INTEGER NOT NULL DEFAULT 1
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
      row = db.insert(preferences).values({ motionEnabled: 1 }).returning().get();
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
}

export const storage = new DatabaseStorage();
