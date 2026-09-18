/**
 * Shared restriction adaptations — used by /instructor, /trainer, /guided,
 * and pose teaching. Difficulty levels (beginner/intermediate/advanced) are
 * NOT substitutes for restriction-specific modifications.
 *
 * Rules are catalog-editor reviewed content mappings, not medical clearance.
 */
import { asanaBySlug } from "@/data/content";

/** Stable adaptation IDs — distinct from difficulty levels. */
export type AdaptationId =
  | "wrist_forearm_plank"
  | "pregnancy_plank_modify"
  | "knee_supported_child"
  | "wall_supported_mountain"
  | "wrist_fist_catcow";

export type AdaptationAction =
  | { type: "use_adaptation"; adaptationId: AdaptationId }
  | { type: "prefer_beginner" }
  | { type: "exclude"; substituteSlug?: string }
  | { type: "warn" };

export type AdaptationContent = {
  id: AdaptationId;
  /** Pose this adaptation belongs to (may keep display title). */
  poseSlug: string;
  displayName: string;
  description: string;
  props: string[];
  holdSeconds: number;
  cues: string[];
  steps: string[];
  /** Optional media slug when a different catalog clip matches the shape. */
  mediaSlug: string;
  /** Honest consumer label — no raw asset paths. */
  mediaConsumerLabel: string;
  missingAssetId: string;
  reviewedBy: "catalog_editor";
};

/**
 * Restriction-specific teaching content. Beginner knee-plank is separate from
 * forearm plank for wrists.
 */
export const ADAPTATIONS: Record<AdaptationId, AdaptationContent> = {
  wrist_forearm_plank: {
    id: "wrist_forearm_plank",
    poseSlug: "kumbhakasana",
    displayName: "Forearm plank",
    description:
      "Come onto the forearms with elbows under the shoulders, keeping a long line from crown to heels (or knees).",
    props: ["blanket", "none"],
    holdSeconds: 25,
    cues: [
      "Elbows under the shoulders, forearms parallel",
      "Press the forearms down and broaden across the upper back",
      "Draw the lower belly in so the hips do not sag",
    ],
    steps: [
      "From hands and knees, lower onto your forearms with the elbows stacked under the shoulders.",
      "Interlace the fingers or keep the palms flat — choose what feels steady for your wrists.",
      "Step the feet back into a long line, or keep the knees down for a shorter lever.",
      "Hold with steady breath, pressing the floor away through the forearms — not the hands.",
    ],
    // Presentation clip for forearm shape (not filmed instructor).
    mediaSlug: "dolphin-plank",
    mediaConsumerLabel:
      "Forearm-plank presentation animation — filmed instructor demo for this adaptation is not available yet.",
    missingAssetId: "filmed-instructor/kumbhakasana/wrist-forearm",
    reviewedBy: "catalog_editor",
  },
  pregnancy_plank_modify: {
    id: "pregnancy_plank_modify",
    poseSlug: "kumbhakasana",
    displayName: "Knees-down plank",
    description: "Keep the knees down and take a shorter hold after the second trimester.",
    props: ["blanket", "none"],
    holdSeconds: 15,
    cues: [
      "Knees stay on the floor",
      "Keep the spine long — no sinking in the low back",
      "Shorten the hold and rest whenever you need",
    ],
    steps: [
      "From hands and knees, walk the hands forward a little while the knees stay down.",
      "Keep a long line from the crown to the knees.",
      "Hold briefly with easy breath, then rest in Child’s Pose if you prefer.",
    ],
    mediaSlug: "kumbhakasana",
    mediaConsumerLabel:
      "Knees-down presentation reference — pregnancy-specific filmed demo is not available yet.",
    missingAssetId: "filmed-instructor/kumbhakasana/pregnancy-modify",
    reviewedBy: "catalog_editor",
  },
  knee_supported_child: {
    id: "knee_supported_child",
    poseSlug: "balasana",
    displayName: "Child’s Pose with knee support",
    description: "Pad the knees and ankles; rest the torso on a bolster if helpful.",
    props: ["bolster", "blanket"],
    holdSeconds: 60,
    cues: [
      "Blanket under the knees or ankles",
      "Rest the torso on a bolster if folding is intense",
      "Let the forehead be supported",
    ],
    steps: [
      "Kneel with a folded blanket under the knees or ankles.",
      "Bring the big toes together and sit the hips toward the heels as far as is comfortable.",
      "Rest the torso on a bolster or the floor and soften the breath.",
    ],
    mediaSlug: "balasana",
    mediaConsumerLabel:
      "Supported Child’s Pose reference — filmed supported demo is not available yet.",
    missingAssetId: "filmed-instructor/balasana/knee-supported",
    reviewedBy: "catalog_editor",
  },
  wall_supported_mountain: {
    id: "wall_supported_mountain",
    poseSlug: "tadasana",
    displayName: "Mountain Pose at the wall",
    description: "Stand with the back near a wall to feel vertical alignment.",
    props: ["wall", "none"],
    holdSeconds: 30,
    cues: [
      "Heels and shoulder blades lightly touch the wall",
      "Feet hip-width for a wider base",
      "Soft knees — do not lock",
    ],
    steps: [
      "Stand with your back near a wall, feet hip-width apart.",
      "Lightly touch the wall with the heels and shoulder blades.",
      "Lengthen the crown up and breathe steadily.",
    ],
    mediaSlug: "tadasana",
    mediaConsumerLabel:
      "Wall-supported Mountain reference — filmed wall demo is not available yet.",
    missingAssetId: "filmed-instructor/tadasana/wall-supported",
    reviewedBy: "catalog_editor",
  },
  wrist_fist_catcow: {
    id: "wrist_fist_catcow",
    poseSlug: "marjaryasana-bitilasana",
    displayName: "Cat–Cow on fists or forearms",
    description:
      "Keep the spine moving with the breath while taking weight on the fists or forearms instead of flat palms.",
    props: ["blanket", "none"],
    holdSeconds: 45,
    cues: [
      "Come onto the fists or forearms — not flat palms",
      "Knees under the hips, shoulders stacked over the support",
      "Move slowly with the breath; keep the wrists quiet",
    ],
    steps: [
      "From all fours, curl the hands into fists (knuckles down) or lower onto the forearms.",
      "Stack the shoulders over the fists or elbows; keep the knees under the hips.",
      "Inhale to gently arch into Cow; exhale to round into Cat — without pressing into open palms.",
      "Move for several breaths, then rest with the wrists unloaded.",
    ],
    mediaSlug: "marjaryasana-bitilasana",
    mediaConsumerLabel:
      "Fist/forearm Cat–Cow reference — filmed wrist-adapted demo is not available yet.",
    missingAssetId: "filmed-instructor/marjaryasana-bitilasana/wrist-fist",
    reviewedBy: "catalog_editor",
  },
};

