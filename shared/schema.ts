import { pgTable, text, integer, serial, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Optional accounts. Practice data stays keyed by ownerId — an anonymous device
// id for guests, or `user:<id>` once someone signs in — so guest mode keeps
// working exactly as before and signing in simply changes which owner is active.
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name"),
    /** False until the user completes email verification after signup. */
    emailVerified: boolean("email_verified").notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export type User = typeof users.$inferSelect;
/** Never leaves the server with the hash attached. */
export type PublicUser = Pick<User, "id" | "email" | "displayName" | "emailVerified" | "createdAt">;

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: serial("id").primaryKey(),
    token: text("token").notNull(),
    userId: integer("user_id").notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  (t) => [uniqueIndex("auth_sessions_token_idx").on(t.token)],
);

export type AuthSession = typeof authSessions.$inferSelect;

/** Shared signup/reset password rules — letter + number, min 8. */
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(48).optional(),
});
export type Credentials = z.infer<typeof credentialsSchema>;

/**
 * Sign-in accepts any shape a stored password could have had — including ones
 * that predate the current rules. Enforcing signup constraints here turns a
 * failed login into a policy disclosure, and rejects legitimate old passwords.
 */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});
export type LoginCredentials = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  token: z.string().min(16, "Enter the reset code from your email"),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(16, "Enter the verification code from your email"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").optional(),
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm"),
});

/** One-time password reset tokens (hashed at rest). */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("password_reset_tokens_hash_idx").on(t.tokenHash)],
);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

/** One-time email verification tokens (hashed at rest). */
export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("email_verification_tokens_hash_idx").on(t.tokenHash)],
);

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;

// Practice sessions logged after completing a timed practice
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  date: text("date").notNull(), // ISO date string (YYYY-MM-DD or full ISO)
  /**
   * Minutes ACTUALLY practiced (wall-clock elapsed). This is the single
   * definition of a session's duration — stats, the journal and the completion
   * screen all read it. What the user *planned* lives in `plannedMinutes` and
   * is never mixed into totals.
   */
  durationMinutes: integer("duration_minutes").notNull(),
  /** Minutes the session was designed to take. Nullable for legacy rows. */
  plannedMinutes: integer("planned_minutes"),
  /** Poses held to completion, and poses skipped past. Nullable for legacy rows. */
  posesCompleted: integer("poses_completed"),
  posesSkipped: integer("poses_skipped"),
  asanas: text("asanas").notNull().default("[]"), // JSON array of asana slugs/names
  pathwaySlug: text("pathway_slug"),
  notes: text("notes"),
  kind: text("kind").notNull().default("asana"), // 'asana' | 'breathing'
  preMood: text("pre_mood"), // mood chip recorded before practice
  postMood: text("post_mood"), // mood chip recorded after practice
  /** Rate of perceived exertion 1–10. Nullable for legacy rows. */
  rpe: integer("rpe"),
});

export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, ownerId: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

// User preferences (one row per owner)
export const preferences = pgTable("preferences", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  motionEnabled: integer("motion_enabled").notNull().default(1), // 1 = animations on
  voiceEnabled: integer("voice_enabled").notNull().default(1), // 1 = voice narration on
});

export const insertPreferencesSchema = createInsertSchema(preferences).omit({ id: true, ownerId: true });
export type InsertPreferences = z.infer<typeof insertPreferencesSchema>;
export type Preferences = typeof preferences.$inferSelect;

// Pathway enrollments
export const pathwayEnrollments = pgTable("pathway_enrollments", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  pathwaySlug: text("pathway_slug").notNull(),
  startDate: text("start_date").notNull(),
  active: integer("active").notNull().default(1),
});

export const insertEnrollmentSchema = createInsertSchema(pathwayEnrollments).omit({
  id: true,
  ownerId: true,
});
export type InsertEnrollment = z.infer<typeof insertEnrollmentSchema>;
export type Enrollment = typeof pathwayEnrollments.$inferSelect;

// Favorite affirmations
export const favoriteAffirmations = pgTable("favorite_affirmations", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  affirmationText: text("affirmation_text").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertFavoriteSchema = createInsertSchema(favoriteAffirmations).omit({
  id: true,
  ownerId: true,
});
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Favorite = typeof favoriteAffirmations.$inferSelect;

// Journal entries
export const journalEntries = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  date: text("date").notNull(),
  title: text("title"),
  body: text("body").notNull().default(""),
  mood: text("mood"),
  tags: text("tags").notNull().default("[]"), // JSON array
});

export const insertJournalSchema = createInsertSchema(journalEntries).omit({ id: true, ownerId: true });
export type InsertJournal = z.infer<typeof insertJournalSchema>;
export type Journal = typeof journalEntries.$inferSelect;

// Active personalization profile (single active row per owner, history retained)
export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  profileId: text("profile_id").notNull(), // FK to static profile id
  activatedAt: text("activated_at").notNull(),
  active: boolean("active").notNull().default(true),
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  ownerId: true,
});
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;

