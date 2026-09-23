/**
 * What a practice actually asks you to fetch before you start.
 *
 * The catalog has no `equipment` field, and authoring one pose by pose would
 * be a second source of truth that drifts from the instructions. So this reads
 * the instructions themselves, against a closed vocabulary, and decides from
 * *how the sentence is written* whether the prop is a prerequisite or an offer:
 *
 *   "Sit beside a chair, then lie back and swing the calves onto the seat."
 *       → required. There is no version of that step without a chair.
 *   "Hold the shins, feet, or a strap."
 *       → optional. The strap is the third of three ways to do the same thing.
 *   "…sitting between the heels on a block if needed."
 *       → optional, said outright.
 *   "Kneel and place a bolster or stack of pillows lengthwise."
 *       → required, but either prop satisfies it: one choice, two options.
 *
 * Props named only in `summary` or `modifications` are always optional — that
 * is where the catalog puts its "or place a folded blanket under the hips".
 *
 * "Mat" and "floor" are deliberately outside the vocabulary: the product never
 * requires a mat, and printing "you'll need a floor" helps nobody. Capitalised
 * pose names are excluded too, so "into Chair Pose" does not ask for furniture
 * while "against a wall" in Legs Up the Wall still does.
 */
import type { Asana } from "@/data/content";

export type EquipmentId =
  | "bolster"
  | "pillow"
  | "blanket"
  | "block"
  | "strap"
  | "chair"
  | "wall"
  | "towel"
  | "table";

export type EquipmentItem = {
  id: EquipmentId;
  /** Singular consumer label, e.g. "a chair". */
  label: string;
  /** Bare noun for lists, e.g. "chair". */
  noun: string;
};

const VOCABULARY: Array<EquipmentItem & { pattern: RegExp }> = [
  { id: "bolster", label: "a bolster", noun: "bolster", pattern: /\bbolsters?\b/gi },
  { id: "pillow", label: "a pillow", noun: "pillow", pattern: /\b(?:pillows?|cushions?)\b/gi },
  { id: "blanket", label: "a blanket", noun: "blanket", pattern: /\bblankets?\b/gi },
  { id: "block", label: "a block", noun: "block", pattern: /\bblocks?\b/gi },
  { id: "strap", label: "a strap", noun: "strap", pattern: /\b(?:straps?|belts?)\b/gi },
  { id: "chair", label: "a chair", noun: "chair", pattern: /\bchairs?\b/gi },
  { id: "wall", label: "a clear wall", noun: "wall", pattern: /\bwall\b/gi },
  { id: "towel", label: "a towel", noun: "towel", pattern: /\btowels?\b/gi },
  { id: "table", label: "a table", noun: "table", pattern: /\btables?\b/gi },
];

export const EQUIPMENT_BY_ID: Record<EquipmentId, EquipmentItem> = Object.fromEntries(
  VOCABULARY.map(({ pattern: _pattern, ...item }) => [item.id, item]),
) as Record<EquipmentId, EquipmentItem>;

const EQUIPMENT_ORDER: EquipmentId[] = VOCABULARY.map((v) => v.id);

/**
 * Phrases that mark a prop as an offer wherever they appear in the sentence.
 *
 * "if" in any conditional form counts: "onto a block if the hips do not reach
 * the floor" is a contingency, not a shopping list.
 */
const OPTIONAL_MARKERS =
  /\b(if\s|optional(ly)?|as needed|can use|when you need|where needed)\b/i;

/**
 * A prop named as a simile or a shape, not as an object to fetch.
 *
 * Chair Pose is "sitting back as if into a chair" and Eagle Pose sinks "into a
 * soft chair position" — neither needs furniture, and the preflight told people
 * to go and find some.
 */
const FIGURATIVE = /\b(as if|like a|as though)\b[^.;]*$|^[^.;]*\b(position|shape|pose)\b/i;

/** A named pose ("Chair Pose", "Wall Splits") is not a prop request. */
function isPoseName(sentence: string, at: number, matched: string): boolean {
  const after = sentence.slice(at + matched.length, at + matched.length + 8);
  if (/^\s+Pose\b/.test(after)) return true;
  const before = sentence.slice(Math.max(0, at - 12), at);
  return /\b(into|in)\s+$/i.test(before) && /^[A-Z]/.test(matched);
}

