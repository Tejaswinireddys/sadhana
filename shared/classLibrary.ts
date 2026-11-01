/**
 * Video class library: the rules shared by the API and the client.
 *
 * Pure so filtering, the Plus lock, resume and completion are unit-tested in
 * one place. The server is the only thing that decides whether a viewer gets
 * playback info — `presentClass` strips it for locked classes — so a free
 * account never receives a Plus playback id, not even inside a thumbnail URL.
 */
import { z } from "zod";

export const CLASS_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type ClassLevel = (typeof CLASS_LEVELS)[number];

export const CLASS_TIERS = ["free", "plus"] as const;
export type ClassTier = (typeof CLASS_TIERS)[number];

/**
 * Mux playback policy of a class's playback id. A public id streams on its
 * own; a signed one only with a JWT minted by the server for that viewer.
 */
export const CLASS_PLAYBACK_POLICIES = ["public", "signed"] as const;
export type ClassPlaybackPolicy = (typeof CLASS_PLAYBACK_POLICIES)[number];

/** How long signed class tokens live. The player refreshes before this. */
export const CLASS_TOKEN_SECONDS = 60 * 60;

/** The focus chips offered on /classes. Classes may carry other tags too. */
export const CLASS_FOCUS_TAGS = ["flexibility", "back pain", "morning", "stress", "strength", "sleep"] as const;

export const CLASS_DURATION_RANGES = [
  { id: "under-15", label: "Under 15 min", minMinutes: 0, maxMinutes: 14 },
  { id: "15-30", label: "15–30 min", minMinutes: 15, maxMinutes: 30 },
  { id: "30-plus", label: "30+ min", minMinutes: 31, maxMinutes: undefined },
] as const;
export type ClassDurationRangeId = (typeof CLASS_DURATION_RANGES)[number]["id"];

/** Watching this much of a class counts as finishing it. */
export const CLASS_COMPLETE_FRACTION = 0.9;
/** Below this, there is nothing worth resuming. */
export const CLASS_RESUME_MIN_SECONDS = 5;
/** The player saves progress this often while playing. */
export const CLASS_PROGRESS_SAVE_INTERVAL_MS = 15_000;
export const CLASS_PAGE_SIZE_DEFAULT = 24;
export const CLASS_PAGE_SIZE_MAX = 50;

/** A row of the `classes` table (see shared/schema.ts). */
export type ClassRecord = {
  id: number;
  slug: string;
  title: string;
  description: string;
  instructorName: string;
  level: ClassLevel;
  durationMinutes: number;
  focusTags: string[];
  muxPlaybackId: string | null;
  thumbnailUrl: string | null;
  tier: ClassTier;
  playbackPolicy: ClassPlaybackPolicy;
  published: boolean;
  createdAt: string;
};

export type ClassProgressRecord = {
  classId: number;
  secondsWatched: number;
  completed: boolean;
  updatedAt: string;
};

/** What a viewer is allowed to see of a class. */
export type ClassSummary = {
  id: number;
  slug: string;
  title: string;
  description: string;
  instructorName: string;
  level: ClassLevel;
  durationMinutes: number;
  focusTags: string[];
  thumbnailUrl: string | null;
  tier: ClassTier;
  /** True when the class is Plus and the viewer is not. */
  locked: boolean;
  /** Present only when the viewer may watch, and only on the class detail for signed classes. */
  playback: ClassPlayback | null;
  progress: { secondsWatched: number; completed: boolean; updatedAt: string } | null;
};

export type ViewerPlan = "free" | "plus";

/** Short-lived Mux JWTs for one signed playback id (audiences v, t and s). */
export type ClassPlaybackTokens = { playback: string; thumbnail: string; storyboard: string };

export type ClassPlayback =
  | { provider: "mux"; policy: "public"; playbackId: string }
  | { provider: "mux"; policy: "signed"; playbackId: string; tokens: ClassPlaybackTokens; expiresAt: number };

/**
 * Mints tokens for a signed playback id, or returns null when signing is not
 * configured (or fails). Injected so the shared rules stay pure.
 */
export type ClassTokenSigner = (playbackId: string) => { tokens: ClassPlaybackTokens; expiresAt: number } | null;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const classSlugSchema = z.string().min(1).max(120).regex(slugPattern, "Invalid class slug");

