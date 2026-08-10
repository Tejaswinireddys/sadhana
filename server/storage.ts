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
  users,
  authSessions,
  passwordResetTokens,
  emailVerificationTokens,
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
  User,
  AuthSession,
  PasswordResetToken,
  EmailVerificationToken,
} from "@shared/schema";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  createUser(email: string, passwordHash: string, displayName?: string): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  updateUserPassword(userId: number, passwordHash: string): Promise<void>;
  markEmailVerified(userId: number): Promise<void>;
  deleteUser(userId: number): Promise<void>;
  createAuthSession(userId: number, token: string, expiresAt: string): Promise<AuthSession>;
  getAuthSession(token: string): Promise<AuthSession | undefined>;
  deleteAuthSession(token: string): Promise<void>;
  deleteAuthSessionsForUser(userId: number): Promise<void>;
  createPasswordResetToken(
    userId: number,
    tokenHash: string,
    expiresAt: string,
  ): Promise<PasswordResetToken>;
  getPasswordResetToken(tokenHash: string): Promise<PasswordResetToken | undefined>;
  deletePasswordResetToken(tokenHash: string): Promise<void>;
  deletePasswordResetTokensForUser(userId: number): Promise<void>;
  createEmailVerificationToken(
    userId: number,
    tokenHash: string,
    expiresAt: string,
  ): Promise<EmailVerificationToken>;
  getEmailVerificationToken(tokenHash: string): Promise<EmailVerificationToken | undefined>;
  deleteEmailVerificationToken(tokenHash: string): Promise<void>;
  deleteEmailVerificationTokensForUser(userId: number): Promise<void>;
  /** Row counts per table for an owner — powers the "merge this device" prompt. */
  countOwnerData(ownerId: string): Promise<number>;
  /** Re-key every row from one owner to another (guest practice → account). */
  transferOwnerData(fromOwnerId: string, toOwnerId: string): Promise<number>;
  getSessions(ownerId: string): Promise<Session[]>;
  createSession(ownerId: string, data: InsertSession): Promise<Session>;
  deleteSession(ownerId: string, id: number): Promise<boolean>;
  clearOwnerData(ownerId: string): Promise<void>;
  /** Run a series of writes; MemoryStorage is sequential, Postgres uses a client transaction when possible. */
  runInTransaction<T>(fn: () => Promise<T>): Promise<T>;
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

/** Every table that is scoped by ownerId, in one place so account merges can't miss one. */
const OWNED_TABLES = [
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
] as const;

export class DatabaseStorage implements IStorage {
  /** Active drizzle transaction, if any — used by runInTransaction. */
  private tx: ReturnType<typeof drizzle> | null = null;
  constructor(private readonly db: ReturnType<typeof drizzle>) {}
  private get orm() {
    return (this.tx ?? this.db) as typeof this.db;
  }