/** Map catalog avoidIf body areas + severity to adaptation actions for pilot poses. */
export function adaptationActionFor(opts: {
  poseSlug: string;
  bodyArea: string;
  severity: "avoid" | "modify" | "caution";
  condition: string;
}): AdaptationAction {
  const { poseSlug, bodyArea, severity, condition } = opts;
  const area = bodyArea.toLowerCase();
  const text = condition.toLowerCase();

  if (poseSlug === "kumbhakasana") {
    if (severity === "modify" && (area === "wrists" || /wrist|forearm|elbow/.test(text))) {
      return { type: "use_adaptation", adaptationId: "wrist_forearm_plank" };
    }
    if (severity === "modify" && (area === "pregnancy" || /pregnan/.test(text))) {
      return { type: "use_adaptation", adaptationId: "pregnancy_plank_modify" };
    }
    if (severity === "caution" && (area === "wrists" || /carpal/.test(text))) {
      return { type: "use_adaptation", adaptationId: "wrist_forearm_plank" };
    }
  }
  if (poseSlug === "marjaryasana-bitilasana") {
    if (
      (severity === "modify" || severity === "caution") &&
      (area === "wrists" || /wrist|fist|forearm|carpal/.test(text))
    ) {
      return { type: "use_adaptation", adaptationId: "wrist_fist_catcow" };
    }
  }
  if (poseSlug === "balasana" && severity === "modify" && (area === "knees" || /knee/.test(text))) {
    return { type: "use_adaptation", adaptationId: "knee_supported_child" };
  }
  if (
    poseSlug === "tadasana" &&
    severity === "modify" &&
    (/standing|wall|seated/.test(text) || area === "general")
  ) {
    return { type: "use_adaptation", adaptationId: "wall_supported_mountain" };
  }

  if (severity === "avoid") {
    const substitute =
      poseSlug === "kumbhakasana"
        ? "balasana"
        : poseSlug === "virabhadrasana-ii"
          ? "tadasana"
          : poseSlug === "marjaryasana-bitilasana"
            ? "balasana"
            : undefined;
    return { type: "exclude", substituteSlug: substitute };
  }
  if (severity === "modify") {
    // Only when no specific adaptation exists — never the default for wrists/plank.
    return { type: "prefer_beginner" };
  }
  return { type: "warn" };
}

