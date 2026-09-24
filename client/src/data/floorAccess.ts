/**
 * Which poses can be practised without getting down to the floor.
 *
 * "Chair & Limited Mobility" promised "no floor required" while Day 1 ended
 * with Legs on a Chair — which starts "sit beside a chair, then lie back" —
 * and its notes said "or sit in a chair" next to poses whose own steps say
 * "sit cross-legged". A note is not an instruction: the player narrates the
 * catalog steps, not the program's margin notes.
 *
 * Entries here are read from each pose's *own first steps*, never inferred
 * from its name or category, and the quoted step is kept so the reason is
 * reviewable. A pose is only listed when every step can be done in a chair or
 * standing. Anything not listed is treated as floor-required.
 */
import { asanaBySlug, type Asana } from "@/data/content";

export type NoFloorPosition = "chair" | "standing";

export const NO_FLOOR_POSES: Record<string, { position: NoFloorPosition; step: string }> = {
  // Chair-seated: step 1 names a chair.
  "chair-forward-fold": { position: "chair", step: "Sit on the edge of a chair, feet grounded." },
  "womb-seat": { position: "chair", step: "Sit comfortably cross-legged or in a chair." },
  // Standing: nothing in the steps goes below the feet.
  tadasana: {
    position: "standing",
    step: "Stand at the top of your mat, feet together or hip-width apart, weight even across both feet.",
  },
  "urdhva-hastasana": { position: "standing", step: "Stand in Mountain with feet grounded and the spine tall." },
  "standing-side-stretch": { position: "standing", step: "Stand in Mountain with feet hip-width." },
  "wall-chest-opener": {
    position: "standing",
    step: "Stand beside a wall and place the palm and forearm on it at shoulder height.",
  },
  "wall-angel": { position: "standing", step: "Stand with back, head, and sacrum lightly on a wall." },
  "wall-calf-stretch": { position: "standing", step: "Face a wall and place both hands on it at shoulder height." },
};

export function requiresFloor(slug: string): boolean {
  return !(slug in NO_FLOOR_POSES);
}

export function noFloorPosition(slug: string): NoFloorPosition | null {
  return NO_FLOOR_POSES[slug]?.position ?? null;
}

/** True when nothing in the queue asks the practitioner to get down to the floor. */
export function isFloorFree(slugs: string[]): boolean {
  return slugs.length > 0 && slugs.every((s) => !requiresFloor(s));
}

const LEVEL: Record<Asana["difficulty"], number> = { Beginner: 0, Intermediate: 1, Advanced: 2 };

/**
 * May `toSlug` stand in for `fromSlug` without making the practice harder or
 * less accessible?
 *
 * - never a higher difficulty level;
 * - in a floor-free practice (`keepOffFloor`), never onto the floor, and
 *   never from a chair to standing — "seated" was the accommodation.
 */
export function swapPreservesConstraints(
  fromSlug: string,
  toSlug: string,
  opts: { keepOffFloor?: boolean } = {},
): boolean {
  const from = asanaBySlug(fromSlug);
  const to = asanaBySlug(toSlug);
  if (!from || !to) return false;
  if (LEVEL[to.difficulty] > LEVEL[from.difficulty]) return false;
  if (!opts.keepOffFloor) return true;
  if (requiresFloor(toSlug)) return false;
  if (noFloorPosition(fromSlug) === "chair" && noFloorPosition(toSlug) !== "chair") return false;
  return true;
}