type Hit = { id: EquipmentId; at: number; matched: string };

function hitsIn(sentence: string): Hit[] {
  const hits: Hit[] = [];
  for (const entry of VOCABULARY) {
    entry.pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = entry.pattern.exec(sentence))) {
      if (!isPoseName(sentence, m.index, m[0]) && !isFigurative(sentence, m.index)) {
        hits.push({ id: entry.id, at: m.index, matched: m[0] });
      }
    }
  }
  return hits.sort((a, b) => a.at - b.at);
}

/** One thing you must have, satisfiable by any of `options`. */
export type EquipmentChoice = { options: EquipmentId[] };

export type PoseEquipment = {
  slug: string;
  required: EquipmentChoice[];
  optional: EquipmentId[];
};

/**
 * True when the prop at `at` is introduced as an alternative — either the
 * sentence says so outright, or something else was offered before it ("hold
 * the shins, feet, or a strap"; "on the mat or a thin pillow").
 */
function isOfferedAlternative(sentence: string, at: number): boolean {
  if (OPTIONAL_MARKERS.test(sentence)) return true;
  // The floor is always available, so a sentence that offers it as one of the
  // options is offering all of them: "hand to shin, block, or floor".
  if (offersFloorInstead(sentence)) return true;
  const before = sentence.slice(0, at);
  if (/\bor\b[^.;]*$/i.test(before)) return true;
  // A comma-list that ends in "or <something>" makes every item in it a choice,
  // even the ones that come before the "or".
  const after = sentence.slice(at);
  return /^[^.;]*,[^.;]*\bor\b/i.test(after) && /,/.test(before);
}

/** A step sentence that names the floor as an alternative is an offer, not a rule. */
function offersFloorInstead(sentence: string): boolean {
  return /\bfloor\b/i.test(sentence) && /\bor\b/i.test(sentence);
}

/** Is this mention a simile rather than a request for an object? */
function isFigurative(sentence: string, at: number): boolean {
  return FIGURATIVE.test(sentence.slice(0, at + 1));
}

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.;])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function poseEquipment(asana: Asana): PoseEquipment {
  const required: EquipmentChoice[] = [];
  const optional = new Set<EquipmentId>();

  for (const step of asana.steps) {
    for (const sentence of sentencesOf(step.text)) {
      const hits = hitsIn(sentence);
      if (!hits.length) continue;
      const first = hits[0]!;
      if (isOfferedAlternative(sentence, first.at)) {
        hits.forEach((h) => optional.add(h.id));
        continue;
      }
      // The first prop is a prerequisite; anything "or"-ed onto it in the same
      // sentence is another way to satisfy the same requirement.
      const options: EquipmentId[] = [];
      for (const h of hits) if (!options.includes(h.id)) options.push(h.id);
      required.push({ options });
    }
  }

  for (const sentence of sentencesOf([asana.summary, asana.modifications].join(" "))) {
    for (const h of hitsIn(sentence)) optional.add(h.id);
  }

  const merged = mergeOverlapping(dedupeChoices(required));
  const requiredIds = new Set(merged.flatMap((c) => c.options));
  return {
    slug: asana.slug,
    required: merged,
    optional: EQUIPMENT_ORDER.filter((id) => optional.has(id) && !requiredIds.has(id)),
  };
}