/** Trainer / guided: region → pose substitutions (must still pass revalidation). */
export const REGION_SUBSTITUTIONS: Record<string, Record<string, string>> = {
  Wrists: {
    kumbhakasana: "dolphin-plank",
    "marjaryasana-bitilasana": "sukhasana",
    vasisthasana: "dolphin-plank",
  },
  Knees: {
    balasana: "viparita-karani",
  },
};

/** Wrist-loading poses to drop when Injured with no location named. */
export const WRIST_LOADING_WHEN_UNKNOWN = new Set([
  "kumbhakasana",
  "chaturanga-dandasana",
  "vasisthasana",
  "adho-mukha-svanasana",
  "marjaryasana-bitilasana",
  "bakasana",
]);

/**
 * Revalidate a candidate substitute: it must exist and must not itself be
 * excluded for the same sore parts.
 */
export function revalidateSubstitute(
  substituteSlug: string,
  soreParts: string[],
  isExcluded: (slug: string, soreParts: string[]) => boolean,
): string | null {
  if (!asanaBySlug(substituteSlug)) return null;
  if (isExcluded(substituteSlug, soreParts)) return null;
  return substituteSlug;
}

export function substituteForRegion(
  slug: string,
  soreParts: string[],
  isExcluded: (slug: string, soreParts: string[]) => boolean,
): string | null {
  for (const part of soreParts) {
    const map = REGION_SUBSTITUTIONS[part];
    const next = map?.[slug];
    if (!next) continue;
    const ok = revalidateSubstitute(next, soreParts, isExcluded);
    if (ok) return ok;
  }
  return null;
}

/** Trainer wizard: Injured requires a location (or explicit prefer-not-to-say). */
export const PREFER_NOT_TO_SAY_PART = "Prefer not to say";

/**
 * Adapt a pose list for guided / practice queues using the same substitutions
 * as the trainer. Drops poses that remain unsafe after substitution.
 */
export function adaptPoseSlugsForRestrictions(
  slugs: string[],
  soreParts: string[],
  isExcluded: (slug: string, soreParts: string[]) => boolean = defaultIsExcluded,
): string[] {
  const parts = soreParts.filter((p) => p && p !== "None specific" && p !== PREFER_NOT_TO_SAY_PART);
  if (parts.length === 0) return slugs;
  const out: string[] = [];
  for (const slug of slugs) {
    const sub = substituteForRegion(slug, parts, isExcluded);
    const next = sub ?? slug;
    if (isExcluded(next, parts)) continue;
    if (!out.includes(next)) out.push(next);
  }
  return out;
}

function defaultIsExcluded(slug: string, soreParts: string[]): boolean {
  const pose = asanaBySlug(slug);
  if (!pose) return true;
  for (const part of soreParts) {
    const map = REGION_SUBSTITUTIONS[part];
    // Originals that have a named substitute stay excluded on this surface.
    if (map?.[slug]) return true;
    const kw = part.toLowerCase().replace(/s$/, "");
    const hay = [...pose.contraindications, ...pose.avoidIf.map((a) => a.condition)]
      .join(" ")
      .toLowerCase();
    if (hay.includes(kw) && pose.avoidIf.some((a) => a.severity === "avoid")) return true;
  }
  return false;
}

export function trainerNeedsBodyLocation(body: string[]): boolean {
  return body.some((b) => /injured/i.test(b));
}

export function trainerLocationSatisfied(body: string[], soreParts: string[]): boolean {
  if (!trainerNeedsBodyLocation(body)) return true;
  const named = soreParts.filter((p) => p && p !== "None specific");
  return named.length > 0;
}

/** Last trainer/guided care regions — shared across surfaces for revalidation. */
const CARE_REGIONS_KEY = "sadhana.careRegions.v1";

export function saveCareRegions(parts: string[]): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    const cleaned = parts.filter((p) => p && p !== "None specific");
    sessionStorage.setItem(CARE_REGIONS_KEY, JSON.stringify(cleaned));
  } catch {
    /* private mode */
  }
}

export function loadCareRegions(): string[] {
  try {
    if (typeof sessionStorage === "undefined") return [];
    const raw = sessionStorage.getItem(CARE_REGIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
