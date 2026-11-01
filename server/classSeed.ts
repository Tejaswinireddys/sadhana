import type { IStorage } from "./storage";
import type { InsertClass } from "@shared/schema";
import { muxSigningConfigured } from "./muxPlayback";

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
type PlaceholderRow = Omit<InsertClass, "createdAt" | "muxPlaybackId" | "published" | "playbackPolicy">;
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

/**
 * Free placeholders stream the public test clip. Plus placeholders are
 * `signed` with **no** playback id: Mux refuses a token on a public id (HTTP
 * 400), so the test clip cannot be served signed, and serving it public would
 * make a Plus class streamable by anyone holding the id. They show as Plus
 * (locked for free viewers, "not available yet" for members) until a real
 * signed asset is attached with `npm run class:add -- --slug <slug> …`.
 */
export const PLACEHOLDER_CLASSES: ReadonlyArray<Omit<InsertClass, "createdAt">> = ROWS.map((row) => (
  row.tier === "plus"
    ? { ...row, muxPlaybackId: null, playbackPolicy: "signed" as const, published: true }
    : { ...row, muxPlaybackId: MUX_PUBLIC_TEST_PLAYBACK_ID, playbackPolicy: "public" as const, published: true }
));

/**
 * A stored row now points at a real video (attached by `class:add`), so the
 * seed must not put the placeholder back over it on the next boot.
 */
export function isClaimedPlaceholder(stored: { muxPlaybackId: string | null } | undefined): boolean {
  const id = stored?.muxPlaybackId?.trim();
  return !!id && id !== MUX_PUBLIC_TEST_PLAYBACK_ID;
}

/**
 * Why signed classes will not play, for the boot log. Empty when every signed
 * class can be served.
 */
export function signedClassWarnings(
  rows: ReadonlyArray<{ slug: string; tier: string; playbackPolicy?: string | null; muxPlaybackId: string | null; published?: boolean | null }>,
  signingConfigured: boolean,
): string[] {
  const live = rows.filter((row) => row.published !== false);
  const signed = live.filter((row) => row.playbackPolicy === "signed");
  const warnings: string[] = [];
  if (signed.length && !signingConfigured) {
    warnings.push(`${signed.length} signed class(es) stay locked: set MUX_SIGNING_KEY_ID and MUX_SIGNING_KEY_PRIVATE`);
  }
  const noVideo = signed.filter((row) => !row.muxPlaybackId?.trim()).map((row) => row.slug);
  if (noVideo.length) warnings.push(`signed class(es) with no video yet (attach with npm run class:add): ${noVideo.join(", ")}`);
  const publicPlus = live.filter((row) => row.tier === "plus" && row.playbackPolicy !== "signed").map((row) => row.slug);
  if (publicPlus.length) warnings.push(`Plus class(es) on a public playback id are withheld until re-added as signed: ${publicPlus.join(", ")}`);
  return warnings;
}

/**
 * Upsert the placeholders by slug. Idempotent; a created_at already stored is
 * kept, the base time is staggered so library order matches this list, and a
 * placeholder that has been replaced by a real video is left alone. Logs why
 * any signed class will not play instead of falling back to a public id.
 */
export async function seedPlaceholderClasses(
  store: IStorage,
  now = Date.now(),
  warn: (message: string) => void = (message) => console.warn(`[classes] ${message}`),
): Promise<number> {
  let index = 0;
  let written = 0;
  for (const row of PLACEHOLDER_CLASSES) {
    const createdAt = new Date(now + index++ * 1000).toISOString();
    if (isClaimedPlaceholder(await store.getClassBySlug(row.slug))) continue;
    await store.upsertClassBySlug({ ...row, createdAt });
    written += 1;
  }
  for (const message of signedClassWarnings(await store.listClasses(), muxSigningConfigured())) warn(message);
  return written;
}
