import { pgTable, text, integer, serial, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Practice sessions logged after completing a timed practice
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  date: text("date").notNull(), // ISO date string (YYYY-MM-DD or full ISO)
  durationMinutes: integer("duration_minutes").notNull(),
  asanas: text("asanas").notNull().default("[]"), // JSON array of asana slugs/names
  pathwaySlug: text("pathway_slug"),
  notes: text("notes"),
  kind: text("kind").notNull().default("asana"), // 'asana' | 'breathing'
  preMood: text("pre_mood"), // mood chip recorded before practice
  postMood: text("post_mood"), // mood chip recorded after practice
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

export const insertCustomFlowSchema = createInsertSchema(customFlows)
  .omit({ id: true, ownerId: true })
  .extend({
    name: z.string().min(1, "Name is required"),
    poseSequence: z.string(), // JSON-serialized array
  });
export type InsertCustomFlow = z.infer<typeof insertCustomFlowSchema>;
export type CustomFlow = typeof customFlows.$inferSelect;
