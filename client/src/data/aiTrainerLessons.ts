/**
 * AI trainer lesson previews — pilot MP4 + English captions.
 *
 * These are not reviewed movement demonstrations. They must not be entered in
 * REVIEWED_MOVEMENT_DEMOS or promoted through instructorMediaManifest to
 * `published`. The UI labels them "AI trainer preview".
 *
 * Adding a pose is data: one row in `aiTrainerLessons.manifest.json` plus
 * `client/public/videos/ai-trainer/{slug}-{version}.mp4`, a matching `.vtt`
 * under `client/public/captions/ai-trainer/`, and a `-poster.jpg`. See
 * `docs/ai-trainer-lessons.md`. Do not invent the media files.
 *
 * v3 files are 720×1280 slides. The trainer is a 16:9 picture in the middle;
 * the rest is beige. The player is 16:9 with object-cover so those bars are
 * cropped and the trainer fills the frame.
 */
// `with { type: "json" }` is required by Node's ESM loader (Playwright). Vite
// accepts the same attribute, so the client bundle still inlines the file.
import manifest from "./aiTrainerLessons.manifest.json" with { type: "json" };

export type AiTrainerLesson = {
  slug: string;
  english: string;
  sanskrit: string;
  /** Progressive MP4 under client/public (same-origin, Range-friendly). */
  mp4: string;
  captionsVtt: string;
  poster: string;
  /** Honest consumer-facing label — never "reviewed" or "instructor-approved". */
  label: string;
  durationHint: string;
  /** Native file size. The player crops to the centered 16:9 trainer band. */
  width: number;
  height: number;
};

export const AI_TRAINER_PREVIEW_LABEL = "AI trainer preview";

/** Asset revision baked into paths so deploy + hard-refresh pick up new media. */
export const AI_TRAINER_ASSET_VERSION = manifest.assetVersion;

type ManifestLesson = {
  slug: string;
  english: string;
  sanskrit: string;
  durationHint: string;
};

function lessonFrom(row: ManifestLesson): AiTrainerLesson {
  const version = AI_TRAINER_ASSET_VERSION;
  return {
    slug: row.slug,
    english: row.english,
    sanskrit: row.sanskrit,
    mp4: `/videos/ai-trainer/${row.slug}-${version}.mp4`,
    captionsVtt: `/captions/ai-trainer/${row.slug}-${version}.vtt`,
    poster: `/videos/ai-trainer/${row.slug}-${version}-poster.jpg`,
    label: AI_TRAINER_PREVIEW_LABEL,
    durationHint: row.durationHint,
    width: manifest.frame.width,
    height: manifest.frame.height,
  };
}

/**
 * Pilot lessons shipped for trainer testing. Keys are catalog asana slugs.
 * Paths are absolute from the site root so SPA deep links and static serving
 * both resolve them.
 */
export const AI_TRAINER_LESSONS: Record<string, AiTrainerLesson> = Object.fromEntries(
  (manifest.lessons as ManifestLesson[]).map((row) => [row.slug, lessonFrom(row)]),
);

export const AI_TRAINER_LESSON_SLUGS = Object.keys(AI_TRAINER_LESSONS);

export function aiTrainerLessonFor(slug: string): AiTrainerLesson | undefined {
  return AI_TRAINER_LESSONS[slug];
}

export function hasAiTrainerLesson(slug: string): boolean {
  return Boolean(AI_TRAINER_LESSONS[slug]);
}

/** One honest sentence for marketing. Names real coverage; does not invent the rest. */
export function aiTrainerCoverageLine(): string {
  const lessons = AI_TRAINER_LESSON_SLUGS.map((slug) => AI_TRAINER_LESSONS[slug]!).filter(Boolean);
  if (lessons.length === 0) {
    return "Illustrated poses with a calm voice. AI trainer video is not in the library yet.";
  }
  const names = lessons.map((lesson) => lesson.english);
  const list = names.length <= 4 ? names.join(", ") : `${names.length} poses`;
  return `AI trainer video on ${list}. Every other pose stays a labeled still until its video is ready.`;
}

/**
 * What a teaching surface may show. A reviewed movement demo wins. An AI
 * preview is pilot video and must stay labeled as such. Otherwise a still.
 */
export function teachingVisual(slug: string, reviewedMovement: boolean): "movement" | "ai-preview" | "still" {
  if (reviewedMovement) return "movement";
  if (hasAiTrainerLesson(slug)) return "ai-preview";
  return "still";
}

/**
 * 16:9 frame. The file is a tall slide; object-cover at object-center crops
 * the beige bars and keeps the trainer. Never object-contain on these files —
 * that is what left the trainer postage-stamp sized inside the beige.
 */
export const AI_TRAINER_PORTRAIT_SHELL =
  "mx-auto flex w-full max-w-3xl items-center justify-center";

/** Detail / VideoPlayer. */
export const AI_TRAINER_PORTRAIT_VIDEO =
  "aspect-video h-auto w-full max-w-full rounded-xl bg-card object-cover object-center";

/** Guided practice stage: fit the stage without a portrait letterbox. */
export const AI_TRAINER_PRACTICE_VIDEO =
  "aspect-video h-auto max-h-full w-full max-w-full rounded-xl object-cover object-center";
