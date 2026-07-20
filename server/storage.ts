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
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  getSessions(ownerId: string): Promise<Session[]>;
  createSession(ownerId: string, data: InsertSession): Promise<Session>;
  deleteSession(ownerId: string, id: number): Promise<boolean>;
  clearOwnerData(ownerId: string): Promise<void>;
  getEnrollments(ownerId: string): Promise<Enrollment[]>;
  createEnrollment(ownerId: string, data: InsertEnrollment): Promise<Enrollment>;
  deleteEnrollment(ownerId: string, id: number): Promise<void>;
  getFavorites(ownerId: string): Promise<Favorite[]>;
  createFavorite(ownerId: string, data: InsertFavorite): Promise<Favorite>;
  deleteFavorite(ownerId: string, id: number): Promise<void>;
  getJournal(ownerId: string): Promise<Journal[]>;
  createJournal(ownerId: string, data: InsertJournal): Promise<Journal>;
  updateJournal(
    ownerId: string,
    id: number,
    data: Partial<InsertJournal>,
  ): Promise<Journal | undefined>;
  deleteJournal(ownerId: string, id: number): Promise<void>;
  getPreferences(ownerId: string): Promise<Preferences>;
  updatePreferences(ownerId: string, data: Partial<InsertPreferences>): Promise<Preferences>;
  getActiveProfile(ownerId: string): Promise<UserProfile | undefined>;
  activateProfile(ownerId: string, profileId: string): Promise<UserProfile>;
  deactivateProfile(ownerId: string): Promise<void>;
  getStickers(ownerId: string): Promise<Sticker[]>;
  createSticker(ownerId: string, data: InsertSticker): Promise<Sticker>;
  getFavoriteAsanas(ownerId: string): Promise<FavoriteAsana[]>;
  addFavoriteAsana(ownerId: string, slug: string): Promise<FavoriteAsana>;
  removeFavoriteAsana(ownerId: string, slug: string): Promise<void>;
  getMilestones(ownerId: string): Promise<Milestone[]>;
  createMilestone(ownerId: string, data: InsertMilestone): Promise<Milestone>;
  getPoseNote(ownerId: string, slug: string): Promise<PoseNote | undefined>;
  upsertPoseNote(ownerId: string, slug: string, body: string): Promise<PoseNote>;
  getMobilityCheckIns(ownerId: string, pathwaySlug: string): Promise<MobilityCheckIn[]>;
  createMobilityCheckIn(ownerId: string, data: InsertMobilityCheckIn): Promise<MobilityCheckIn>;
  deleteMobilityCheckIn(ownerId: string, id: number): Promise<void>;
  getCustomFlows(ownerId: string): Promise<CustomFlow[]>;
  getCustomFlow(ownerId: string, id: number): Promise<CustomFlow | undefined>;
  createCustomFlow(ownerId: string, data: InsertCustomFlow): Promise<CustomFlow>;
  updateCustomFlow(
    ownerId: string,
    id: number,
    data: Partial<InsertCustomFlow>,
  ): Promise<CustomFlow | undefined>;
  deleteCustomFlow(ownerId: string, id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  constructor(private readonly db: ReturnType<typeof drizzle>) {}

  async getSessions(ownerId: string): Promise<Session[]> {
    return this.db
      .select()
      .from(sessions)
      .where(eq(sessions.ownerId, ownerId))
      .orderBy(desc(sessions.date));
  }
  async createSession(ownerId: string, data: InsertSession): Promise<Session> {
    const [row] = await this.db
      .insert(sessions)
      .values({ ...data, ownerId })
      .returning();
    return row;
  }
  async deleteSession(ownerId: string, id: number): Promise<boolean> {
    const rows = await this.db
      .delete(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.ownerId, ownerId)))
      .returning();
    return rows.length > 0;
  }
  async clearOwnerData(ownerId: string): Promise<void> {
    await Promise.all([
      this.db.delete(sessions).where(eq(sessions.ownerId, ownerId)),
      this.db.delete(pathwayEnrollments).where(eq(pathwayEnrollments.ownerId, ownerId)),
      this.db.delete(favoriteAffirmations).where(eq(favoriteAffirmations.ownerId, ownerId)),
      this.db.delete(journalEntries).where(eq(journalEntries.ownerId, ownerId)),
      this.db.delete(preferences).where(eq(preferences.ownerId, ownerId)),
      this.db.delete(userProfiles).where(eq(userProfiles.ownerId, ownerId)),
      this.db.delete(kidsStickers).where(eq(kidsStickers.ownerId, ownerId)),
      this.db.delete(favoriteAsanas).where(eq(favoriteAsanas.ownerId, ownerId)),
      this.db.delete(milestones).where(eq(milestones.ownerId, ownerId)),
      this.db.delete(poseNotes).where(eq(poseNotes.ownerId, ownerId)),
      this.db.delete(mobilityCheckIns).where(eq(mobilityCheckIns.ownerId, ownerId)),
      this.db.delete(customFlows).where(eq(customFlows.ownerId, ownerId)),
    ]);
  }

  async getEnrollments(ownerId: string): Promise<Enrollment[]> {
    return this.db
      .select()
      .from(pathwayEnrollments)
      .where(eq(pathwayEnrollments.ownerId, ownerId));
  }
  async createEnrollment(ownerId: string, data: InsertEnrollment): Promise<Enrollment> {
    const [row] = await this.db
      .insert(pathwayEnrollments)
      .values({ ...data, ownerId })
      .returning();
    return row;
  }
  async deleteEnrollment(ownerId: string, id: number): Promise<void> {
    await this.db
      .delete(pathwayEnrollments)
      .where(and(eq(pathwayEnrollments.id, id), eq(pathwayEnrollments.ownerId, ownerId)));
  }

  async getFavorites(ownerId: string): Promise<Favorite[]> {
    return this.db
      .select()
      .from(favoriteAffirmations)
      .where(eq(favoriteAffirmations.ownerId, ownerId))
      .orderBy(desc(favoriteAffirmations.createdAt));
  }
  async createFavorite(ownerId: string, data: InsertFavorite): Promise<Favorite> {
    const [row] = await this.db
      .insert(favoriteAffirmations)
      .values({ ...data, ownerId })
      .returning();
    return row;
  }
  async deleteFavorite(ownerId: string, id: number): Promise<void> {
    await this.db
      .delete(favoriteAffirmations)
      .where(and(eq(favoriteAffirmations.id, id), eq(favoriteAffirmations.ownerId, ownerId)));
  }

  async getJournal(ownerId: string): Promise<Journal[]> {
    return this.db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.ownerId, ownerId))
      .orderBy(desc(journalEntries.date));
  }
  async createJournal(ownerId: string, data: InsertJournal): Promise<Journal> {
    const [row] = await this.db
      .insert(journalEntries)
      .values({ ...data, ownerId })
      .returning();
    return row;
  }
  async updateJournal(
    ownerId: string,
    id: number,
    data: Partial<InsertJournal>,
  ): Promise<Journal | undefined> {
    const [row] = await this.db
      .update(journalEntries)
      .set(data)
      .where(and(eq(journalEntries.id, id), eq(journalEntries.ownerId, ownerId)))
      .returning();
    return row;
  }
  async deleteJournal(ownerId: string, id: number): Promise<void> {
    await this.db
      .delete(journalEntries)
      .where(and(eq(journalEntries.id, id), eq(journalEntries.ownerId, ownerId)));
  }

  async getPreferences(ownerId: string): Promise<Preferences> {
    const [existing] = await this.db
      .select()
      .from(preferences)
      .where(eq(preferences.ownerId, ownerId))
      .limit(1);
    if (existing) return existing;
    const [created] = await this.db
      .insert(preferences)
      .values({ ownerId, motionEnabled: 1, voiceEnabled: 1 })
      .returning();
    return created;
  }
  async updatePreferences(
    ownerId: string,
    data: Partial<InsertPreferences>,
  ): Promise<Preferences> {
    const current = await this.getPreferences(ownerId);
    const [row] = await this.db
      .update(preferences)
      .set(data)
      .where(and(eq(preferences.id, current.id), eq(preferences.ownerId, ownerId)))
      .returning();
    return row;
  }

  async getActiveProfile(ownerId: string): Promise<UserProfile | undefined> {
    const [row] = await this.db
      .select()
      .from(userProfiles)
      .where(and(eq(userProfiles.ownerId, ownerId), eq(userProfiles.active, true)))
      .orderBy(desc(userProfiles.id))
      .limit(1);
    return row;
  }
  async activateProfile(ownerId: string, profileId: string): Promise<UserProfile> {
    await this.db
      .update(userProfiles)
      .set({ active: false })
      .where(and(eq(userProfiles.ownerId, ownerId), eq(userProfiles.active, true)));
    const [row] = await this.db
      .insert(userProfiles)
      .values({ ownerId, profileId, activatedAt: new Date().toISOString(), active: true })
      .returning();
    return row;
  }
  async deactivateProfile(ownerId: string): Promise<void> {
    await this.db
      .update(userProfiles)
      .set({ active: false })
      .where(and(eq(userProfiles.ownerId, ownerId), eq(userProfiles.active, true)));
  }

  async getStickers(ownerId: string): Promise<Sticker[]> {
    return this.db
      .select()
      .from(kidsStickers)
      .where(eq(kidsStickers.ownerId, ownerId))
      .orderBy(desc(kidsStickers.earnedAt));
  }
  async createSticker(ownerId: string, data: InsertSticker): Promise<Sticker> {
    const [row] = await this.db
      .insert(kidsStickers)
      .values({ ...data, ownerId })
      .returning();
    return row;
  }

  async getFavoriteAsanas(ownerId: string): Promise<FavoriteAsana[]> {
    return this.db
      .select()
      .from(favoriteAsanas)
      .where(eq(favoriteAsanas.ownerId, ownerId))
      .orderBy(desc(favoriteAsanas.createdAt));
  }
  async addFavoriteAsana(ownerId: string, slug: string): Promise<FavoriteAsana> {
    const [existing] = await this.db
      .select()
      .from(favoriteAsanas)
      .where(and(eq(favoriteAsanas.ownerId, ownerId), eq(favoriteAsanas.slug, slug)))
      .limit(1);
    if (existing) return existing;
    const [row] = await this.db
      .insert(favoriteAsanas)
      .values({ ownerId, slug, createdAt: new Date().toISOString() })
      .returning();
    return row;
  }
  async removeFavoriteAsana(ownerId: string, slug: string): Promise<void> {
    await this.db
      .delete(favoriteAsanas)
      .where(and(eq(favoriteAsanas.ownerId, ownerId), eq(favoriteAsanas.slug, slug)));
  }

  async getMilestones(ownerId: string): Promise<Milestone[]> {
    return this.db
      .select()
      .from(milestones)
      .where(eq(milestones.ownerId, ownerId))
      .orderBy(desc(milestones.reachedAt));
  }
  async createMilestone(ownerId: string, data: InsertMilestone): Promise<Milestone> {
    const [existing] = await this.db
      .select()
      .from(milestones)
      .where(and(eq(milestones.ownerId, ownerId), eq(milestones.kind, data.kind)))
      .limit(1);
    if (existing) return existing;
    const [row] = await this.db
      .insert(milestones)
      .values({ ...data, ownerId })
      .returning();
    return row;
  }

  async getPoseNote(ownerId: string, slug: string): Promise<PoseNote | undefined> {
    const [row] = await this.db
      .select()
      .from(poseNotes)
      .where(and(eq(poseNotes.ownerId, ownerId), eq(poseNotes.slug, slug)))
      .limit(1);
    return row;
  }
  async upsertPoseNote(ownerId: string, slug: string, body: string): Promise<PoseNote> {
    const now = new Date().toISOString();
    const existing = await this.getPoseNote(ownerId, slug);
    if (existing) {
      const [row] = await this.db
        .update(poseNotes)
        .set({ body, updatedAt: now })
        .where(and(eq(poseNotes.ownerId, ownerId), eq(poseNotes.slug, slug)))
        .returning();
      return row;
    }
    const [row] = await this.db
      .insert(poseNotes)
      .values({ ownerId, slug, body, updatedAt: now })
      .returning();
    return row;
  }

  async getMobilityCheckIns(ownerId: string, pathwaySlug: string): Promise<MobilityCheckIn[]> {
    return this.db
      .select()
      .from(mobilityCheckIns)
      .where(
        and(eq(mobilityCheckIns.ownerId, ownerId), eq(mobilityCheckIns.pathwaySlug, pathwaySlug)),
      )
      .orderBy(mobilityCheckIns.day);
  }
  async createMobilityCheckIn(
    ownerId: string,
    data: InsertMobilityCheckIn,
  ): Promise<MobilityCheckIn> {
    const [row] = await this.db
      .insert(mobilityCheckIns)
      .values({ ...data, ownerId })
      .returning();
    return row;
  }
  async deleteMobilityCheckIn(ownerId: string, id: number): Promise<void> {
    await this.db
      .delete(mobilityCheckIns)
      .where(and(eq(mobilityCheckIns.id, id), eq(mobilityCheckIns.ownerId, ownerId)));
  }

  async getCustomFlows(ownerId: string): Promise<CustomFlow[]> {
    return this.db
      .select()
      .from(customFlows)
      .where(eq(customFlows.ownerId, ownerId))
      .orderBy(desc(customFlows.id));
  }
  async getCustomFlow(ownerId: string, id: number): Promise<CustomFlow | undefined> {
    const [row] = await this.db
      .select()
      .from(customFlows)
      .where(and(eq(customFlows.id, id), eq(customFlows.ownerId, ownerId)))
      .limit(1);
    return row;
  }
  async createCustomFlow(ownerId: string, data: InsertCustomFlow): Promise<CustomFlow> {
    const [row] = await this.db
      .insert(customFlows)
      .values({ ...data, ownerId })
      .returning();
    return row;
  }
  async updateCustomFlow(
    ownerId: string,
    id: number,
    data: Partial<InsertCustomFlow>,
  ): Promise<CustomFlow | undefined> {
    await this.db
      .update(customFlows)
      .set(data)
      .where(and(eq(customFlows.id, id), eq(customFlows.ownerId, ownerId)));
    return this.getCustomFlow(ownerId, id);
  }
  async deleteCustomFlow(ownerId: string, id: number): Promise<void> {
    await this.db
      .delete(customFlows)
      .where(and(eq(customFlows.id, id), eq(customFlows.ownerId, ownerId)));
  }
}

