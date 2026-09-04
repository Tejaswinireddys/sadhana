import type { Asana, Category, Difficulty } from "@/data/content";

/**
 * Structured teaching content for the pose-explanation experience.
 * Derived from existing asana fields — no parallel content library required.
 */
export type PoseExplanationContent = {
  formCues: string[];
  breathCue: string;
  alignmentTips: string[];
  watchOuts: string[];
  feelIt: string[];
  modification: string;
};

/** Copied into ~75 later catalog entries. Form coaching must never ship this. */
export const PLACEHOLDER_FORM_CUES = ["Aligned joints", "Long spine", "Steady gaze"] as const;
export const PLACEHOLDER_BEGINNER_CUES = ["Props welcome", "Smaller range", "Soft breath"] as const;
export const PLACEHOLDER_ADVANCED_CUES = ["Honest edge", "No forcing", "Quiet face"] as const;

function cueKey(cues: readonly string[]): string {
  return cues.map((c) => c.trim().toLowerCase()).join("|");
}

export function isPlaceholderCues(cues: readonly string[]): boolean {
  const key = cueKey(cues);
  return (
    key === cueKey(PLACEHOLDER_FORM_CUES) ||
    key === cueKey(PLACEHOLDER_BEGINNER_CUES) ||
    key === cueKey(PLACEHOLDER_ADVANCED_CUES)
  );
}

