import type { IStorage } from "./storage";
import type { InsertClass } from "@shared/schema";

/**
 * Mux's public demo asset, used by every placeholder so the library and the
 * player work before real classes are filmed. It is not yoga footage — the
 * titles and descriptions say these are placeholders, and nothing here claims
 * an instructor taught them.
 */
export const MUX_PUBLIC_TEST_PLAYBACK_ID = "EcHgOK9coz5K4rjSwOkoE7Y7O01201YMIC200RI6lNxnhs";

const PLACEHOLDER_NOTE = "Placeholder class: the video is Mux's public test clip until this class is filmed.";

/**
 * Thumbnails are the catalogue's own pose illustrations, not
 * `image.mux.com/<playbackId>/…`: a Plus thumbnail must never carry the
 * playback id a free viewer could stream from.
 */
type PlaceholderRow = Omit<InsertClass, "createdAt" | "muxPlaybackId" | "published">;
const ROWS: PlaceholderRow[] = [
  {
    slug: "gentle-morning-wake-up", title: "Gentle morning wake-up",
    description: `A slow, standing-to-floor sequence to loosen the spine and hips before the day. ${PLACEHOLDER_NOTE}`,
    instructorName: "Sadhana team", level: "beginner", durationMinutes: 10,
    focusTags: ["morning", "flexibility"], tier: "free", thumbnailUrl: "/poses/tadasana.webp",
  },
  {
    slug: "desk-back-relief", title: "Back relief for desk days",
    description: `Easy floor work for a stiff lower back: cat–cow, cobra and child's pose. ${PLACEHOLDER_NOTE}`,
    instructorName: "Sadhana team", level: "beginner", durationMinutes: 15,
    focusTags: ["back pain", "flexibility"], tier: "free", thumbnailUrl: "/poses/bhujangasana.webp",
  },
  {
    slug: "unwind-before-sleep", title: "Unwind before sleep",
    description: `Long, supported holds and slow breathing to settle a busy mind. ${PLACEHOLDER_NOTE}`,
    instructorName: "Sadhana team", level: "beginner", durationMinutes: 20,
    focusTags: ["stress", "sleep"], tier: "free", thumbnailUrl: "/poses/balasana.webp",
  },
  {
    slug: "steady-strength-flow", title: "Steady strength flow",
    description: `Standing poses held a little longer to build leg and core strength. ${PLACEHOLDER_NOTE}`,
    instructorName: "Sadhana team", level: "intermediate", durationMinutes: 25,
    focusTags: ["strength", "morning"], tier: "plus", thumbnailUrl: "/poses/virabhadrasana-ii.webp",
  },
  {
    slug: "deep-hamstring-release", title: "Deep hamstring release",
    description: `Forward folds and down dog to lengthen the backs of the legs. ${PLACEHOLDER_NOTE}`,
    instructorName: "Sadhana team", level: "intermediate", durationMinutes: 30,
    focusTags: ["flexibility", "back pain"], tier: "plus", thumbnailUrl: "/poses/uttanasana.webp",
  },
  {
    slug: "full-practice-stress-reset", title: "Full practice: stress reset",
    description: `A complete class from warm-up to a long final rest. ${PLACEHOLDER_NOTE}`,
    instructorName: "Sadhana team", level: "advanced", durationMinutes: 45,
    focusTags: ["stress", "strength"], tier: "plus", thumbnailUrl: "/poses/adho-mukha-svanasana.webp",
  },
];

export const PLACEHOLDER_CLASSES: ReadonlyArray<Omit<InsertClass, "createdAt">> = ROWS.map((row) => ({
  ...row, muxPlaybackId: MUX_PUBLIC_TEST_PLAYBACK_ID, published: true,
}));

/**
 * Upsert the placeholders by slug. Idempotent; a created_at already stored is
 * kept, and the base time is staggered so library order matches this list.
 */
export async function seedPlaceholderClasses(store: IStorage, now = Date.now()): Promise<number> {
  let index = 0;
  for (const row of PLACEHOLDER_CLASSES) {
    await store.upsertClassBySlug({ ...row, createdAt: new Date(now + index++ * 1000).toISOString() });
  }
  return PLACEHOLDER_CLASSES.length;
}