/** In-memory store for local/dev when DATABASE_URL is unset. */
export class MemoryStorage implements IStorage {
  private seq = 1;
  private sessions: Session[] = [];
  private enrollments: Enrollment[] = [];
  private favorites: Favorite[] = [];
  private journal: Journal[] = [];
  private prefs = new Map<string, Preferences>();
  private profiles: UserProfile[] = [];
  private stickers: Sticker[] = [];
  private favAsanas: FavoriteAsana[] = [];
  private milestones: Milestone[] = [];
  private notes: PoseNote[] = [];
  private mobility: MobilityCheckIn[] = [];
  private flows: CustomFlow[] = [];

  private nextId() {
    return this.seq++;
  }

  async getSessions(ownerId: string) {
    return this.sessions.filter((s) => s.ownerId === ownerId).sort((a, b) => (a.date < b.date ? 1 : -1));
  }
  async createSession(ownerId: string, data: InsertSession) {
    const row: Session = { id: this.nextId(), ownerId, ...data } as Session;
    this.sessions.push(row);
    return row;
  }
  async deleteSession(ownerId: string, id: number) {
    const before = this.sessions.length;
    this.sessions = this.sessions.filter((s) => !(s.id === id && s.ownerId === ownerId));
    return this.sessions.length < before;
  }
  async clearOwnerData(ownerId: string) {
    this.sessions = this.sessions.filter((s) => s.ownerId !== ownerId);
    this.enrollments = this.enrollments.filter((e) => e.ownerId !== ownerId);
    this.favorites = this.favorites.filter((f) => f.ownerId !== ownerId);
    this.journal = this.journal.filter((j) => j.ownerId !== ownerId);
    this.prefs.delete(ownerId);
    this.profiles = this.profiles.filter((p) => p.ownerId !== ownerId);
    this.stickers = this.stickers.filter((s) => s.ownerId !== ownerId);
    this.favAsanas = this.favAsanas.filter((f) => f.ownerId !== ownerId);
    this.milestones = this.milestones.filter((m) => m.ownerId !== ownerId);
    this.notes = this.notes.filter((n) => n.ownerId !== ownerId);
    this.mobility = this.mobility.filter((m) => m.ownerId !== ownerId);
    this.flows = this.flows.filter((f) => f.ownerId !== ownerId);
  }