function uniq(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function tokenOverlap(a: string, b: string): number {
  const at = tokens(a);
  const bt = tokens(b);
  if (at.size < 3 || bt.size < 3) return 0;
  let hit = 0;
  for (const w of at) if (bt.has(w)) hit++;
  return hit / Math.min(at.size, bt.size);
}

/** Drop near-duplicate cautions that differ only by punctuation or wrapping. */
function uniqLoose(items: string[]): string[] {
  const out: string[] = [];
  for (const raw of items) {
    const t = raw.trim();
    if (!t) continue;
    const n = normalizeCue(t);
    const duplicate = out.some((existing) => {
      const e = normalizeCue(existing);
      if (e === n) return true;
      const [shorter, longer] = e.length <= n.length ? [e, n] : [n, e];
      if (shorter.length >= 16 && longer.includes(shorter)) return true;
      return tokenOverlap(existing, t) >= 0.7;
    });
    if (duplicate) continue;
    out.push(t);
  }
  return out;
}

function normalizeCue(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set([
  "the", "a", "an", "and", "or", "to", "of", "in", "on", "your", "with",
  "without", "then", "from", "for", "as", "at", "into", "over", "up", "down",
  "you", "your", "their", "this", "that",
]);

function tokens(text: string): Set<string> {
  return new Set(
    normalizeCue(text).split(" ").filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

/** True when a cue is the same teaching as an entry step (reshuffled how-to). */
export function cueEchoesSteps(cue: string, steps: readonly { text: string }[]): boolean {
  const cueN = normalizeCue(cue);
  if (!cueN) return false;
  for (const step of steps) {
    const stepN = normalizeCue(step.text);
    if (!stepN) continue;
    if (cueN === stepN) return true;
    const [shorter, longer] = cueN.length <= stepN.length ? [cueN, stepN] : [stepN, cueN];
    if (shorter.length >= 20 && longer.includes(shorter)) return true;
    const ct = tokens(cue);
    const st = tokens(step.text);
    if (ct.size < 4 || st.size < 4) continue;
    let overlap = 0;
    for (const t of ct) if (st.has(t)) overlap++;
    const ofCue = overlap / ct.size;
    const ofStep = overlap / st.size;
    if (overlap >= 4 && ofCue >= 0.85 && ofStep >= 0.65) return true;
  }
  return false;
}

/** Poses whose catalog cues were copied from steps — teach the sensation instead. */
const FORM_FEEL: Record<string, string[]> = {
  "dead-bug": [
    "Low back glued to the mat, not arched",
    "Ribs heavy, navel drawing in as the limbs reach",
    "Opposite limbs long without the belly popping",
  ],
  "reverse-tabletop": [
    "Weight in the hands and feet, hips lifting",
    "Chest open, not collapsing toward the chin",
    "Knees tracking over the ankles, not splaying",
  ],
  "wall-angel": [
    "Ribs stay on the wall, not flared",
    "Wrists and elbows seek the wall without shrugging",
    "Chin slightly tucked, back of the head light on the wall",
  ],
  "couch-hip-flexor": [
    "Pelvis tucked so the stretch lives in the front of the hip, not the low back",
    "Front knee tracking over the ankle",
    "Back thigh heavy, hip pointing down",
  ],
  "dolphin-plank": [
    "Forearms press, shoulders away from the ears",
    "Hips in one long line — not piked, not sagging",
    "Heels reaching back, legs alive",
  ],
};

const CATEGORY_FEELS: Record<Category, string[]> = {
  Standing: [
    "Weight in the heels and the mounds of the big toes, not just the toes",
    "Ribs knitted toward the midline, not flared",
    "Crown lifting, shoulders heavy",
    "Inner thighs drawing toward each other",
    "Jaw and forehead stay quiet",
    "Four corners of each foot equally awake",
  ],
  Seated: [
    "Sit bones heavy, not perched on the tail",
    "Spine stacking on each inhale, not collapsing",
    "Thighs releasing instead of gripping",
    "Shoulders dropping away from the ears",
    "Belly soft enough that the breath can drop",
    "Crown lifting without stiffening the jaw",
  ],
  "Forward Bends": [
    "Hinge from the hips, not the waist",
    "Weight staying in the heels",
    "Spine long, not rounding to chase the toes",
    "Neck following the spine, gaze quiet",
    "Hamstrings lengthening without a yank",
    "Let the head hang if the neck is willing",
  ],
  Backbends: [
    "Lengthen before you arch",
    "Press through the foundation so the spine can float",
    "Throat soft, jaw unclenched",
    "Glutes engaged just enough to support, not clench",
    "Chest opening without pinching the low back",
    "Keep the back of the neck long",
  ],
  "Hip Openers": [
    "Let gravity drop the knees — don't force the stretch",
    "Pelvis heavy, not tipping to one side",
    "Inner thighs releasing, not gripping",
    "Breath dropping into the hips on the exhale",
    "No yanking — wait for the tissue to yield",
    "Square the hips even when one side is louder",
  ],
  Core: [
    "Low belly drawing in, not braced into the throat",
    "Hips in one long line — not piked, not sagging",
    "Ribs knitted so the low back stays quiet",
    "Breath steady; never hold it as the midline works",
    "Shoulders away from the ears while the trunk stays strong",
    "Move slow enough that the brace never leaks",
  ],
  "Supine/Prone": [
    "Back of the head and sacrum heavy on the floor",
    "Low back unforced — small range is still the work",
    "Shoulders dropping away from the ears",
    "Jaw and forehead stay quiet",
    "Legs active without gripping the neck",
    "Let the floor hold you while the shape stays honest",
  ],
  Inversions: [
    "Weight in the foundation, neck long",
    "Core lifting the hips rather than dumping into the shoulders",
    "Gaze steady and quiet",
    "Fingers spread, pressing the whole palm",
    "Shoulders away from the ears even upside down",
    "Legs reaching as if the floor were still under the feet",
  ],
  Restorative: [
    "Body heavy into the support",
    "Jaw and forehead soft",
    "Breath unforced — no pushing the range",
    "Let the floor or props hold you",
    "Eyes easy, even if they stay open",
    "Nothing to perform — rest is the work",
  ],
};

function hashSlug(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Three alignment/sensation cues — never entry steps, stretch-zone copy, or benefits.
 * Used when variation cues are placeholders or a reshuffle of How to practice.
 */
export function coachingCuesFor(asana: Asana, _level: Difficulty = "Intermediate"): string[] {
  const authored = FORM_FEEL[asana.slug];
  if (authored) return authored.slice(0, 3);

  const bank = CATEGORY_FEELS[asana.category];
  const start = hashSlug(asana.slug) % bank.length;
  const cues: string[] = [];
  for (let i = 0; i < bank.length && cues.length < 3; i++) {
    const next = bank[(start + i) % bank.length]!;
    if (!cueEchoesSteps(next, asana.steps)) cues.push(next);
  }

  while (cues.length < 3) {
    const fallback = "Soften the face and stay at an honest edge";
    if (!cues.includes(fallback)) cues.push(fallback);
    else break;
  }

  return cues.slice(0, 3);
}

function formCuesFromCatalog(asana: Asana, rawForm: string[], level: Difficulty): string[] {
  if (isPlaceholderCues(rawForm)) return coachingCuesFor(asana, level);
  const kept = rawForm.filter((c) => !cueEchoesSteps(c, asana.steps));
  if (kept.length < 3) return coachingCuesFor(asana, level);
  return kept.slice(0, 5);
}

/**
 * Build elegant teaching panels from the asana model.
 * Prefers intermediate cues; falls back across difficulty levels.
 */
export function buildPoseExplanation(
  asana: Asana,
  level: Difficulty = "Intermediate",
): PoseExplanationContent {
  const key =
    level === "Beginner"
      ? "beginner"
      : level === "Advanced"
        ? "advanced"
        : "intermediate";

  const primary = asana.variations[key];
  const beginner = asana.variations.beginner;
  const intermediate = asana.variations.intermediate;

  const rawForm = uniq([
    ...(primary.cues.length ? primary.cues : intermediate.cues),
    ...(!primary.cues.length && !intermediate.cues.length ? beginner.cues : []),
  ]);
  const formCues = formCuesFromCatalog(asana, rawForm, level);

  const alignmentTips = uniq([
    ...asana.steps
      .map((s) => s.text)
      .filter((t) => t.length > 0 && t.length < 140)
      .slice(0, 4),
    ...(isPlaceholderCues(beginner.cues) ? [] : beginner.cues.slice(0, 2)),
  ]).slice(0, 4);

  const watchOuts = uniqLoose([
    ...asana.avoidIf
      .filter((r) => r.severity === "modify" || r.severity === "caution")
      .map((r) => r.condition),
    ...asana.contraindications.slice(0, 2),
    asana.modifications ? `Option: ${asana.modifications}` : "",
  ]).slice(0, 5);

  const feelIt = uniq(
    asana.stretchZones
      .filter((z) => z.primary)
      .map((z) => `${z.region} — ${z.sensation}`),
  ).slice(0, 4);

  return {
    formCues:
      formCues.length > 0
        ? formCues
        : coachingCuesFor(asana, level),
    breathCue: asana.breathing,
    alignmentTips:
      alignmentTips.length > 0
        ? alignmentTips
        : asana.steps.slice(0, 3).map((s) => s.text),
    watchOuts:
      watchOuts.length > 0
        ? watchOuts
        : ["Move within a comfortable range — never force the pose."],
    feelIt:
      feelIt.length > 0
        ? feelIt
        : asana.benefits.slice(0, 3),
    modification: asana.modifications,
  };
}

/** Short rotating cues suitable for the guided-session hold phase. */
export function practiceHoldCues(asana: Asana): string[] {
  const expl = buildPoseExplanation(asana);
  return uniq([
    ...expl.formCues.slice(0, 3),
    expl.breathCue,
    "Soften the face…",
    "Stay present…",
  ]).slice(0, 6);
}
