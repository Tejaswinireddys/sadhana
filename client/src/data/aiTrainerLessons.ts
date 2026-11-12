/**
 * AI trainer lesson previews — pilot MP4 + English captions for a few poses.
 *
 * These are not reviewed movement demonstrations. They must not be entered in
 * REVIEWED_MOVEMENT_DEMOS or promoted through instructorMediaManifest to
 * `published`. The UI labels them "AI trainer preview" so testers know they
 * are pilot content.
 */
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
};

export const AI_TRAINER_PREVIEW_LABEL = "AI trainer preview";

/**
 * Pilot lessons shipped for trainer testing. Keys are catalog asana slugs.
 * Paths are absolute from the site root so SPA deep links and static serving
 * both resolve them.
 */
export const AI_TRAINER_LESSONS: Record<string, AiTrainerLesson> = {
  tadasana: {
    slug: "tadasana",
    english: "Mountain Pose",
    sanskrit: "Tadasana",
    mp4: "/videos/ai-trainer/tadasana.mp4",
    captionsVtt: "/captions/ai-trainer/tadasana.vtt",
    poster: "/poses/tadasana.webp",
    label: AI_TRAINER_PREVIEW_LABEL,
    durationHint: "About 2½ minutes",
  },
  "adho-mukha-svanasana": {
    slug: "adho-mukha-svanasana",
    english: "Downward-Facing Dog",
    sanskrit: "Adho Mukha Svanasana",
    mp4: "/videos/ai-trainer/adho-mukha-svanasana.mp4",
    captionsVtt: "/captions/ai-trainer/adho-mukha-svanasana.vtt",
    poster: "/poses/adho-mukha-svanasana.webp",
    label: AI_TRAINER_PREVIEW_LABEL,
    durationHint: "About 2½ minutes",
  },
  "virabhadrasana-ii": {
    slug: "virabhadrasana-ii",
    english: "Warrior II",
    sanskrit: "Virabhadrasana II",
    mp4: "/videos/ai-trainer/virabhadrasana-ii.mp4",
    captionsVtt: "/captions/ai-trainer/virabhadrasana-ii.vtt",
    poster: "/poses/virabhadrasana-ii.webp",
    label: AI_TRAINER_PREVIEW_LABEL,
    durationHint: "About 2½ minutes",
  },
};

export const AI_TRAINER_LESSON_SLUGS = Object.keys(AI_TRAINER_LESSONS) as Array<
  keyof typeof AI_TRAINER_LESSONS
>;

export function aiTrainerLessonFor(slug: string): AiTrainerLesson | undefined {
  return AI_TRAINER_LESSONS[slug];
}

export function hasAiTrainerLesson(slug: string): boolean {
  return Boolean(AI_TRAINER_LESSONS[slug]);
}
