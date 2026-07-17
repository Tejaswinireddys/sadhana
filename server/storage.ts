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
  customFlows,
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
  CustomFlow,
  InsertCustomFlow,
} from "@shared/schema";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool);

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
  // custom flows (v5.1)
  getCustomFlows(): Promise<CustomFlow[]>;
  getCustomFlow(id: number): Promise<CustomFlow | undefined>;
  createCustomFlow(data: InsertCustomFlow): Promise<CustomFlow>;
  updateCustomFlow(id: number, data: Partial<InsertCustomFlow>): Promise<CustomFlow | undefined>;
  deleteCustomFlow(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getSessions(): Promise<Session[]> {
    return db.select().from(sessions).orderBy(desc(sessions.date));
  }
  async createSession(data: InsertSession): Promise<Session> {
    const [row] = await db.insert(sessions).values(data).returning();
    return row;
  }

  async getEnrollments(): Promise<Enrollment[]> {
    return db.select().from(pathwayEnrollments);
  }
  async createEnrollment(data: InsertEnrollment): Promise<Enrollment> {
    const [row] = await db.insert(pathwayEnrollments).values(data).returning();
    return row;
  }
  async deleteEnrollment(id: number): Promise<void> {
    await db.delete(pathwayEnrollments).where(eq(pathwayEnrollments.id, id));
  }

  async getFavorites(): Promise<Favorite[]> {
    return db.select().from(favoriteAffirmations).orderBy(desc(favoriteAffirmations.createdAt));
  }
  async createFavorite(data: InsertFavorite): Promise<Favorite> {
    const [row] = await db.insert(favoriteAffirmations).values(data).returning();
    return row;
  }
  async deleteFavorite(id: number): Promise<void> {
    await db.delete(favoriteAffirmations).where(eq(favoriteAffirmations.id, id));
  }

  async getJournal(): Promise<Journal[]> {
    return db.select().from(journalEntries).orderBy(desc(journalEntries.date));
  }
  async createJournal(data: InsertJournal): Promise<Journal> {
    const [row] = await db.insert(journalEntries).values(data).returning();
    return row;
  }
  async updateJournal(id: number, data: Partial<InsertJournal>): Promise<Journal | undefined> {
    const [row] = await db
      .update(journalEntries)
      .set(data)
      .where(eq(journalEntries.id, id))
      .returning();
    return row;
  }
  async deleteJournal(id: number): Promise<void> {
    await db.delete(journalEntries).where(eq(journalEntries.id, id));
  }

  async getPreferences(): Promise<Preferences> {
    const [existing] = await db.select().from(preferences).limit(1);
    if (existing) return existing;
    const [created] = await db
      .insert(preferences)
      .values({ motionEnabled: 1, voiceEnabled: 1 })
      .returning();
    return created;
  }
  async updatePreferences(data: Partial<InsertPreferences>): Promise<Preferences> {
    const current = await this.getPreferences();
    const [row] = await db
      .update(preferences)
      .set(data)
      .where(eq(preferences.id, current.id))
      .returning();
    return row;
  }

  async getActiveProfile(): Promise<UserProfile | undefined> {
    const [row] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.active, true))
      .orderBy(desc(userProfiles.id))
      .limit(1);
    return row;
  }
  async activateProfile(profileId: string): Promise<UserProfile> {
    // Deactivate all existing active profiles, then insert a new active row
    await db.update(userProfiles).set({ active: false }).where(eq(userProfiles.active, true));
    const [row] = await db
      .insert(userProfiles)
      .values({ profileId, activatedAt: new Date().toISOString(), active: true })
      .returning();
    return row;
  }
  async deactivateProfile(): Promise<void> {
    await db.update(userProfiles).set({ active: false }).where(eq(userProfiles.active, true));
  }

  async getStickers(): Promise<Sticker[]> {
    return db.select().from(kidsStickers).orderBy(desc(kidsStickers.earnedAt));
  }
  async createSticker(data: InsertSticker): Promise<Sticker> {
    const [row] = await db.insert(kidsStickers).values(data).returning();
    return row;
  }

  async getFavoriteAsanas(): Promise<FavoriteAsana[]> {
    return db.select().from(favoriteAsanas).orderBy(desc(favoriteAsanas.createdAt));
  }
  async addFavoriteAsana(slug: string): Promise<FavoriteAsana> {
    const [existing] = await db
      .select()
      .from(favoriteAsanas)
      .where(eq(favoriteAsanas.slug, slug))
      .limit(1);
    if (existing) return existing;
    const [row] = await db
      .insert(favoriteAsanas)
      .values({ slug, createdAt: new Date().toISOString() })
      .returning();
    return row;
  }
  async removeFavoriteAsana(slug: string): Promise<void> {
    await db.delete(favoriteAsanas).where(eq(favoriteAsanas.slug, slug));
  }

  async getMilestones(): Promise<Milestone[]> {
    return db.select().from(milestones).orderBy(desc(milestones.reachedAt));
  }
  async createMilestone(data: InsertMilestone): Promise<Milestone> {
    const [existing] = await db
      .select()
      .from(milestones)
      .where(eq(milestones.kind, data.kind))
      .limit(1);
    if (existing) return existing;
    const [row] = await db.insert(milestones).values(data).returning();
    return row;
  }

  async getPoseNote(slug: string): Promise<PoseNote | undefined> {
    const [row] = await db.select().from(poseNotes).where(eq(poseNotes.slug, slug)).limit(1);
    return row;
  }
  async upsertPoseNote(slug: string, body: string): Promise<PoseNote> {
    const now = new Date().toISOString();
    const [existing] = await db
      .select()
      .from(poseNotes)
      .where(eq(poseNotes.slug, slug))
      .limit(1);
    if (existing) {
      const [row] = await db
        .update(poseNotes)
        .set({ body, updatedAt: now })
        .where(eq(poseNotes.slug, slug))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(poseNotes)
      .values({ slug, body, updatedAt: now })
      .returning();
    return row;
  }

  async getMobilityCheckIns(pathwaySlug: string): Promise<MobilityCheckIn[]> {
    return db
      .select()
      .from(mobilityCheckIns)
      .where(eq(mobilityCheckIns.pathwaySlug, pathwaySlug))
      .orderBy(mobilityCheckIns.day);
  }
  async createMobilityCheckIn(data: InsertMobilityCheckIn): Promise<MobilityCheckIn> {
    const [row] = await db.insert(mobilityCheckIns).values(data).returning();
    return row;
  }
  async getCustomFlows(): Promise<CustomFlow[]> {
    return db.select().from(customFlows).orderBy(desc(customFlows.id));
  }
  async getCustomFlow(id: number): Promise<CustomFlow | undefined> {
    const [row] = await db.select().from(customFlows).where(eq(customFlows.id, id)).limit(1);
    return row;
  }
  async createCustomFlow(data: InsertCustomFlow): Promise<CustomFlow> {
    const [row] = await db.insert(customFlows).values(data).returning();
    return row;
  }
  async updateCustomFlow(
    id: number,
    data: Partial<InsertCustomFlow>,
  ): Promise<CustomFlow | undefined> {
    await db.update(customFlows).set(data).where(eq(customFlows.id, id));
    const [row] = await db.select().from(customFlows).where(eq(customFlows.id, id)).limit(1);
    return row;
  }
  async deleteCustomFlow(id: number): Promise<void> {
    await db.delete(customFlows).where(eq(customFlows.id, id));
  }
  async deleteMobilityCheckIn(id: number): Promise<void> {
    await db.delete(mobilityCheckIns).where(eq(mobilityCheckIns.id, id));
  }
}

export const storage = new DatabaseStorage();