  async createUser(email: string, passwordHash: string, displayName?: string): Promise<User> {
    const [row] = await this.orm
      .insert(users)
      .values({
        email,
        passwordHash,
        displayName,
        emailVerified: false,
        createdAt: new Date().toISOString(),
      })
      .returning();
    return row;
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [row] = await this.orm.select().from(users).where(eq(users.email, email)).limit(1);
    return row;
  }
  async getUserById(id: number): Promise<User | undefined> {
    const [row] = await this.orm.select().from(users).where(eq(users.id, id)).limit(1);
    return row;
  }
  async createAuthSession(userId: number, token: string, expiresAt: string): Promise<AuthSession> {
    const [row] = await this.orm
      .insert(authSessions)
      .values({ userId, token, expiresAt, createdAt: new Date().toISOString() })
      .returning();
    return row;
  }
  async getAuthSession(token: string): Promise<AuthSession | undefined> {
    const [row] = await this.orm
      .select()
      .from(authSessions)
      .where(eq(authSessions.token, token))
      .limit(1);
    return row;
  }
  async deleteAuthSession(token: string): Promise<void> {
    await this.orm.delete(authSessions).where(eq(authSessions.token, token));
  }
  async deleteAuthSessionsForUser(userId: number): Promise<void> {
    await this.orm.delete(authSessions).where(eq(authSessions.userId, userId));
  }
  async updateUserPassword(userId: number, passwordHash: string): Promise<void> {
    await this.orm.update(users).set({ passwordHash }).where(eq(users.id, userId));
  }
  async markEmailVerified(userId: number): Promise<void> {
    await this.orm.update(users).set({ emailVerified: true }).where(eq(users.id, userId));
  }
  async deleteUser(userId: number): Promise<void> {
    await this.deleteAuthSessionsForUser(userId);
    await this.deletePasswordResetTokensForUser(userId);
    await this.deleteEmailVerificationTokensForUser(userId);
    await this.clearOwnerData(`user:${userId}`);
    await this.orm.delete(users).where(eq(users.id, userId));
  }
  async createPasswordResetToken(
    userId: number,
    tokenHash: string,
    expiresAt: string,
  ): Promise<PasswordResetToken> {
    await this.deletePasswordResetTokensForUser(userId);
    const [row] = await this.orm
      .insert(passwordResetTokens)
      .values({ userId, tokenHash, expiresAt, createdAt: new Date().toISOString() })
      .returning();
    return row;
  }
  async getPasswordResetToken(tokenHash: string): Promise<PasswordResetToken | undefined> {
    const [row] = await this.orm
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);
    return row;
  }
  async deletePasswordResetToken(tokenHash: string): Promise<void> {
    await this.orm
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash));
  }
  async deletePasswordResetTokensForUser(userId: number): Promise<void> {
    await this.orm
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));
  }
  async createEmailVerificationToken(
    userId: number,
    tokenHash: string,
    expiresAt: string,
  ): Promise<EmailVerificationToken> {
    await this.deleteEmailVerificationTokensForUser(userId);
    const [row] = await this.orm
      .insert(emailVerificationTokens)
      .values({ userId, tokenHash, expiresAt, createdAt: new Date().toISOString() })
      .returning();
    return row;
  }
  async getEmailVerificationToken(tokenHash: string): Promise<EmailVerificationToken | undefined> {
    const [row] = await this.orm
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, tokenHash))
      .limit(1);
    return row;
  }
  async deleteEmailVerificationToken(tokenHash: string): Promise<void> {
    await this.orm
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, tokenHash));
  }
  async deleteEmailVerificationTokensForUser(userId: number): Promise<void> {
    await this.orm
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, userId));
  }
  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      this.tx = tx as unknown as ReturnType<typeof drizzle>;
      try {
        return await fn();
      } finally {
        this.tx = null;
      }
    });
  }
  async countOwnerData(ownerId: string): Promise<number> {
    const counts = await Promise.all(
      OWNED_TABLES.map(async (table) => {
        const rows = await this.orm.select().from(table).where(eq(table.ownerId, ownerId));
        return rows.length;
      }),
    );
    return counts.reduce((sum, n) => sum + n, 0);
  }
  async transferOwnerData(fromOwnerId: string, toOwnerId: string): Promise<number> {
    if (fromOwnerId === toOwnerId) return 0;
    let moved = 0;
    for (const table of OWNED_TABLES) {
      // Preferences and the active profile are single-row-per-owner, so drop the
      // account's existing row first rather than ending up with two.
      if (table === preferences || table === userProfiles || table === poseNotes) {
        const incoming = await this.orm.select().from(table).where(eq(table.ownerId, fromOwnerId));
        if (incoming.length === 0) continue;
        await this.orm.delete(table).where(eq(table.ownerId, toOwnerId));
      }
      const rows = await this.orm
        .update(table)
        .set({ ownerId: toOwnerId })
        .where(eq(table.ownerId, fromOwnerId))
        .returning();
      moved += rows.length;
    }
    return moved;
  }

  async getSessions(ownerId: string): Promise<Session[]> {
    return this.orm
      .select()
      .from(sessions)
      .where(eq(sessions.ownerId, ownerId))
      .orderBy(desc(sessions.date));
  }
  async createSession(ownerId: string, data: InsertSession): Promise<Session> {
    const [row] = await this.orm
      .insert(sessions)
      .values({ ...data, ownerId })
      .returning();
    return row;
  }
  async deleteSession(ownerId: string, id: number): Promise<boolean> {
    const rows = await this.orm
      .delete(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.ownerId, ownerId)))
      .returning();
    return rows.length > 0;
  }
  async clearOwnerData(ownerId: string): Promise<void> {
    await Promise.all([
      this.orm.delete(sessions).where(eq(sessions.ownerId, ownerId)),
      this.orm.delete(pathwayEnrollments).where(eq(pathwayEnrollments.ownerId, ownerId)),
      this.orm.delete(favoriteAffirmations).where(eq(favoriteAffirmations.ownerId, ownerId)),
      this.orm.delete(journalEntries).where(eq(journalEntries.ownerId, ownerId)),
      this.orm.delete(preferences).where(eq(preferences.ownerId, ownerId)),
      this.orm.delete(userProfiles).where(eq(userProfiles.ownerId, ownerId)),
      this.orm.delete(kidsStickers).where(eq(kidsStickers.ownerId, ownerId)),
      this.orm.delete(favoriteAsanas).where(eq(favoriteAsanas.ownerId, ownerId)),
      this.orm.delete(milestones).where(eq(milestones.ownerId, ownerId)),
      this.orm.delete(poseNotes).where(eq(poseNotes.ownerId, ownerId)),
      this.orm.delete(mobilityCheckIns).where(eq(mobilityCheckIns.ownerId, ownerId)),
      this.orm.delete(customFlows).where(eq(customFlows.ownerId, ownerId)),
    ]);
  }

  async getEnrollments(ownerId: string): Promise<Enrollment[]> {
    return this.orm
      .select()
      .from(pathwayEnrollments)
      .where(eq(pathwayEnrollments.ownerId, ownerId));
  }
  async createEnrollment(ownerId: string, data: InsertEnrollment): Promise<Enrollment> {
    const [row] = await this.orm
      .insert(pathwayEnrollments)
      .values({ ...data, ownerId })
      .returning();
    return row;
  }
  async deleteEnrollment(ownerId: string, id: number): Promise<void> {
    await this.orm
      .delete(pathwayEnrollments)
      .where(and(eq(pathwayEnrollments.id, id), eq(pathwayEnrollments.ownerId, ownerId)));
  }

  async getFavorites(ownerId: string): Promise<Favorite[]> {
    return this.orm
      .select()
      .from(favoriteAffirmations)
      .where(eq(favoriteAffirmations.ownerId, ownerId))
      .orderBy(desc(favoriteAffirmations.createdAt));
  }
  async createFavorite(ownerId: string, data: InsertFavorite): Promise<Favorite> {
    const [row] = await this.orm
      .insert(favoriteAffirmations)
      .values({ ...data, ownerId })
      .returning();
    return row;
  }
  async deleteFavorite(ownerId: string, id: number): Promise<void> {
    await this.orm
      .delete(favoriteAffirmations)
      .where(and(eq(favoriteAffirmations.id, id), eq(favoriteAffirmations.ownerId, ownerId)));
  }

  async getJournal(ownerId: string): Promise<Journal[]> {
    return this.orm
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.ownerId, ownerId))
      .orderBy(desc(journalEntries.date));
  }
  async createJournal(ownerId: string, data: InsertJournal): Promise<Journal> {
    const [row] = await this.orm
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
    const [row] = await this.orm
      .update(journalEntries)
      .set(data)
      .where(and(eq(journalEntries.id, id), eq(journalEntries.ownerId, ownerId)))
      .returning();
    return row;
  }
  async deleteJournal(ownerId: string, id: number): Promise<void> {
    await this.orm
      .delete(journalEntries)
      .where(and(eq(journalEntries.id, id), eq(journalEntries.ownerId, ownerId)));
  }

  async getPreferences(ownerId: string): Promise<Preferences> {
    const [existing] = await this.orm
      .select()
      .from(preferences)
      .where(eq(preferences.ownerId, ownerId))
      .limit(1);
    if (existing) return existing;
    const [created] = await this.orm
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
    const [row] = await this.orm
      .update(preferences)
      .set(data)
      .where(and(eq(preferences.id, current.id), eq(preferences.ownerId, ownerId)))
      .returning();
    return row;
  }

  async getActiveProfile(ownerId: string): Promise<UserProfile | undefined> {
    const [row] = await this.orm
      .select()
      .from(userProfiles)
      .where(and(eq(userProfiles.ownerId, ownerId), eq(userProfiles.active, true)))
      .orderBy(desc(userProfiles.id))
      .limit(1);
    return row;
  }
  async activateProfile(ownerId: string, profileId: string): Promise<UserProfile> {
    await this.orm
      .update(userProfiles)
      .set({ active: false })
      .where(and(eq(userProfiles.ownerId, ownerId), eq(userProfiles.active, true)));
    const [row] = await this.orm
      .insert(userProfiles)
      .values({ ownerId, profileId, activatedAt: new Date().toISOString(), active: true })
      .returning();
    return row;
  }
  async deactivateProfile(ownerId: string): Promise<void> {
    await this.orm
      .update(userProfiles)
      .set({ active: false })
      .where(and(eq(userProfiles.ownerId, ownerId), eq(userProfiles.active, true)));
  }

  async getStickers(ownerId: string): Promise<Sticker[]> {
    return this.orm
      .select()
      .from(kidsStickers)
      .where(eq(kidsStickers.ownerId, ownerId))
      .orderBy(desc(kidsStickers.earnedAt));
  }
  async createSticker(ownerId: string, data: InsertSticker): Promise<Sticker> {
    const [row] = await this.orm
      .insert(kidsStickers)
      .values({ ...data, ownerId })
      .returning();
    return row;
  }

  async getFavoriteAsanas(ownerId: string): Promise<FavoriteAsana[]> {
    return this.orm
      .select()
      .from(favoriteAsanas)
      .where(eq(favoriteAsanas.ownerId, ownerId))
      .orderBy(desc(favoriteAsanas.createdAt));
  }
  async addFavoriteAsana(ownerId: string, slug: string): Promise<FavoriteAsana> {
    const [existing] = await this.orm
      .select()
      .from(favoriteAsanas)
      .where(and(eq(favoriteAsanas.ownerId, ownerId), eq(favoriteAsanas.slug, slug)))
      .limit(1);
    if (existing) return existing;
    const [row] = await this.orm
      .insert(favoriteAsanas)
      .values({ ownerId, slug, createdAt: new Date().toISOString() })
      .returning();
    return row;
  }
  async removeFavoriteAsana(ownerId: string, slug: string): Promise<void> {
    await this.orm
      .delete(favoriteAsanas)
      .where(and(eq(favoriteAsanas.ownerId, ownerId), eq(favoriteAsanas.slug, slug)));
  }

  async getMilestones(ownerId: string): Promise<Milestone[]> {
    return this.orm
      .select()
      .from(milestones)
      .where(eq(milestones.ownerId, ownerId))
      .orderBy(desc(milestones.reachedAt));
  }
  async createMilestone(ownerId: string, data: InsertMilestone): Promise<Milestone> {
    const [existing] = await this.orm
      .select()
      .from(milestones)
      .where(and(eq(milestones.ownerId, ownerId), eq(milestones.kind, data.kind)))
      .limit(1);
    if (existing) return existing;
    const [row] = await this.orm
      .insert(milestones)
      .values({ ...data, ownerId })
      .returning();
    return row;
  }

  async getPoseNote(ownerId: string, slug: string): Promise<PoseNote | undefined> {
    const [row] = await this.orm
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
      const [row] = await this.orm
        .update(poseNotes)
        .set({ body, updatedAt: now })
        .where(and(eq(poseNotes.ownerId, ownerId), eq(poseNotes.slug, slug)))
        .returning();
      return row;
    }
    const [row] = await this.orm
      .insert(poseNotes)
      .values({ ownerId, slug, body, updatedAt: now })
      .returning();
    return row;
  }

  async getMobilityCheckIns(ownerId: string, pathwaySlug: string): Promise<MobilityCheckIn[]> {
    return this.orm
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
    const [row] = await this.orm
      .insert(mobilityCheckIns)
      .values({ ...data, ownerId })
      .returning();
    return row;
  }
  async deleteMobilityCheckIn(ownerId: string, id: number): Promise<void> {
    await this.orm
      .delete(mobilityCheckIns)
      .where(and(eq(mobilityCheckIns.id, id), eq(mobilityCheckIns.ownerId, ownerId)));
  }

  async getCustomFlows(ownerId: string): Promise<CustomFlow[]> {
    return this.orm
      .select()
      .from(customFlows)
      .where(eq(customFlows.ownerId, ownerId))
      .orderBy(desc(customFlows.id));
  }
  async getCustomFlow(ownerId: string, id: number): Promise<CustomFlow | undefined> {
    const [row] = await this.orm
      .select()
      .from(customFlows)
      .where(and(eq(customFlows.id, id), eq(customFlows.ownerId, ownerId)))
      .limit(1);
    return row;
  }
  async createCustomFlow(ownerId: string, data: InsertCustomFlow): Promise<CustomFlow> {
    const [row] = await this.orm
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
    await this.orm
      .update(customFlows)
      .set(data)
      .where(and(eq(customFlows.id, id), eq(customFlows.ownerId, ownerId)));
    return this.getCustomFlow(ownerId, id);
  }
  async deleteCustomFlow(ownerId: string, id: number): Promise<void> {
    await this.orm
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
  private users: User[] = [];
  private authSessions: AuthSession[] = [];
  private resetTokens: PasswordResetToken[] = [];
  private verifyTokens: EmailVerificationToken[] = [];

  private nextId() {
    return this.seq++;
  }

  /** Every owner-scoped array, so merges and counts stay exhaustive. */
  private ownedRows(): { ownerId: string }[][] {
    return [
      this.sessions,
      this.enrollments,
      this.favorites,
      this.journal,
      this.profiles,
      this.stickers,
      this.favAsanas,
      this.milestones,
      this.notes,
      this.mobility,
      this.flows,
    ];
  }

  async createUser(email: string, passwordHash: string, displayName?: string) {
    const row: User = {
      id: this.nextId(),
      email,
      passwordHash,
      displayName: displayName ?? null,
      emailVerified: false,
      createdAt: new Date().toISOString(),
    };
    this.users.push(row);
    return row;
  }
  async getUserByEmail(email: string) {
    return this.users.find((u) => u.email === email);
  }
  async getUserById(id: number) {
    return this.users.find((u) => u.id === id);
  }
  async createAuthSession(userId: number, token: string, expiresAt: string) {
    const row: AuthSession = {
      id: this.nextId(),
      userId,
      token,
      expiresAt,
      createdAt: new Date().toISOString(),
    };
    this.authSessions.push(row);
    return row;
  }
  async getAuthSession(token: string) {
    return this.authSessions.find((s) => s.token === token);
  }
  async deleteAuthSession(token: string) {
    this.authSessions = this.authSessions.filter((s) => s.token !== token);
  }
  async deleteAuthSessionsForUser(userId: number) {
    this.authSessions = this.authSessions.filter((s) => s.userId !== userId);
  }
  async updateUserPassword(userId: number, passwordHash: string) {
    const user = this.users.find((u) => u.id === userId);
    if (user) user.passwordHash = passwordHash;
  }
  async markEmailVerified(userId: number) {
    const user = this.users.find((u) => u.id === userId);
    if (user) user.emailVerified = true;
  }
  async deleteUser(userId: number) {
    await this.deleteAuthSessionsForUser(userId);
    await this.deletePasswordResetTokensForUser(userId);
    await this.deleteEmailVerificationTokensForUser(userId);
    await this.clearOwnerData(`user:${userId}`);
    this.users = this.users.filter((u) => u.id !== userId);
  }
  async createPasswordResetToken(userId: number, tokenHash: string, expiresAt: string) {
    await this.deletePasswordResetTokensForUser(userId);
    const row: PasswordResetToken = {
      id: this.nextId(),
      userId,
      tokenHash,
      expiresAt,
      createdAt: new Date().toISOString(),
    };
    this.resetTokens.push(row);
    return row;
  }
  async getPasswordResetToken(tokenHash: string) {
    return this.resetTokens.find((t) => t.tokenHash === tokenHash);
  }
  async deletePasswordResetToken(tokenHash: string) {
    this.resetTokens = this.resetTokens.filter((t) => t.tokenHash !== tokenHash);
  }
  async deletePasswordResetTokensForUser(userId: number) {
    this.resetTokens = this.resetTokens.filter((t) => t.userId !== userId);
  }
  async createEmailVerificationToken(userId: number, tokenHash: string, expiresAt: string) {
    await this.deleteEmailVerificationTokensForUser(userId);
    const row: EmailVerificationToken = {
      id: this.nextId(),
      userId,
      tokenHash,
      expiresAt,
      createdAt: new Date().toISOString(),
    };
    this.verifyTokens.push(row);
    return row;
  }
  async getEmailVerificationToken(tokenHash: string) {
    return this.verifyTokens.find((t) => t.tokenHash === tokenHash);
  }
  async deleteEmailVerificationToken(tokenHash: string) {
    this.verifyTokens = this.verifyTokens.filter((t) => t.tokenHash !== tokenHash);
  }
  async deleteEmailVerificationTokensForUser(userId: number) {
    this.verifyTokens = this.verifyTokens.filter((t) => t.userId !== userId);
  }
  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
  async countOwnerData(ownerId: string) {
    const rows = this.ownedRows().reduce(
      (sum, list) => sum + list.filter((r) => r.ownerId === ownerId).length,
      0,
    );
    return rows + (this.prefs.has(ownerId) ? 1 : 0);
  }
  async transferOwnerData(fromOwnerId: string, toOwnerId: string) {
    if (fromOwnerId === toOwnerId) return 0;
    let moved = 0;

    // Notes are unique per (owner, slug) and only one profile may be active, so
    // the incoming rows replace the account's on collision.
    const incomingSlugs = new Set(
      this.notes.filter((n) => n.ownerId === fromOwnerId).map((n) => n.slug),
    );
    this.notes = this.notes.filter(
      (n) => !(n.ownerId === toOwnerId && incomingSlugs.has(n.slug)),
    );
    if (this.profiles.some((p) => p.ownerId === fromOwnerId)) {
      this.profiles = this.profiles.filter((p) => p.ownerId !== toOwnerId);
    }

    for (const list of this.ownedRows()) {
      for (const row of list) {
        if (row.ownerId !== fromOwnerId) continue;
        row.ownerId = toOwnerId;
        moved++;
      }
    }

    const prefs = this.prefs.get(fromOwnerId);
    if (prefs) {
      this.prefs.delete(fromOwnerId);
      this.prefs.set(toOwnerId, { ...prefs, ownerId: toOwnerId });
      moved++;
    }
    return moved;
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
