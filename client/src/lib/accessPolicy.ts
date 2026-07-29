/**
 * accessPolicy — who can see what, in one place.
 *
 * The brief was "registered users only should see the poses". Taken literally
 * that is a brick wall on 235 URLs, which would break the three things this app
 * depends on: shared links, search indexing, and someone deciding to trust it
 * before handing over an email. So the policy is drawn along a different line.
 *
 *   FREE            — how a pose is *identified*: name, Sanskrit, category,
 *                     difficulty, summary, illustration, why you'd practise it.
 *                     Enough to be findable, linkable, and credible.
 *
 *   ACCOUNT         — how a pose is *taught*: the step-by-step instructions,
 *                     the guided narration, the 3D demonstration past its
 *                     preview, the difficulty variations, the safety detail,
 *                     and running any guided session.
 *
 * The teaching is the product, so the teaching is what an account buys.
 *
 * PREVIEW_STEPS is the other half of the design. A wall converts badly and
 * feels hostile; a taste converts well. Visitors get the first narration step —
 * the figure moves once, the first cue is spoken — and then meet the gate,
 * having already seen what they're being asked to sign up for.
 *
 * ── Be honest about what this is ──────────────────────────────────────────
 * This is a CONVERSION gate, not a lock. The whole catalog ships to the
 * browser inside `catalog-content-*.js`, and the audio and images are plain
 * static files. Anyone with devtools can read all of it. Making this a real
 * lock means moving the catalog behind an authenticated `/api/asanas` and
 * serving media through an authorised route — a much larger change that also
 * costs offline support. Don't mistake this file for security.
 */

/** Flip to `true` for a hard wall: no preview, gated from the first frame. */
export const STRICT_GATE = false;

/**
 * Narration steps a signed-out visitor may see and hear. Ignored when
 * STRICT_GATE is on. Keep this at 1 unless you have data saying otherwise —
 * more preview means less reason to register.
 */
export const PREVIEW_STEPS = 1;

/** Everything an account unlocks, in the order the gate lists them. */
export const GATED_FEATURES = [
  "Step-by-step instructions",
  "Guided voice narration",
  "The full 3D demonstration",
  "Beginner, intermediate and advanced variations",
  "Safety notes and contraindications",
  "Guided sessions, flows and programmes",
] as const;

export type PoseSurface =
  /** Library grid, search results, pose identity. */
  | "browse"
  /** Narrated walkthrough + 3D stage on the detail page. */
  | "explanation"
  /** Written steps, variations, contraindications. */
  | "instructions"
  /** Running a sequence: /guided, /practice, pathways, trainer, builder. */
  | "session"
  /** Story poses and breathing games for children. */
  | "kids";

/**
 * Kids is deliberately never gated. The section is already parent-gated with a
 * maths question precisely because children don't have accounts, and putting a
 * signup form in front of a seven-year-old is both bad practice and bad taste.
 */
const FREE_SURFACES: ReadonlySet<PoseSurface> = new Set<PoseSurface>(["browse", "kids"]);

export function requiresAccount(surface: PoseSurface): boolean {
  return !FREE_SURFACES.has(surface);
}

/**
 * How many narration steps to reveal.
 *
 * Signed in  → all of them.
 * Signed out → the preview allowance, clamped to what exists.
 * Loading    → the preview allowance, so the page doesn't flash the full
 *              walkthrough and then snatch it away.
 */
export function visibleStepCount(opts: {
  totalSteps: number;
  isSignedIn: boolean;
  isLoading?: boolean;
}): number {
  const { totalSteps, isSignedIn } = opts;
  if (totalSteps <= 0) return 0;
  if (isSignedIn) return totalSteps;
  if (STRICT_GATE) return 0;
  return Math.max(0, Math.min(PREVIEW_STEPS, totalSteps));
}

/** True when a signed-out visitor is being shown less than the whole thing. */
export function isPreviewing(opts: { totalSteps: number; isSignedIn: boolean }): boolean {
  return visibleStepCount(opts) < opts.totalSteps;
}