const csv = z
  .string()
  .max(400)
  .transform((value) => value.split(",").map((part) => part.trim().toLowerCase()).filter(Boolean));

/** Query string for GET /api/classes. */
export const classListQuerySchema = z
  .object({
    level: z.enum(CLASS_LEVELS).optional(),
    tier: z.enum(CLASS_TIERS).optional(),
    focus: csv.optional(),
    minMinutes: z.coerce.number().int().min(0).max(600).optional(),
    maxMinutes: z.coerce.number().int().min(0).max(600).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    pageSize: z.coerce.number().int().min(1).max(CLASS_PAGE_SIZE_MAX).default(CLASS_PAGE_SIZE_DEFAULT),
  })
  .refine((q) => q.minMinutes === undefined || q.maxMinutes === undefined || q.minMinutes <= q.maxMinutes, {
    message: "minMinutes must not exceed maxMinutes",
  });
export type ClassListQuery = z.infer<typeof classListQuerySchema>;

/** Body for POST /api/classes/:slug/progress. */
export const classProgressBodySchema = z.object({
  secondsWatched: z.number().finite().min(0).max(24 * 60 * 60),
  /** The media's real length, when the player knows it. */
  durationSeconds: z.number().finite().positive().max(24 * 60 * 60).optional(),
  completed: z.boolean().optional(),
});
export type ClassProgressBody = z.infer<typeof classProgressBodySchema>;

export type ClassFilters = Omit<ClassListQuery, "page" | "pageSize">;

/** Published classes matching every given facet. Focus matches any listed tag. */
export function filterClasses<T extends Pick<ClassRecord, "level" | "tier" | "durationMinutes" | "focusTags"> & { published?: boolean }>(
  rows: readonly T[],
  filters: ClassFilters,
): T[] {
  const focus = (filters.focus ?? []).map((tag) => tag.toLowerCase());
  return rows.filter((row) => {
    if (row.published === false) return false;
    if (filters.level && row.level !== filters.level) return false;
    if (filters.tier && row.tier !== filters.tier) return false;
    if (filters.minMinutes !== undefined && row.durationMinutes < filters.minMinutes) return false;
    if (filters.maxMinutes !== undefined && row.durationMinutes > filters.maxMinutes) return false;
    if (focus.length && !row.focusTags.some((tag) => focus.includes(tag.toLowerCase()))) return false;
    return true;
  });
}

export function paginate<T>(rows: readonly T[], page: number, pageSize: number) {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), page, pageSize, total, pageCount, hasMore: page < pageCount };
}

/** Stable library order: free before Plus, then oldest first, then title. */
export function sortClasses<T extends Pick<ClassRecord, "tier" | "createdAt" | "title">>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) =>
    (a.tier === b.tier ? 0 : a.tier === "free" ? -1 : 1) ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.title.localeCompare(b.title));
}

export function isClassLocked(row: Pick<ClassRecord, "tier">, viewerPlan: ViewerPlan): boolean {
  return row.tier === "plus" && viewerPlan !== "plus";
}

/**
 * What a viewer may play, if anything.
 *
 * - Locked, or no playback id: nothing.
 * - A Plus class is only ever served signed. A Plus row still on a public id
 *   (a pre-`playback_policy` row, or a mistake) is withheld from everyone,
 *   Plus members included, because the id alone would stream for anyone it
 *   was forwarded to.
 * - Signed ids are only sent together with tokens, and only when a signer is
 *   given (the class detail). With no signer, or signing unconfigured, the
 *   class stays unplayable rather than falling back to anything public.
 */
export function classPlayback(
  row: Pick<ClassRecord, "tier" | "muxPlaybackId" | "playbackPolicy">,
  viewerPlan: ViewerPlan,
  sign?: ClassTokenSigner,
): ClassPlayback | null {
  const playbackId = row.muxPlaybackId?.trim() || null;
  if (!playbackId || isClassLocked(row, viewerPlan)) return null;
  const policy: ClassPlaybackPolicy = row.playbackPolicy === "signed" ? "signed" : "public";
  if (policy === "public") return row.tier === "plus" ? null : { provider: "mux", policy, playbackId };
  const signed = sign?.(playbackId) ?? null;
  return signed ? { provider: "mux", policy, playbackId, ...signed } : null;
}

