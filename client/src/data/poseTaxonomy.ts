/**
 * Pose-family membership for the library filters, search tags, and adaptive
 * plan pools. Core and Supine/Prone hold modern strength / floor drills that
 * do not fit the seven classical families.
 */
import type { Asana, Category } from "./content";

export const CORE_FAMILY_SLUGS = [
  "dolphin-plank",
  "dead-bug",
  "scapular-plank-push",
  "glute-bridge-march",
  "uttana-padasana",
] as const;

/** Poses whose catalog family is elsewhere but still belong in a Core filter. */
export const CORE_TRAINING_FOCUS_SLUGS = [
  "kumbhakasana", // Plank (Backbends)
  "vasisthasana", // Side Plank (Backbends)
  "navasana", // Boat (Seated)
] as const;

export const SUPINE_PRONE_FAMILY_SLUGS = [
  "pelvic-clock",
  "prone-y-lift",
  "active-hamstring-raise",
  "soft-bridge-pulse",
] as const;

const CORE_SET = new Set<string>(CORE_FAMILY_SLUGS);
const CORE_TRAINING_FOCUS = new Set<string>([...CORE_FAMILY_SLUGS, ...CORE_TRAINING_FOCUS_SLUGS]);
const SUPINE_PRONE_SET = new Set<string>(SUPINE_PRONE_FAMILY_SLUGS);

export function expectedFamily(slug: string): Category | null {
  if (CORE_SET.has(slug)) return "Core";
  if (SUPINE_PRONE_SET.has(slug)) return "Supine/Prone";
  return null;
}

/**
 * Library / builder category chips. Core includes poses whose primary family
 * is elsewhere (Plank, Side Plank, Boat) so a core practice search finds them.
 */
export function matchesCategoryFilter(
  asana: Pick<Asana, "slug" | "category">,
  category: Category | "All",
): boolean {
  if (category === "All") return true;
  if (category === "Core") return CORE_TRAINING_FOCUS.has(asana.slug);
  return asana.category === category;
}

/**
 * True when the held shape starts on the back or belly.
 * Tabletop, kneeling, and seated-to-lifted shapes (Reverse Tabletop) are not.
 */
export function isSupineOrProneBase(a: Asana): boolean {
  if (a.pose === "supine") return true;
  const first = (a.steps[0]?.text ?? "").toLowerCase();
  return (
    /\blie on your (back|belly)\b/.test(first) ||
    /\blie face down\b/.test(first) ||
    /\blie with knees bent\b/.test(first)
  );
}

/**
 * Catalog rows whose Sanskrit is a distinct asana name (…asana).
 * English-named drills (Dead Bug, Wall Angels) are the audit set.
 */
export function isClassicalAsanaName(a: Asana): boolean {
  if (a.sanskrit === a.english) return false;
  return /asana/i.test(a.sanskrit);
}