  async getEnrollments(ownerId: string) {
    return this.enrollments.filter((e) => e.ownerId === ownerId);
  }
  async createEnrollment(ownerId: string, data: InsertEnrollment) {
    const row: Enrollment = { id: this.nextId(), ownerId, ...data } as Enrollment;
    this.enrollments.push(row);
    return row;
  }
  async deleteEnrollment(ownerId: string, id: number) {
    this.enrollments = this.enrollments.filter((e) => !(e.id === id && e.ownerId === ownerId));
  }

  async getFavorites(ownerId: string) {
    return this.favorites
      .filter((f) => f.ownerId === ownerId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  async createFavorite(ownerId: string, data: InsertFavorite) {
    const row: Favorite = { id: this.nextId(), ownerId, ...data } as Favorite;
    this.favorites.push(row);
    return row;
  }
  async deleteFavorite(ownerId: string, id: number) {
    this.favorites = this.favorites.filter((f) => !(f.id === id && f.ownerId === ownerId));
  }

  async getJournal(ownerId: string) {
    return this.journal
      .filter((j) => j.ownerId === ownerId)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }
  async createJournal(ownerId: string, data: InsertJournal) {
    const row: Journal = { id: this.nextId(), ownerId, ...data } as Journal;
    this.journal.push(row);
    return row;
  }
  async updateJournal(ownerId: string, id: number, data: Partial<InsertJournal>) {
    const row = this.journal.find((j) => j.id === id && j.ownerId === ownerId);
    if (!row) return undefined;
    Object.assign(row, data);
    return row;
  }
  async deleteJournal(ownerId: string, id: number) {
    this.journal = this.journal.filter((j) => !(j.id === id && j.ownerId === ownerId));
  }

  async getPreferences(ownerId: string) {
    let p = this.prefs.get(ownerId);
    if (!p) {
      p = { id: this.nextId(), ownerId, motionEnabled: 1, voiceEnabled: 1 };
      this.prefs.set(ownerId, p);
    }
    return p;
  }
  async updatePreferences(ownerId: string, data: Partial<InsertPreferences>) {
    const current = await this.getPreferences(ownerId);
    Object.assign(current, data);
    return current;
  }

  async getActiveProfile(ownerId: string) {
    return this.profiles.find((p) => p.ownerId === ownerId && p.active);
  }
  async activateProfile(ownerId: string, profileId: string) {
    for (const p of this.profiles) {
      if (p.ownerId === ownerId && p.active) p.active = false;
    }
    const row: UserProfile = {
      id: this.nextId(),
      ownerId,
      profileId,
      activatedAt: new Date().toISOString(),
      active: true,
    };
    this.profiles.push(row);
    return row;
  }
  async deactivateProfile(ownerId: string) {
    for (const p of this.profiles) {
      if (p.ownerId === ownerId && p.active) p.active = false;
    }
  }

  async getStickers(ownerId: string) {
    return this.stickers
      .filter((s) => s.ownerId === ownerId)
      .sort((a, b) => (a.earnedAt < b.earnedAt ? 1 : -1));
  }
  async createSticker(ownerId: string, data: InsertSticker) {
    const row: Sticker = { id: this.nextId(), ownerId, ...data } as Sticker;
    this.stickers.push(row);
    return row;
  }

  async getFavoriteAsanas(ownerId: string) {
    return this.favAsanas
      .filter((f) => f.ownerId === ownerId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  async addFavoriteAsana(ownerId: string, slug: string) {
    const existing = this.favAsanas.find((f) => f.ownerId === ownerId && f.slug === slug);
    if (existing) return existing;
    const row: FavoriteAsana = {
      id: this.nextId(),
      ownerId,
      slug,
      createdAt: new Date().toISOString(),
    };
    this.favAsanas.push(row);
    return row;
  }
  async removeFavoriteAsana(ownerId: string, slug: string) {
    this.favAsanas = this.favAsanas.filter((f) => !(f.ownerId === ownerId && f.slug === slug));
  }

  async getMilestones(ownerId: string) {
    return this.milestones
      .filter((m) => m.ownerId === ownerId)
      .sort((a, b) => (a.reachedAt < b.reachedAt ? 1 : -1));
  }
  async createMilestone(ownerId: string, data: InsertMilestone) {
    const existing = this.milestones.find((m) => m.ownerId === ownerId && m.kind === data.kind);
    if (existing) return existing;
    const row: Milestone = { id: this.nextId(), ownerId, ...data } as Milestone;
    this.milestones.push(row);
    return row;
  }

  async getPoseNote(ownerId: string, slug: string) {
    return this.notes.find((n) => n.ownerId === ownerId && n.slug === slug);
  }
  async upsertPoseNote(ownerId: string, slug: string, body: string) {
    const now = new Date().toISOString();
    const existing = await this.getPoseNote(ownerId, slug);
    if (existing) {
      existing.body = body;
      existing.updatedAt = now;
      return existing;
    }
    const row: PoseNote = { id: this.nextId(), ownerId, slug, body, updatedAt: now };
    this.notes.push(row);
    return row;
  }

  async getMobilityCheckIns(ownerId: string, pathwaySlug: string) {
    return this.mobility
      .filter((m) => m.ownerId === ownerId && m.pathwaySlug === pathwaySlug)
      .sort((a, b) => a.day - b.day);
  }
  async createMobilityCheckIn(ownerId: string, data: InsertMobilityCheckIn) {
    const row: MobilityCheckIn = { id: this.nextId(), ownerId, ...data } as MobilityCheckIn;
    this.mobility.push(row);
    return row;
  }
  async deleteMobilityCheckIn(ownerId: string, id: number) {
    this.mobility = this.mobility.filter((m) => !(m.id === id && m.ownerId === ownerId));
  }

  async getCustomFlows(ownerId: string) {
    return this.flows.filter((f) => f.ownerId === ownerId).sort((a, b) => b.id - a.id);
  }
  async getCustomFlow(ownerId: string, id: number) {
    return this.flows.find((f) => f.id === id && f.ownerId === ownerId);
  }
  async createCustomFlow(ownerId: string, data: InsertCustomFlow) {
    const row: CustomFlow = { id: this.nextId(), ownerId, ...data } as CustomFlow;
    this.flows.push(row);
    return row;
  }
  async updateCustomFlow(ownerId: string, id: number, data: Partial<InsertCustomFlow>) {
    const row = await this.getCustomFlow(ownerId, id);
    if (!row) return undefined;
    Object.assign(row, data);
    return row;
  }
  async deleteCustomFlow(ownerId: string, id: number) {
    this.flows = this.flows.filter((f) => !(f.id === id && f.ownerId === ownerId));
  }
}

export let pool: Pool | null = null;
export let storage: IStorage;
export let usingMemoryStore = false;

export function initStorage(): { usingMemory: boolean } {
  const url = process.env.DATABASE_URL;
  if (!url) {
    storage = new MemoryStorage();
    usingMemoryStore = true;
    return { usingMemory: true };
  }
  pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  storage = new DatabaseStorage(drizzle(pool));
  usingMemoryStore = false;
  return { usingMemory: false };
}
