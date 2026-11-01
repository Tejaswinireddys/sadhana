import { AsyncLocalStorage } from "node:async_hooks";
import type { BillingEntitlement, PendingConsent, PurchaseRecord, ConsentAuditEntry, AccountCancellation, PaywallSnapshot } from "../shared/billing";
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
  entitlements,
  stripeEvents,
  billingPendingConsent,
  billingPurchases,
  billingConsentAudit,
  billingPaywallSnapshots,
  classes,
  classProgress,
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
  ClassRow,
  InsertClass,
  ClassProgressRow,
  MobilityCheckIn,
  InsertMobilityCheckIn,
  CustomFlow,
  InsertCustomFlow,
  User,
  AuthSession,
  PasswordResetToken,
  EmailVerificationToken,
  Entitlement,
  StripeEventRecord,
} from "@shared/schema";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, or, asc, desc, sql } from "drizzle-orm";

/** Fields a caller supplies when writing an entitlement (owner/id/updatedAt are managed). */
export type EntitlementInput = {
  plan: string;
  status: string;
  renewsAt?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  billingDetails?: BillingEntitlement | null;
};

export interface IStorage {
  createUser(email: string, passwordHash: string, displayName?: string): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number, lock?: boolean): Promise<User | undefined>;
  setUserPlan(userId: number, plan: "free" | "plus"): Promise<void>;
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
  /**
   * Amend a session already written — a mood or effort rating added on the
   * completion screen after the save. Returns undefined when the row is not
   * this owner's, so a late reflection can never touch someone else's row.
   */
  updateSession(
    ownerId: string,
    id: number,
    data: Partial<InsertSession>,
  ): Promise<Session | undefined>;
  deleteSession(ownerId: string, id: number): Promise<boolean>;
  /** Full owner cleanup; practice-history resets explicitly retain billing identity. */
  clearOwnerData(ownerId: string, options?: { preserveBilling?: boolean }): Promise<void>;
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
  /** Billing entitlement for an owner (one row per owner), or undefined. */
  getEntitlement(ownerId: string): Promise<Entitlement | undefined>;
  /** Insert or update the owner's single entitlement row. */
  upsertEntitlement(ownerId: string, data: EntitlementInput): Promise<Entitlement>;
  /** All entitlement rows (renewal reminders / ops). */
  listEntitlements(): Promise<Entitlement[]>;
  saveBillingPendingConsent(ownerId: string, record: PendingConsent, ifAbsent?: boolean): Promise<boolean>;
  getBillingPendingConsent(ownerId: string): Promise<PendingConsent | undefined>;
  takeBillingPendingConsent(ownerId: string): Promise<PendingConsent | undefined>;
  saveBillingPurchase(record: PurchaseRecord, ifAbsent?: boolean): Promise<boolean>;
  getBillingPurchase(id: string): Promise<PurchaseRecord | undefined>;
  listBillingPurchases(ownerId: string): Promise<PurchaseRecord[]>;
  updateBillingPurchase(id: string, patch: Partial<PurchaseRecord>): Promise<void>;
  appendBillingConsentAudit(record: ConsentAuditEntry): Promise<boolean>;
  listBillingConsentAudit(ownerId?: string): Promise<ConsentAuditEntry[]>;
  appendBillingAccountCancellation(id: string, record: AccountCancellation): Promise<boolean>;
  listBillingAccountCancellations(): Promise<AccountCancellation[]>;
  saveBillingPaywallSnapshot(record: PaywallSnapshot): Promise<boolean>;
  getBillingPaywallSnapshot(id: string): Promise<string | null>;
  deleteOwnerBillingData(ownerId: string): Promise<void>;
  findStripeEntitlement(customerId?: string, subscriptionId?: string): Promise<Entitlement | undefined>;
  updateStripeEntitlement(ownerId: string, data: Omit<EntitlementInput, "plan">): Promise<void>;
  claimStripeEvent(id: string, type: string): Promise<boolean>;
  getStripeEvent(id: string): Promise<StripeEventRecord | undefined>;
  /** True when the backing store is reachable (DB SELECT 1 / in-memory always). */
  ping(): Promise<boolean>;
  getStickers(ownerId: string): Promise<Sticker[]>;
  createSticker(ownerId: string, data: InsertSticker): Promise<Sticker>;
  getFavoriteAsanas(ownerId: string): Promise<FavoriteAsana[]>;
  addFavoriteAsana(ownerId: string, slug: string): Promise<FavoriteAsana>;
  removeFavoriteAsana(ownerId: string, slug: string): Promise<void>;
  getMilestones(ownerId: string): Promise<Milestone[]>;
  createMilestone(ownerId: string, data: InsertMilestone): Promise<Milestone>;
  getPoseNote(ownerId: string, slug: string): Promise<PoseNote | undefined>;
  upsertPoseNote(ownerId: string, slug: string, body: string): Promise<PoseNote>;
  /** Every class row, published or not; routes decide what to show. */
  listClasses(): Promise<ClassRow[]>;
  getClassBySlug(slug: string): Promise<ClassRow | undefined>;
  /** Insert or update by slug (seeding/admin); keeps id and created_at. */
  upsertClassBySlug(data: InsertClass): Promise<ClassRow>;
  getClassProgress(ownerId: string): Promise<ClassProgressRow[]>;
  /**
   * Atomic upsert of one owner's position in one class. `completed` is sticky:
   * a later save without it never un-finishes a class.
   */
  saveClassProgress(ownerId: string, classId: number, data: { secondsWatched: number; completed: boolean }): Promise<ClassProgressRow>;
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
  classProgress,
] as const;

