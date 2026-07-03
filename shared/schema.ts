import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Practice sessions logged after completing a timed practice
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // ISO date string (YYYY-MM-DD or full ISO)
  durationMinutes: integer("duration_minutes").notNull(),
  asanas: text("asanas").notNull().default("[]"), // JSON array of asana slugs/names
  pathwaySlug: text("pathway_slug"),
  notes: text("notes"),
  kind: text("kind").notNull().default("asana"), // 'asana' | 'breathing'
  preMood: text("pre_mood"), // mood chip recorded before practice
  postMood: text("post_mood"), // mood chip recorded after practice
});

export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

// User preferences (single-row settings store)
export const preferences = sqliteTable("preferences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  motionEnabled: integer("motion_enabled").notNull().default(1), // 1 = animations on
  voiceEnabled: integer("voice_enabled").notNull().default(1), // 1 = voice narration on
});

export const insertPreferencesSchema = createInsertSchema(preferences).omit({ id: true });
export type InsertPreferences = z.infer<typeof insertPreferencesSchema>;
export type Preferences = typeof preferences.$inferSelect;

// Pathway enrollments
export const pathwayEnrollments = sqliteTable("pathway_enrollments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pathwaySlug: text("pathway_slug").notNull(),
  startDate: text("start_date").notNull(),
  active: integer("active").notNull().default(1),
});

export const insertEnrollmentSchema = createInsertSchema(pathwayEnrollments).omit({ id: true });
export type InsertEnrollment = z.infer<typeof insertEnrollmentSchema>;
export type Enrollment = typeof pathwayEnrollments.$inferSelect;

// Favorite affirmations
export const favoriteAffirmations = sqliteTable("favorite_affirmations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  affirmationText: text("affirmation_text").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertFavoriteSchema = createInsertSchema(favoriteAffirmations).omit({ id: true });
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Favorite = typeof favoriteAffirmations.$inferSelect;

// Journal entries
export const journalEntries = sqliteTable("journal_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  title: text("title"),
  body: text("body").notNull().default(""),
  mood: text("mood"),
  tags: text("tags").notNull().default("[]"), // JSON array
});

export const insertJournalSchema = createInsertSchema(journalEntries).omit({ id: true });
export type InsertJournal = z.infer<typeof insertJournalSchema>;
export type Journal = typeof journalEntries.$inferSelect;

// Active personalization profile (single active row, but history retained)
export const userProfiles = sqliteTable("user_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: text("profile_id").notNull(), // FK to static profile id
  activatedAt: text("activated_at").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({ id: true });
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;

// Kids stickers earned by completing a kids pose
export const kidsStickers = sqliteTable("kids_stickers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  poseSlug: text("pose_slug").notNull(),
  earnedAt: text("earned_at").notNull(),
});

export const insertStickerSchema = createInsertSchema(kidsStickers).omit({ id: true });
export type InsertSticker = z.infer<typeof insertStickerSchema>;
export type Sticker = typeof kidsStickers.$inferSelect;

// Favorited library poses (v3.4)
export const favoriteAsanas = sqliteTable("favorite_asanas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertFavoriteAsanaSchema = createInsertSchema(favoriteAsanas).omit({ id: true });
export type InsertFavoriteAsana = z.infer<typeof insertFavoriteAsanaSchema>;
export type FavoriteAsana = typeof favoriteAsanas.$inferSelect;

// Celebrated milestones — recorded once so each is celebrated only a single time (v3.4)
export const milestones = sqliteTable("milestones", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").notNull(), // 'streak_7', 'total_50', etc.
  reachedAt: text("reached_at").notNull(),
});

export const insertMilestoneSchema = createInsertSchema(milestones).omit({ id: true });
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type Milestone = typeof milestones.$inferSelect;

// Personal notes per pose (v3.4) — one row per slug (upsert)
export const poseNotes = sqliteTable("pose_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  body: text("body").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertPoseNoteSchema = createInsertSchema(poseNotes).omit({ id: true });
export type InsertPoseNote = z.infer<typeof insertPoseNoteSchema>;
export type PoseNote = typeof poseNotes.$inferSelect;

// Mobility check-ins for the 60-day splits program (v3.5)
export const mobilityCheckIns = sqliteTable("mobility_check_ins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pathwaySlug: text("pathway_slug").notNull(),
  day: integer("day").notNull(), // 1..60
  frontSplitInches: integer("front_split_inches").notNull(), // gap between hip and floor in the front split (inches)
  backSplitInches: integer("back_split_inches"), // nullable — only if trying backbends
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

export const insertMobilityCheckInSchema = createInsertSchema(mobilityCheckIns).omit({ id: true });
export type InsertMobilityCheckIn = z.infer<typeof insertMobilityCheckInSchema>;
export type MobilityCheckIn = typeof mobilityCheckIns.$inferSelect;
