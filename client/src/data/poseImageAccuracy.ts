/**
 * Illustrations that do not show the pose their instructions describe.
 *
 * Distinct from `poseDemoAvailability`, which is about *motion*: these images
 * are stills of the wrong shape. The generated-video problem was fixed by
 * refusing to play clips that open on another pose; this is the same failure
 * one layer down, where the still itself teaches something the steps do not say.
 *
 * Reviewed by eye, entry by entry, against the pose's own `steps`. Nothing is
 * inferred: an illustration is only listed here after someone has looked at it
 * and written down the difference. An empty entry means "looks right", not
 * "not checked" — `REVIEWED_ON` records when the sweep happened and
 * `poseImageAccuracy.test.ts` pins the list so a swapped asset cannot quietly
 * change the answer.
 *
 * While a pose is listed, the product must not present its image as an accurate
 * depiction of the supported variation. It still shows the image — a close
 * relative of the shape is more use to someone on the floor than an empty
 * frame — but it says what the difference is, and the alt text describes what
 * is actually drawn.
 */

export type PoseImageMismatch = {
  slug: string;
  /** What the illustration actually depicts. Becomes the alt text. */
  depicts: string;
  /** What the pose's own steps ask for. */
  instructed: string;
  /** One sentence for the practitioner, shown wherever the image teaches. */
  caveat: string;
  /**
   * A few words for the badge on the demonstration itself. The full `caveat`
   * runs to three lines over a 288px-wide illustration, covering the body it
   * is warning about; it belongs in the preflight and the title attribute.
   */
  shortCaveat: string;
  /** Production id for the asset that would resolve this. */
  neededAsset: string;
};

/** When the supported-pose illustrations were last reviewed against their steps. */
export const REVIEWED_ON = "2026-09-23";

/**
 * Poses reviewed and found wrong.
 *
 * Both entries are supported restorative shapes whose illustration shows the
 * unsupported version. Both appear in the "I'm tired" session, which is how
 * they were found.
 */
export const POSE_IMAGE_MISMATCHES: Record<string, PoseImageMismatch> = {
  "salamba-balasana": {
    slug: "salamba-balasana",
    depicts:
      "Kneeling and folded forward with a small round cushion under the chest, arms stretched along the floor, forehead low",
    instructed:
      "A bolster or stack of pillows lengthwise between the knees, the whole torso and one cheek resting on the support",
    caveat:
      "This illustration shows Child's Pose over a small cushion, not the full-length bolster support these instructions describe. Follow the steps, not the picture.",
    shortCaveat: "Illustration shows less support than the steps describe",
    neededAsset: "pose-illustration/salamba-balasana/bolster-lengthwise",
  },
  "chair-viparita-karani": {
    slug: "chair-viparita-karani",
    depicts:
      "Lying on the back with both legs extended straight up past a chair back, hips on the floor",
    instructed:
      "Calves resting along the chair seat with the knees bent roughly above the hips and the thighs vertical",
    caveat:
      "This illustration shows the legs straight up rather than the calves resting on the chair seat. The instructions describe the supported version — bend the knees and let the chair take the weight.",
    shortCaveat: "Illustration shows legs up, not calves on the seat",
    neededAsset: "pose-illustration/chair-viparita-karani/calves-on-seat",
  },
};

export function poseImageMismatch(slug: string): PoseImageMismatch | null {
  return POSE_IMAGE_MISMATCHES[slug] ?? null;
}

export function poseImageIsAccurate(slug: string): boolean {
  return !POSE_IMAGE_MISMATCHES[slug];
}

/**
 * The sentence to show wherever this image is used to teach. Null when the
 * illustration matches its instructions.
 */
export function poseImageCaveat(slug: string): string | null {
  return POSE_IMAGE_MISMATCHES[slug]?.caveat ?? null;
}

/** The badge form, for the demonstration itself. */
export function poseImageShortCaveat(slug: string): string | null {
  return POSE_IMAGE_MISMATCHES[slug]?.shortCaveat ?? null;
}

/**
 * Alt text describing what is drawn.
 *
 * `POSE_IMAGE_ALT` for a mismatched pose describes the pose as instructed, not
 * as illustrated — "torso draped over a bolster, forehead supported" for an
 * image showing neither. A screen-reader user was getting a more accurate
 * description of the pose than the image contains, which is its own kind of
 * wrong: they cannot tell that the picture disagrees with the words.
 */
export function accurateImageAlt(slug: string, storedAlt: string): string {
  return POSE_IMAGE_MISMATCHES[slug]?.depicts ?? storedAlt;
}

/** The illustrations that would resolve every listed mismatch. */
export function missingIllustrationManifest(): Array<{
  id: string;
  slug: string;
  need: string;
  whyCurrentAssetFails: string;
}> {
  return Object.values(POSE_IMAGE_MISMATCHES).map((m) => ({
    id: m.neededAsset,
    slug: m.slug,
    need: m.instructed,
    whyCurrentAssetFails: `Current illustration shows: ${m.depicts}.`,
  }));
}