function dedupeChoices(choices: EquipmentChoice[]): EquipmentChoice[] {
  const seen = new Set<string>();
  const out: EquipmentChoice[] = [];
  for (const c of choices) {
    const key = [...c.options].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/**
 * Within one pose, overlapping choices are the same object mentioned twice —
 * Supported Child's Pose asks for "a bolster or stack of pillows" in step one
 * and then says "arms can wrap the bolster". Reading that as two requirements
 * would tell someone holding two pillows they are missing a bolster.
 */
function mergeOverlapping(choices: EquipmentChoice[]): EquipmentChoice[] {
  const out: EquipmentChoice[] = [];
  for (const c of choices) {
    const hit = out.find((o) => o.options.some((id) => c.options.includes(id)));
    if (!hit) {
      out.push({ options: [...c.options] });
      continue;
    }
    for (const id of c.options) if (!hit.options.includes(id)) hit.options.push(id);
  }
  return out;
}

/**
 * Across poses, a choice that is a superset of another is already paid for:
 * if one pose insists on a pillow and another accepts "a bolster or a pillow",
 * the pillow covers both. Keeping the wider one would send the practitioner
 * looking for a bolster they do not need.
 */
function dropCoveredChoices(choices: EquipmentChoice[]): EquipmentChoice[] {
  // Called after dedupeChoices, so no two choices have the same option set and
  // "covered" means strictly narrower.
  const isStrictSubset = (a: EquipmentChoice, b: EquipmentChoice) =>
    a.options.length < b.options.length && a.options.every((id) => b.options.includes(id));
  return choices.filter((c) => !choices.some((other) => isStrictSubset(other, c)));
}

export type SessionEquipment = {
  /** Every distinct thing to fetch, in vocabulary order. */
  required: EquipmentChoice[];
  optional: EquipmentItem[];
  /** Poses that cannot be practised as written without a prop. */
  requiredBy: Array<{ slug: string; english: string; choices: EquipmentChoice[] }>;
};

export function sessionEquipment(poses: Asana[]): SessionEquipment {
  const required: EquipmentChoice[] = [];
  const optional = new Set<EquipmentId>();
  const requiredBy: SessionEquipment["requiredBy"] = [];

  for (const asana of poses) {
    const eq = poseEquipment(asana);
    if (eq.required.length) {
      requiredBy.push({ slug: asana.slug, english: asana.english, choices: eq.required });
    }
    required.push(...eq.required);
    eq.optional.forEach((id) => optional.add(id));
  }
  const merged = dropCoveredChoices(dedupeChoices(required)).sort(
    (a, b) => EQUIPMENT_ORDER.indexOf(a.options[0]!) - EQUIPMENT_ORDER.indexOf(b.options[0]!),
  );
  const requiredIds = new Set(merged.flatMap((c) => c.options));
  return {
    required: merged,
    optional: EQUIPMENT_ORDER.filter((id) => optional.has(id) && !requiredIds.has(id)).map(
      (id) => EQUIPMENT_BY_ID[id],
    ),
    requiredBy,
  };
}

/** "a bolster (or a pillow)" — one line per thing to fetch. */
export function choiceLabel(choice: EquipmentChoice): string {
  const [first, ...rest] = choice.options.map((id) => EQUIPMENT_BY_ID[id].label);
  if (!first) return "";
  if (!rest.length) return first;
  return `${first} (or ${rest.join(" or ")})`;
}

/** "a chair and a bolster (or a pillow)". Empty string when nothing is needed. */
export function equipmentSentence(choices: EquipmentChoice[]): string {
  const labels = choices.map(choiceLabel).filter(Boolean);
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0]!;
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export function equipmentNouns(items: EquipmentItem[]): string {
  const labels = items.map((i) => i.label);
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0]!;
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/**
 * Prop-free stand-ins, reviewed pair by pair.
 *
 * Deliberately a short hand-checked table rather than "find a similar pose
 * with no props": swapping Legs on a Chair for an arbitrary Restorative shape
 * would change what the practice does. Each row is the same intent delivered
 * without the prop, and the note is shown to the practitioner so the trade is
 * visible. Add a row only after reading both poses' instructions.
 */
export const EQUIPMENT_FREE_SWAPS: Record<string, { slug: string; note: string }> = {
  "salamba-balasana": {
    slug: "balasana",
    note: "Child's Pose without the bolster — forehead to the floor instead of onto support.",
  },
  "chair-viparita-karani": {
    slug: "viparita-karani",
    note: "Legs up a wall instead of onto a chair seat. You still need clear wall space.",
  },
  "chair-forward-fold": {
    slug: "uttanasana",
    note: "Standing forward fold with soft knees instead of folding over a chair.",
  },
  "salamba-matsyasana": {
    slug: "matsyasana",
    note: "Fish Pose on the floor, resting on the forearms instead of over a bolster.",
  },
};

export function equipmentFreeSwapFor(slug: string): { slug: string; note: string } | null {
  return EQUIPMENT_FREE_SWAPS[slug] ?? null;
}