/**
 * The viewer's view of a class. Locked classes carry no playback id, and a
 * thumbnail URL that embeds it (Mux's `image.mux.com/<id>/…`) is dropped too —
 * with a public playback policy, the id alone is enough to stream.
 */
export function presentClass(
  row: ClassRecord,
  viewerPlan: ViewerPlan,
  progress?: ClassProgressRecord | null,
  sign?: ClassTokenSigner,
): ClassSummary {
  const locked = isClassLocked(row, viewerPlan);
  const playbackId = row.muxPlaybackId?.trim() || null;
  const thumbnailLeaksPlayback = !!playbackId && !!row.thumbnailUrl?.includes(playbackId);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    instructorName: row.instructorName,
    level: row.level,
    durationMinutes: row.durationMinutes,
    focusTags: [...row.focusTags],
    thumbnailUrl: locked && thumbnailLeaksPlayback ? null : row.thumbnailUrl,
    tier: row.tier,
    locked,
    playback: classPlayback(row, viewerPlan, sign),
    progress: progress ? { secondsWatched: progress.secondsWatched, completed: progress.completed, updatedAt: progress.updatedAt } : null,
  };
}

export function isCompleteAt(secondsWatched: number, durationSeconds: number | undefined): boolean {
  return !!durationSeconds && durationSeconds > 0 && secondsWatched / durationSeconds >= CLASS_COMPLETE_FRACTION;
}

/**
 * The stored progress after a save. Idempotent: the same body twice gives the
 * same row. Position is whatever was sent (rewinding moves it back), clamped
 * to the media length; completion is sticky once earned.
 */
export function nextProgress(
  existing: Pick<ClassProgressRecord, "completed"> | null | undefined,
  body: ClassProgressBody,
  classDurationMinutes: number,
): { secondsWatched: number; completed: boolean } {
  const duration = body.durationSeconds ?? classDurationMinutes * 60;
  const seconds = Math.round(Math.min(body.secondsWatched, duration));
  return {
    secondsWatched: seconds,
    completed: !!existing?.completed || !!body.completed || isCompleteAt(seconds, duration),
  };
}

/** Where the player should start: the saved position, unless finished or barely begun. */
export function resumeFrom(progress: ClassSummary["progress"] | undefined): number {
  if (!progress || progress.completed || progress.secondsWatched < CLASS_RESUME_MIN_SECONDS) return 0;
  return progress.secondsWatched;
}

/** Started, unfinished classes, most recently watched first. */
export function continueWatching(classes: readonly ClassSummary[], limit = 10): ClassSummary[] {
  return classes
    .filter((row) => row.progress && !row.progress.completed && row.progress.secondsWatched >= CLASS_RESUME_MIN_SECONDS)
    .sort((a, b) => (b.progress!.updatedAt).localeCompare(a.progress!.updatedAt))
    .slice(0, limit);
}

/**
 * "Next class": one the viewer can watch and hasn't finished, sharing the most
 * focus tags, then the same level, then library order. Falls back to a locked
 * class (its card leads to /plus) only when nothing open remains.
 */
export function nextClassSuggestion(current: ClassSummary, all: readonly ClassSummary[]): ClassSummary | null {
  const tags = new Set(current.focusTags.map((tag) => tag.toLowerCase()));
  const candidates = all.filter((row) => row.slug !== current.slug && !row.progress?.completed);
  const score = (row: ClassSummary) =>
    row.focusTags.filter((tag) => tags.has(tag.toLowerCase())).length * 2 + (row.level === current.level ? 1 : 0);
  const best = (rows: ClassSummary[]) =>
    rows.map((row, index) => ({ row, index, score: score(row) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.row ?? null;
  return best(candidates.filter((row) => !row.locked)) ?? best(candidates);
}

/** Filters for a duration chip. */
export function durationRange(id: ClassDurationRangeId | undefined): Pick<ClassFilters, "minMinutes" | "maxMinutes"> {
  const range = CLASS_DURATION_RANGES.find((r) => r.id === id);
  return range ? { minMinutes: range.minMinutes, maxMinutes: range.maxMinutes } : {};
}