export class DatabaseStorage implements IStorage {
  /** Async-local transactions cannot capture another request's database writes. */
  private transactions = new AsyncLocalStorage<ReturnType<typeof drizzle>>();
  constructor(private readonly db: ReturnType<typeof drizzle>) {}
  private get orm() {
    return (this.transactions.getStore() ?? this.db) as typeof this.db;
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
  async setUserPlan(userId: number, plan: "free" | "plus"): Promise<void> {
    if (plan !== "free" && plan !== "plus") throw new Error("Invalid plan");
    await this.orm.update(users).set({ plan }).where(eq(users.id, userId));
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [row] = await this.orm.select().from(users).where(eq(users.email, email)).limit(1);
    return row;
  }
  async getUserById(id: number, lock = false): Promise<User | undefined> {
    const query = this.orm.select().from(users).where(eq(users.id, id)).limit(1);
    const [row] = await (lock ? query.for("update") : query);
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
    if (this.transactions.getStore()) return fn();
    return this.db.transaction((tx) => this.transactions.run(tx as unknown as ReturnType<typeof drizzle>, fn));
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
    // Claiming guest practice never transfers or overwrites account billing identity.
    await this.deleteOwnerBillingData(fromOwnerId);
    let moved = 0;
    moved += await this.mergeClassProgress(fromOwnerId, toOwnerId);
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
  async updateSession(
    ownerId: string,
    id: number,
    data: Partial<InsertSession>,
  ): Promise<Session | undefined> {
    const [row] = await this.orm
      .update(sessions)
      .set(data)
      .where(and(eq(sessions.id, id), eq(sessions.ownerId, ownerId)))
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
  async clearOwnerData(ownerId: string, options: { preserveBilling?: boolean } = {}): Promise<void> {
    if (!options.preserveBilling) {
      await this.deleteOwnerBillingData(ownerId);
    }
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
      this.orm.delete(classProgress).where(eq(classProgress.ownerId, ownerId)),
    ]);
  }

  /**
   * A class watched both as a guest and on the account keeps one row: the
   * most recent position, finished if either was. The guest row is removed
   * here so the generic owner move cannot hit the (owner, class) unique index.
   */
  private async mergeClassProgress(fromOwnerId: string, toOwnerId: string): Promise<number> {
    const incoming = await this.orm.select().from(classProgress).where(eq(classProgress.ownerId, fromOwnerId));
    let merged = 0;
    for (const row of incoming) {
      const [existing] = await this.orm.select().from(classProgress)
        .where(and(eq(classProgress.ownerId, toOwnerId), eq(classProgress.classId, row.classId)));
      if (!existing) continue;
      const newer = row.updatedAt > existing.updatedAt ? row : existing;
      await this.orm.update(classProgress).set({
        secondsWatched: newer.secondsWatched, updatedAt: newer.updatedAt, completed: existing.completed || row.completed,
      }).where(eq(classProgress.id, existing.id));
      await this.orm.delete(classProgress).where(eq(classProgress.id, row.id));
      merged++;
    }
    return merged;
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
    return { id: 0, ownerId, motionEnabled: 1, voiceEnabled: 1, allowRobotVoice: 0 };
  }
  async updatePreferences(ownerId: string, data: Partial<InsertPreferences>): Promise<Preferences> {
    const current = await this.getPreferences(ownerId);
    if (!current.id) {
      const [created] = await this.orm.insert(preferences)
        .values({ ownerId, motionEnabled: 1, voiceEnabled: 1, allowRobotVoice: 0, ...data })
        .returning();
      return created;
    }
    const [row] = await this.orm.update(preferences).set(data)
      .where(and(eq(preferences.id, current.id), eq(preferences.ownerId, ownerId))).returning();
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

  async getEntitlement(ownerId: string): Promise<Entitlement | undefined> {
    const [row] = await this.orm
      .select()
      .from(entitlements)
      .where(eq(entitlements.ownerId, ownerId))
      .limit(1);
    return row;
  }
  async upsertEntitlement(ownerId: string, data: EntitlementInput): Promise<Entitlement> {
    const values = {
      ...(data.billingDetails !== undefined ? { billingDetails: data.billingDetails } : {}),
      plan: data.plan,
      status: data.status,
      renewsAt: data.renewsAt ?? null,
      stripeCustomerId: data.stripeCustomerId ?? null,
      stripeSubscriptionId: data.stripeSubscriptionId ?? null,
      updatedAt: new Date().toISOString(),
    };
    const existing = await this.getEntitlement(ownerId);
    if (existing) {
      const [row] = await this.orm
        .update(entitlements)
        .set(values)
        .where(eq(entitlements.ownerId, ownerId))
        .returning();
      return row;
    }
    const [row] = await this.orm
      .insert(entitlements)
      .values({ ownerId, ...values })
      .returning();
    return row;
  }
  async listEntitlements(): Promise<Entitlement[]> {
    return this.orm.select().from(entitlements);
  }
  async saveBillingPendingConsent(ownerId: string, record: PendingConsent, ifAbsent = false) {
    const query = this.orm.insert(billingPendingConsent).values({ ownerId, record });
    const rows = await (ifAbsent ? query.onConflictDoNothing() : query.onConflictDoUpdate({ target: billingPendingConsent.ownerId, set: { record } })).returning();
    return rows.length > 0;
  }
  async getBillingPendingConsent(ownerId: string) {
    const [row] = await this.orm.select().from(billingPendingConsent).where(eq(billingPendingConsent.ownerId, ownerId));
    return row?.record;
  }
  async takeBillingPendingConsent(ownerId: string) {
    // One SQL statement makes consumption exclusive across processes/webhook retries.
    const [row] = await this.orm.delete(billingPendingConsent).where(eq(billingPendingConsent.ownerId, ownerId)).returning();
    return row?.record;
  }
  async saveBillingPurchase(record: PurchaseRecord, ifAbsent = false) {
    const values = { id: record.id, ownerId: record.ownerId, chargedAt: record.chargedAt, record };
    const query = this.orm.insert(billingPurchases).values(values);
    const rows = await (ifAbsent ? query.onConflictDoNothing() : query.onConflictDoUpdate({ target: billingPurchases.id, set: values })).returning();
    return rows.length > 0;
  }
  async getBillingPurchase(id: string) {
    const [row] = await this.orm.select().from(billingPurchases).where(eq(billingPurchases.id, id));
    return row?.record;
  }
  async listBillingPurchases(ownerId: string) {
    const rows = await this.orm.select().from(billingPurchases).where(eq(billingPurchases.ownerId, ownerId)).orderBy(asc(billingPurchases.chargedAt), asc(billingPurchases.sequence));
    return rows.map((row) => row.record);
  }
  async updateBillingPurchase(id: string, patch: Partial<PurchaseRecord>) {
    await this.orm.update(billingPurchases).set({
      record: sql`${billingPurchases.record} || ${JSON.stringify(patch)}::jsonb`,
      ...(patch.ownerId !== undefined ? { ownerId: patch.ownerId } : {}),
      ...(patch.chargedAt !== undefined ? { chargedAt: patch.chargedAt } : {}),
    }).where(eq(billingPurchases.id, id));
  }
  async appendBillingConsentAudit(record: ConsentAuditEntry) {
    const rows = await this.orm.insert(billingConsentAudit).values({ id: record.id, ownerId: record.ownerId, kind: "consent", record }).onConflictDoNothing().returning();
    return rows.length > 0;
  }
  async listBillingConsentAudit(ownerId?: string) {
    const rows = await this.orm.select().from(billingConsentAudit).where(and(eq(billingConsentAudit.kind, "consent"), ownerId ? eq(billingConsentAudit.ownerId, ownerId) : undefined)).orderBy(asc(billingConsentAudit.sequence));
    return rows.map((row) => row.record as ConsentAuditEntry);
  }
  async appendBillingAccountCancellation(id: string, record: AccountCancellation) {
    const rows = await this.orm.insert(billingConsentAudit).values({ id, ownerId: null, kind: "account_cancellation", record }).onConflictDoNothing().returning();
    return rows.length > 0;
  }
  async listBillingAccountCancellations() {
    const rows = await this.orm.select().from(billingConsentAudit).where(eq(billingConsentAudit.kind, "account_cancellation")).orderBy(asc(billingConsentAudit.sequence));
    return rows.map((row) => row.record as AccountCancellation);
  }
  async saveBillingPaywallSnapshot(record: PaywallSnapshot) {
    const rows = await this.orm.insert(billingPaywallSnapshots).values(record).onConflictDoNothing().returning();
    return rows.length > 0;
  }
  async getBillingPaywallSnapshot(id: string) {
    const [row] = await this.orm.select().from(billingPaywallSnapshots).where(eq(billingPaywallSnapshots.id, id));
    return row?.html ?? null;
  }
  async deleteOwnerBillingData(ownerId: string) {
    await this.orm.delete(billingPendingConsent).where(eq(billingPendingConsent.ownerId, ownerId));
    await this.orm.delete(entitlements).where(eq(entitlements.ownerId, ownerId));
  }
  async findStripeEntitlement(customerId?: string, subscriptionId?: string) {
    if (!customerId && !subscriptionId) return undefined;
    const rows = await this.orm.select().from(entitlements).where(or(
      customerId ? eq(entitlements.stripeCustomerId, customerId) : undefined,
      subscriptionId ? eq(entitlements.stripeSubscriptionId, subscriptionId) : undefined,
    )).orderBy(asc(entitlements.id)).for("update");
    if (rows.length > 1) throw new Error("Conflicting Stripe customer/subscription bindings");
    return rows[0];
  }
  async updateStripeEntitlement(ownerId: string, data: Omit<EntitlementInput, "plan">) {
    const rows = await this.orm.update(entitlements).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(entitlements.ownerId, ownerId)).returning();
    if (!rows.length) throw new Error("Stripe customer binding disappeared");
  }
  async claimStripeEvent(id: string, type: string) {
    if (!this.transactions.getStore()) throw new Error("Stripe event claims require a transaction");
    const rows = await this.orm.insert(stripeEvents).values({ id, type, processedAt: new Date().toISOString() }).onConflictDoNothing().returning();
    return rows.length > 0;
  }
  async getStripeEvent(id: string) {
    const [row] = await this.orm.select().from(stripeEvents).where(eq(stripeEvents.id, id));
    return row;
  }
  async ping(): Promise<boolean> {
    try {
      await this.db.execute(sql`select 1`);
      return true;
    } catch {
      return false;
    }
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

  async listClasses(): Promise<ClassRow[]> {
    return this.orm.select().from(classes).orderBy(asc(classes.id));
  }
  async getClassBySlug(slug: string): Promise<ClassRow | undefined> {
    const [row] = await this.orm.select().from(classes).where(eq(classes.slug, slug)).limit(1);
    return row;
  }
  async upsertClassBySlug(data: InsertClass): Promise<ClassRow> {
    // created_at is the first-seen date; re-seeding must not reorder the library.
    const { createdAt: _createdAt, ...rest } = data;
    const [row] = await this.orm.insert(classes).values(data)
      .onConflictDoUpdate({ target: classes.slug, set: rest })
      .returning();
    return row;
  }
  async getClassProgress(ownerId: string): Promise<ClassProgressRow[]> {
    return this.orm.select().from(classProgress).where(eq(classProgress.ownerId, ownerId));
  }
  async saveClassProgress(ownerId: string, classId: number, data: { secondsWatched: number; completed: boolean }): Promise<ClassProgressRow> {
    const updatedAt = new Date().toISOString();
    const [row] = await this.orm.insert(classProgress)
      .values({ ownerId, classId, secondsWatched: data.secondsWatched, completed: data.completed, updatedAt })
      .onConflictDoUpdate({
        target: [classProgress.ownerId, classProgress.classId],
        set: {
          secondsWatched: data.secondsWatched,
          completed: sql`${classProgress.completed} OR ${data.completed}`,
          updatedAt,
        },
      })
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
  private entitlements = new Map<string, Entitlement>();
  private stickers: Sticker[] = [];
  private favAsanas: FavoriteAsana[] = [];
  private milestones: Milestone[] = [];
  private notes: PoseNote[] = [];
  private mobility: MobilityCheckIn[] = [];
  private flows: CustomFlow[] = [];
  private classRows: ClassRow[] = [];
  private classProgressRows: ClassProgressRow[] = [];
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
      this.classProgressRows,
    ];
  }

  async createUser(email: string, passwordHash: string, displayName?: string) {
    const row: User = {
      id: this.nextId(),
      email,
      passwordHash,
      displayName: displayName ?? null,
      emailVerified: false,
      plan: "free",
      createdAt: new Date().toISOString(),
    };
    this.users.push(row);
    return row;
  }
  async setUserPlan(userId: number, plan: "free" | "plus"): Promise<void> {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).setUserPlan(userId, plan));
    if (plan !== "free" && plan !== "plus") throw new Error("Invalid plan");
    const user = this.users.find((row) => row.id === userId);
    if (user) user.plan = plan;
  }
  async getUserByEmail(email: string) {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).getUserByEmail(email));
    return structuredClone(this.users.find((u) => u.email === email));
  }
  async getUserById(id: number) {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).getUserById(id));
    return structuredClone(this.users.find((u) => u.id === id));
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
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).deleteUser(userId));
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
  private transactionContext = new AsyncLocalStorage<boolean>();
  private transactionQueue: Promise<void> = Promise.resolve();
  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.transactionContext.getStore()) return fn();
    const previous = this.transactionQueue;
    let release!: () => void;
    this.transactionQueue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    const financial = structuredClone({ entitlements: this.entitlements, pending: this.billingPending, purchases: this.billingPurchaseRows, audits: this.billingAudits, snapshots: this.billingSnapshots, events: this.processedStripeEvents });
    const plans = new Map(this.users.map((user) => [user.id, user.plan]));
    return this.transactionContext.run(true, async () => {
      try { return await fn(); }
      catch (error) {
        this.entitlements = financial.entitlements;
        this.billingPending = financial.pending;
        this.billingPurchaseRows = financial.purchases;
        this.billingAudits = financial.audits;
        this.billingSnapshots = financial.snapshots;
        this.processedStripeEvents = financial.events;
        for (const user of this.users) if (plans.has(user.id)) user.plan = plans.get(user.id)!;
        throw error;
      } finally { release(); }
    });
  }
  async countOwnerData(ownerId: string) {
    const rows = this.ownedRows().reduce(
      (sum, list) => sum + list.filter((r) => r.ownerId === ownerId).length,
      0,
    );
    return rows + (this.prefs.has(ownerId) ? 1 : 0);
  }
  async transferOwnerData(fromOwnerId: string, toOwnerId: string) {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).transferOwnerData(fromOwnerId, toOwnerId));
    if (fromOwnerId === toOwnerId) return 0;
    // Claiming guest practice never transfers or overwrites account billing identity.
    await this.deleteOwnerBillingData(fromOwnerId);
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
    // One progress row per (owner, class): merge collisions like DatabaseStorage.
    for (const row of this.classProgressRows.filter((r) => r.ownerId === fromOwnerId)) {
      const existing = this.classProgressRows.find((r) => r.ownerId === toOwnerId && r.classId === row.classId);
      if (!existing) continue;
      const newer = row.updatedAt > existing.updatedAt ? row : existing;
      Object.assign(existing, { secondsWatched: newer.secondsWatched, updatedAt: newer.updatedAt, completed: existing.completed || row.completed });
      this.classProgressRows = this.classProgressRows.filter((r) => r !== row);
      moved++;
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
  async updateSession(ownerId: string, id: number, data: Partial<InsertSession>) {
    const row = this.sessions.find((s) => s.id === id && s.ownerId === ownerId);
    if (!row) return undefined;
    Object.assign(row, data);
    return row;
  }
  async deleteSession(ownerId: string, id: number) {
    const before = this.sessions.length;
    this.sessions = this.sessions.filter((s) => !(s.id === id && s.ownerId === ownerId));
    return this.sessions.length < before;
  }
  async clearOwnerData(ownerId: string, options: { preserveBilling?: boolean } = {}) {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).clearOwnerData(ownerId, options));
    if (!options.preserveBilling) {
      await this.deleteOwnerBillingData(ownerId);
    }
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
    this.classProgressRows = this.classProgressRows.filter((r) => r.ownerId !== ownerId);
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
    return this.prefs.get(ownerId) ?? { id: 0, ownerId, motionEnabled: 1, voiceEnabled: 1, allowRobotVoice: 0 };
  }
  async updatePreferences(ownerId: string, data: Partial<InsertPreferences>) {
    const current = await this.getPreferences(ownerId);
    const updated = { ...current, ...data, id: current.id || this.nextId(), ownerId };
    this.prefs.set(ownerId, updated);
    return updated;
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

  async getEntitlement(ownerId: string) {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).getEntitlement(ownerId));
    return this.entitlements.get(ownerId);
  }
  async upsertEntitlement(ownerId: string, data: EntitlementInput) {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).upsertEntitlement(ownerId, data));
    this.assertStripeUniqueness(ownerId, data);
    const existing = this.entitlements.get(ownerId);
    const row: Entitlement = {
      id: existing?.id ?? this.nextId(),
      ownerId,
      billingDetails: structuredClone(data.billingDetails === undefined ? existing?.billingDetails ?? null : data.billingDetails),
      plan: data.plan,
      status: data.status,
      renewsAt: data.renewsAt ?? null,
      stripeCustomerId: data.stripeCustomerId ?? null,
      stripeSubscriptionId: data.stripeSubscriptionId ?? null,
      updatedAt: new Date().toISOString(),
    };
    this.entitlements.set(ownerId, row);
    return row;
  }
  async listEntitlements() {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).listEntitlements());
    return [...this.entitlements.values()];
  }
  private billingPending = new Map<string, PendingConsent>();
  private billingPurchaseRows = new Map<string, PurchaseRecord>();
  private billingAudits = new Map<string, { kind: "consent" | "account_cancellation"; record: ConsentAuditEntry | AccountCancellation }>();
  private billingSnapshots = new Map<string, string>();
  async saveBillingPendingConsent(ownerId: string, record: PendingConsent, ifAbsent = false) {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).saveBillingPendingConsent(ownerId, record, ifAbsent));
    if (ifAbsent && this.billingPending.has(ownerId)) return false;
    this.billingPending.set(ownerId, structuredClone(record));
    return true;
  }
  async getBillingPendingConsent(ownerId: string) {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).getBillingPendingConsent(ownerId)); return structuredClone(this.billingPending.get(ownerId)); }
  async takeBillingPendingConsent(ownerId: string) {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).takeBillingPendingConsent(ownerId));
    const row = this.billingPending.get(ownerId);
    this.billingPending.delete(ownerId);
    return structuredClone(row);
  }
  async saveBillingPurchase(record: PurchaseRecord, ifAbsent = false) {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).saveBillingPurchase(record, ifAbsent));
    if (ifAbsent && this.billingPurchaseRows.has(record.id)) return false;
    this.billingPurchaseRows.set(record.id, structuredClone(record));
    return true;
  }
  async getBillingPurchase(id: string) {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).getBillingPurchase(id)); return structuredClone(this.billingPurchaseRows.get(id)); }
  async listBillingPurchases(ownerId: string) {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).listBillingPurchases(ownerId));
    return structuredClone([...this.billingPurchaseRows.values()].filter((row) => row.ownerId === ownerId).sort((a, b) => a.chargedAt < b.chargedAt ? -1 : a.chargedAt > b.chargedAt ? 1 : 0));
  }
  async updateBillingPurchase(id: string, patch: Partial<PurchaseRecord>) {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).updateBillingPurchase(id, patch));
    const row = this.billingPurchaseRows.get(id);
    if (row) this.billingPurchaseRows.set(id, structuredClone({ ...row, ...patch }));
  }
  async appendBillingConsentAudit(record: ConsentAuditEntry) {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).appendBillingConsentAudit(record));
    if (this.billingAudits.has(record.id)) return false;
    this.billingAudits.set(record.id, { kind: "consent", record: structuredClone(record) });
    return true;
  }
  async listBillingConsentAudit(ownerId?: string) {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).listBillingConsentAudit(ownerId));
    return structuredClone([...this.billingAudits.values()].filter((row) => row.kind === "consent" && (!ownerId || (row.record as ConsentAuditEntry).ownerId === ownerId)).map((row) => row.record as ConsentAuditEntry));
  }
  async appendBillingAccountCancellation(id: string, record: AccountCancellation) {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).appendBillingAccountCancellation(id, record));
    if (this.billingAudits.has(id)) return false;
    this.billingAudits.set(id, { kind: "account_cancellation", record: structuredClone(record) });
    return true;
  }
  async listBillingAccountCancellations() {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).listBillingAccountCancellations());
    return structuredClone([...this.billingAudits.values()].filter((row) => row.kind === "account_cancellation").map((row) => row.record as AccountCancellation));
  }
  async saveBillingPaywallSnapshot(record: PaywallSnapshot) {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).saveBillingPaywallSnapshot(record));
    if (this.billingSnapshots.has(record.id)) return false;
    this.billingSnapshots.set(record.id, record.html);
    return true;
  }
  async getBillingPaywallSnapshot(id: string) {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).getBillingPaywallSnapshot(id)); return this.billingSnapshots.get(id) ?? null; }
  async deleteOwnerBillingData(ownerId: string) {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).deleteOwnerBillingData(ownerId));
    this.billingPending.delete(ownerId);
    this.entitlements.delete(ownerId);
  }
  private processedStripeEvents = new Map<string, StripeEventRecord>();
  private assertStripeUniqueness(ownerId: string, data: { stripeCustomerId?: string | null; stripeSubscriptionId?: string | null }) {
    for (const row of this.entitlements.values()) {
      if (row.ownerId === ownerId) continue;
      if (data.stripeCustomerId != null && row.stripeCustomerId === data.stripeCustomerId) throw new Error("Duplicate Stripe customer ID");
      if (data.stripeSubscriptionId != null && row.stripeSubscriptionId === data.stripeSubscriptionId) throw new Error("Duplicate Stripe subscription ID");
    }
  }
  async findStripeEntitlement(customerId?: string, subscriptionId?: string) {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).findStripeEntitlement(customerId, subscriptionId));
    const rows = [...this.entitlements.values()].filter((row) => (customerId && row.stripeCustomerId === customerId) || (subscriptionId && row.stripeSubscriptionId === subscriptionId));
    if (rows.length > 1) throw new Error("Conflicting Stripe customer/subscription bindings");
    return structuredClone(rows[0]);
  }
  async updateStripeEntitlement(ownerId: string, data: Omit<EntitlementInput, "plan">) {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).updateStripeEntitlement(ownerId, data));
    const row = this.entitlements.get(ownerId);
    if (!row) throw new Error("Stripe customer binding disappeared");
    this.assertStripeUniqueness(ownerId, data);
    this.entitlements.set(ownerId, structuredClone({ ...row, ...data, updatedAt: new Date().toISOString() }));
  }
  async claimStripeEvent(id: string, type: string) {
    if (!this.transactionContext.getStore()) throw new Error("Stripe event claims require a transaction");
    if (this.processedStripeEvents.has(id)) return false;
    this.processedStripeEvents.set(id, { id, type, processedAt: new Date().toISOString() });
    return true;
  }
  async getStripeEvent(id: string) {
    if (!this.transactionContext.getStore()) return this.runInTransaction(() => (this as IStorage).getStripeEvent(id));
    return structuredClone(this.processedStripeEvents.get(id));
  }
  async ping() {
    return true;
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

  async listClasses() {
    return structuredClone([...this.classRows].sort((a, b) => a.id - b.id));
  }
  async getClassBySlug(slug: string) {
    return structuredClone(this.classRows.find((row) => row.slug === slug));
  }
  async upsertClassBySlug(data: InsertClass) {
    const existing = this.classRows.find((row) => row.slug === data.slug);
    const defaults = { description: "", focusTags: [] as string[], muxPlaybackId: null, thumbnailUrl: null, tier: "free" as const, playbackPolicy: "public" as const, published: false };
    if (existing) {
      const { createdAt: _createdAt, ...rest } = data;
      Object.assign(existing, rest);
      return structuredClone(existing);
    }
    const row: ClassRow = { ...defaults, ...data, id: this.nextId() } as ClassRow;
    this.classRows.push(row);
    return structuredClone(row);
  }
  async getClassProgress(ownerId: string) {
    return structuredClone(this.classProgressRows.filter((row) => row.ownerId === ownerId));
  }
  async saveClassProgress(ownerId: string, classId: number, data: { secondsWatched: number; completed: boolean }) {
    if (!this.classRows.some((row) => row.id === classId)) throw new Error("Unknown class");
    const updatedAt = new Date().toISOString();
    const existing = this.classProgressRows.find((row) => row.ownerId === ownerId && row.classId === classId);
    if (existing) {
      Object.assign(existing, { secondsWatched: data.secondsWatched, completed: existing.completed || data.completed, updatedAt });
      return structuredClone(existing);
    }
    const row: ClassProgressRow = { id: this.nextId(), ownerId, classId, ...data, updatedAt };
    this.classProgressRows.push(row);
    return structuredClone(row);
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