// Billing entitlements — one row per owner (device/account). Durable in Postgres
// so a Stripe subscription's access survives Render's ephemeral filesystem.
export const entitlements = pgTable(
  "entitlements",
  {
    id: serial("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    plan: text("plan").notNull().default("free"),
    status: text("status").notNull().default("active"),
    renewsAt: text("renews_at"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    ownerUnique: uniqueIndex("entitlements_owner_id_unique").on(t.ownerId),
  }),
);
export type Entitlement = typeof entitlements.$inferSelect;

// Kids stickers earned by completing a kids pose
export const kidsStickers = pgTable("kids_stickers", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  poseSlug: text("pose_slug").notNull(),
  earnedAt: text("earned_at").notNull(),
});

export const insertStickerSchema = createInsertSchema(kidsStickers).omit({ id: true, ownerId: true });
export type InsertSticker = z.infer<typeof insertStickerSchema>;
export type Sticker = typeof kidsStickers.$inferSelect;

// Favorited library poses (v3.4)
export const favoriteAsanas = pgTable("favorite_asanas", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  slug: text("slug").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertFavoriteAsanaSchema = createInsertSchema(favoriteAsanas).omit({
  id: true,
  ownerId: true,
});
export type InsertFavoriteAsana = z.infer<typeof insertFavoriteAsanaSchema>;
export type FavoriteAsana = typeof favoriteAsanas.$inferSelect;

// Celebrated milestones — recorded once so each is celebrated only a single time (v3.4)
export const milestones = pgTable("milestones", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  kind: text("kind").notNull(), // 'streak_7', 'total_50', etc.
  reachedAt: text("reached_at").notNull(),
});

export const insertMilestoneSchema = createInsertSchema(milestones).omit({ id: true, ownerId: true });
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type Milestone = typeof milestones.$inferSelect;

// Personal notes per pose (v3.4) — one row per (owner, slug)
export const poseNotes = pgTable(
  "pose_notes",
  {
    id: serial("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    slug: text("slug").notNull(),
    body: text("body").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("pose_notes_owner_slug_idx").on(t.ownerId, t.slug)],
);

export const insertPoseNoteSchema = createInsertSchema(poseNotes).omit({ id: true, ownerId: true });
export type InsertPoseNote = z.infer<typeof insertPoseNoteSchema>;
export type PoseNote = typeof poseNotes.$inferSelect;

// Mobility check-ins for the 60-day splits program (v3.5)
export const mobilityCheckIns = pgTable("mobility_check_ins", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  pathwaySlug: text("pathway_slug").notNull(),
  day: integer("day").notNull(), // 1..60
  frontSplitInches: integer("front_split_inches").notNull(), // gap between hip and floor in the front split (inches)
  backSplitInches: integer("back_split_inches"), // nullable — only if trying backbends
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

export const insertMobilityCheckInSchema = createInsertSchema(mobilityCheckIns).omit({
  id: true,
  ownerId: true,
});
export type InsertMobilityCheckIn = z.infer<typeof insertMobilityCheckInSchema>;
export type MobilityCheckIn = typeof mobilityCheckIns.$inferSelect;

// Custom sequences built with the Sequence Builder (v5.1)
export const customFlows = pgTable("custom_flows", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  poseSequence: text("pose_sequence").notNull().default("[]"), // JSON array of { slug, holdSeconds, sides? }
  createdAt: text("created_at").notNull(),
  lastUsedAt: text("last_used_at"),
});

/**
 * Hold-duration bounds, shared by the client input and the server.
 *
 * Under 5s nothing has time to happen; over 300s is not a hold, it's a nap with
 * a timer. The server previously accepted anything a number could hold, so a
 * mangled input persisted a 33-minute Mountain Pose end to end.
 */
export const MIN_HOLD_SECONDS = 5;
export const MAX_HOLD_SECONDS = 300;

export const posePlanSchema = z.object({
  slug: z.string().min(1),
  holdSeconds: z
    .number({ invalid_type_error: "Hold must be a number of seconds" })
    .int("Hold must be a whole number of seconds")
    .min(MIN_HOLD_SECONDS, `Hold at least ${MIN_HOLD_SECONDS} seconds`)
    .max(MAX_HOLD_SECONDS, `Hold at most ${MAX_HOLD_SECONDS} seconds (5 minutes)`),
  sides: z.enum(["once", "each"]).optional(),
});
export type PosePlan = z.infer<typeof posePlanSchema>;

/** Clamp a possibly-hostile number into the allowed hold range. */
export function clampHoldSeconds(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 30;
  return Math.min(MAX_HOLD_SECONDS, Math.max(MIN_HOLD_SECONDS, n));
}

export const insertCustomFlowSchema = createInsertSchema(customFlows)
  .omit({ id: true, ownerId: true })
  .extend({
    name: z.string().min(1, "Name is required").max(80, "Keep the name under 80 characters"),
    // Validated as JSON *content*, not just as a string — the column stores
    // text, but what goes in it drives a timer a person follows with their body.
    poseSequence: z
      .string()
      .superRefine((raw, ctx) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pose sequence must be valid JSON" });
          return;
        }
        const result = z.array(posePlanSchema).min(1, "Add at least one pose").safeParse(parsed);
        if (!result.success) {
          for (const issue of result.error.issues) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Pose ${issue.path[0] !== undefined ? Number(issue.path[0]) + 1 : "?"}: ${issue.message}`,
            });
          }
        }
      }),
  });
export type InsertCustomFlow = z.infer<typeof insertCustomFlowSchema>;
export type CustomFlow = typeof customFlows.$inferSelect;
