// Client-side Yoga Trainer composer — builds a safe, personalized sequence
// from today's check-in without needing an LLM or network.

import { ASANAS, asanaBySlug, type Asana } from "@/data/content";

/** Which audience the active profile targets — gates audience-specific poses/copy. */
export type TrainerAudience = "All" | "Men" | "Women" | "Pregnancy";

export type TrainerCheckIn = {
  body: string[];
  soreParts: string[];
  energy: string;
  timeMinutes: number;
  need: string;
};

export type TrainerPose = {
  slug: string;
  holdSeconds: number;
  sides: "once" | "each";
  why: string;
};

export type TrainerSession = {
  reasoning: string;
  poses: TrainerPose[];
  totalMinutes: number;
  /** What the practitioner asked for (a NEED_OPTIONS id). */
  requestedNeed: string;
  /**
   * What the sequence actually delivers. Equals `requestedNeed` unless safety
   * filtering left too little of the requested focus to honestly claim it.
   */
  deliveredNeed: string;
  /**
   * Plain-language notes about anything we changed and why. Empty when the
   * request was honored as asked. The UI must surface these — silently
   * returning the opposite of what was asked is never acceptable.
   */
  adjustments: string[];
};

export const SEQUENCES: Record<string, string[]> = {
  calm: ["sukhasana", "balasana", "paschimottanasana", "supta-matsyendrasana", "viparita-karani", "constructive-rest", "savasana"],
  energy: ["urdhva-hastasana", "tadasana", "eka-pada-adho-mukha-svanasana", "high-lunge", "baddha-virabhadrasana", "virabhadrasana-i", "camatkarasana", "adho-mukha-svanasana", "balasana", "savasana"],
  flexibility: ["marjaryasana-bitilasana", "anjaneyasana", "ardha-hanumanasana", "supta-kapotasana", "paschimottanasana", "parivrtta-paschimottanasana", "parivrtta-upavistha-konasana", "balasana", "savasana"],
  sleep: ["salamba-balasana", "pawanmuktasana", "jathara-parivartanasana", "salamba-setu-bandhasana", "chair-viparita-karani", "constructive-rest", "parsva-savasana"],
  focus: ["sukhasana", "vajrasana", "vrksasana", "garudasana", "parivrtta-hasta-padangusthasana", "balasana", "savasana"],
  movement: ["tadasana", "urdhva-hastasana", "ardha-uttanasana", "adho-mukha-svanasana", "anjaneyasana", "baddha-parsvakonasana", "trikonasana", "balasana", "savasana"],
  strength: ["tadasana", "utkatasana", "virabhadrasana-ii", "kumbhakasana", "uttana-padasana", "ardha-navasana", "ardha-pincha-mayurasana", "navasana", "balasana", "savasana"],
};

const EACH_SIDE = new Set([
  "virabhadrasana-i",
  "virabhadrasana-ii",
  "anjaneyasana",
  "high-lunge",
  "ardha-hanumanasana",
  "eka-pada-rajakapotasana",
  "utthan-pristhasana",
  "marichyasana-twist",
  "parsvottanasana",
  "trikonasana",
  "ardha-chandrasana",
  "supta-kapotasana",
  "supta-matsyendrasana",
  "supta-gomukhasana",
  "vasisthasana",
  "vrksasana",
  "garudasana",
  "parivrtta-utkatasana",
  "parivrtta-anjaneyasana",
  "baddha-virabhadrasana",
  "baddha-parsvakonasana",
  "parivrtta-hasta-padangusthasana",
  "parivrtta-paschimottanasana",
  "jathara-parivartanasana",
  "galavasana",
  "eka-pada-bakasana",
  "marichyasana-a",
  "eka-pada-adho-mukha-svanasana",
  "parsva-uttanasana",
  "parivrtta-upavistha-konasana",
  "camatkarasana",
  "standing-figure-four",
  "runner-lunge-twist",
  "couch-hip-flexor",
  "standing-side-stretch",
  "twisted-lizard",
  "kneeling-thoracic-opener",
  "wall-chest-opener",
  "banana-pose",
  "mermaid-pose",
  "deer-pose",
  "swan-pose",
  "seated-side-bend",
  "wall-calf-stretch",
  "ninety-ninety-hip",
  "half-kneeling-hamstring",
  "side-lying-stretch",
]);

const GENTLE = new Set([
  "balasana",
  "savasana",
  "viparita-karani",
  "constructive-rest",
  "chair-viparita-karani",
  "sukhasana",
  "vajrasana",
  "supta-baddha-konasana",
  "salamba-balasana",
  "parsva-savasana",
  "pawanmuktasana",
  "setu-bandhasana",
  "makarasana",
  "shashankasana",
]);

/**
 * Shapes that put substantial load through a joint or the spine. An injury
 * report drops these regardless of which region was named, because "Injured"
 * with no region is the least-information case and deserves the widest berth.
 */
const HIGH_LOAD = new Set([
  "sirsasana",
  "sarvangasana",
  "halasana",
  "pincha-mayurasana",
  "vrischikasana",
  "adho-mukha-vrksasana",
  "bakasana",
  "eka-pada-bakasana",
  "galavasana",
  "mayurasana",
  "urdhva-dhanurasana",
  "hanumanasana",
  "samakonasana",
  "chaturanga-dandasana",
  "vasisthasana",
  "camatkarasana",
  "ustrasana",
  "rajakapotasana",
  "eka-pada-rajakapotasana",
  "dhanurasana",
  "navasana",
  "ardha-pincha-mayurasana",
]);

/** Closing / integration shapes — they end a practice, they don't define it. */
const CLOSERS = new Set([
  "savasana",
  "parsva-savasana",
  "constructive-rest",
  "viparita-karani",
  "chair-viparita-karani",
  "balasana",
  "salamba-balasana",
]);

/**
 * Poses whose framing is audience-specific. They are physically fine for
 * anyone, but their "best for" copy is written for one audience — so we only
 * offer them (and their copy) to that audience unless nothing else fits.
 */
const AUDIENCE_SPECIFIC: Record<string, TrainerAudience> = {
  "parsva-savasana": "Pregnancy",
  "salamba-matsyasana": "Pregnancy",
};

/** Copy that must never be shown to an audience it wasn't written for. */
const AUDIENCE_COPY_PATTERNS: Record<Exclude<TrainerAudience, "All">, RegExp> = {
  Pregnancy: /pregnan|prenatal|postpartum|trimester/i,
  Women: /menstrua|menopaus|period/i,
  Men: /\bmen only\b/i,
};

/** Region-specific exclusions. Deliberately generous — a missed contraindication
 * costs a user an injury; an over-filtered session costs them one pose. */
const REGION_EXCLUSIONS: Record<string, string[]> = {
  "Lower back": [
    "urdhva-dhanurasana", "ustrasana", "mayurasana", "adho-mukha-vrksasana",
    "navasana", "ardha-navasana", "uttana-padasana", "halasana", "dhanurasana",
    "salabhasana", "paschimottanasana", "parivrtta-paschimottanasana",
    "uttanasana", "jathara-parivartanasana", "sirsasana", "sarvangasana",
  ],
  "Upper back": [
    "urdhva-dhanurasana", "ustrasana", "mayurasana", "adho-mukha-vrksasana",
    "halasana", "sarvangasana", "sirsasana", "pincha-mayurasana",
  ],
  Hamstrings: [
    "hanumanasana", "paschimottanasana", "uttanasana", "ardha-hanumanasana",
    "padangusthasana", "parivrtta-paschimottanasana", "half-kneeling-hamstring",
    "parivrtta-upavistha-konasana", "samakonasana",
  ],
  Hips: [
    "eka-pada-rajakapotasana", "utthan-pristhasana", "rajakapotasana",
    "samakonasana", "twisted-lizard", "malasana", "supta-kapotasana",
    "ninety-ninety-hip", "deer-pose", "swan-pose",
  ],
  Knees: [
    "virabhadrasana-i", "anjaneyasana", "high-lunge", "utthan-pristhasana",
    "utkatasana", "padmasana", "malasana", "vajrasana", "parivrtta-utkatasana",
    "parivrtta-anjaneyasana", "twisted-lizard", "deer-pose",
  ],
  Wrists: [
    "adho-mukha-svanasana", "urdhva-dhanurasana", "bakasana", "mayurasana",
    "kumbhakasana", "chaturanga-dandasana", "vasisthasana", "camatkarasana",
    "adho-mukha-vrksasana", "eka-pada-adho-mukha-svanasana", "galavasana",
    "eka-pada-bakasana", "marjaryasana-bitilasana",
  ],
  Neck: [
    "sirsasana", "halasana", "sarvangasana", "pincha-mayurasana",
    "vrischikasana", "ardha-pincha-mayurasana", "matsyasana",
  ],
  Shoulders: [
    "adho-mukha-vrksasana", "pincha-mayurasana", "vrischikasana",
    "chaturanga-dandasana", "vasisthasana", "camatkarasana", "bakasana",
    "supta-gomukhasana", "garudasana",
  ],
};

function hasSlug(slug: string): boolean {
  return !!asanaBySlug(slug);
}

/** True when this pose is written for a different audience than the active one. */
function isWrongAudience(slug: string, audience: TrainerAudience): boolean {
  const tagged = AUDIENCE_SPECIFIC[slug];
  return !!tagged && tagged !== audience;
}

const PREGNANCY_RE = /pregnan|trimester|prenatal/i;

/**
 * Pregnancy is the one audience where the catalog's own contraindications are
 * an audience rule rather than an injury rule, so enforce it explicitly.
 *
 * The catalog uses the same word for two very different things — "Pregnancy"
 * (don't) and "Pregnancy (widen the knees)" (do, like this). Treating both as
 * prohibitions strips every closing pose out of a prenatal session, so we
 * exclude only genuine prohibitions and let modifications through.
 */
function unsafeForAudience(asana: Asana, audience: TrainerAudience): boolean {
  if (audience !== "Pregnancy") return false;

  // Head-below-heart inversions are standard prenatal "skip", catalog or not.
  if (asana.category === "Inversions") return true;

  const rows = asana.avoidIf.filter((a) => PREGNANCY_RE.test(a.condition));
  if (rows.some((a) => a.severity === "avoid")) return true;
  // A structured modify/caution row means the pose is usable with adjustment.
  if (rows.length > 0) return false;

  // No structured row: fall back to the flat list. A bare mention with no
  // "(do it this way)" parenthetical is a prohibition.
  return asana.contraindications.some(
    (c) => PREGNANCY_RE.test(c) && !/\(.*\)/.test(c),
  );
}

/** A rationale line that is safe to show this audience. */
function whyFor(asana: Asana, audience: TrainerAudience): string {
  const banned = Object.entries(AUDIENCE_COPY_PATTERNS)
    .filter(([aud]) => aud !== audience)
    .map(([, re]) => re);
  const ok = (line: string) => !banned.some((re) => re.test(line));
  const candidate = [...asana.bestFor, ...asana.benefits].find(ok);
  if (candidate) return candidate;
  return CLOSERS.has(asana.slug)
    ? "Rest and integrate."
    : "A steady, supportive shape for today.";
}

function isContraindicated(
  asana: Asana,
  soreParts: string[],
  injured: boolean,
  audience: TrainerAudience = "All",
): boolean {
  if (unsafeForAudience(asana, audience)) return true;

  // An injury lowers the ceiling — it does not replace the practice.
  if (injured) {
    if (asana.difficulty === "Advanced" && !GENTLE.has(asana.slug)) return true;
    if (HIGH_LOAD.has(asana.slug)) return true;
    // "Injured" with no region named: we don't know what's hurt, so also drop
    // Intermediate shapes and keep only accessible ones.
    if (soreParts.length === 0 && asana.difficulty === "Intermediate" && !GENTLE.has(asana.slug)) {
      return true;
    }
  }

  const parts = new Set(soreParts);
  for (const part of parts) {
    if ((REGION_EXCLUSIONS[part] ?? []).includes(asana.slug)) return true;
  }

  const haystack = [
    ...asana.contraindications,
    ...asana.avoidIf.map((a) => a.condition),
  ]
    .join(" | ")
    .toLowerCase();

  const keywordMap: Record<string, string[]> = {
    "Lower back": ["back", "spine", "disc"],
    "Upper back": ["back", "shoulder"],
    Hamstrings: ["hamstring"],
    Hips: ["hip"],
    Knees: ["knee"],
    Wrists: ["wrist", "carpal"],
    Neck: ["neck", "cervical"],
    Shoulders: ["shoulder"],
  };
  for (const part of soreParts) {
    for (const kw of keywordMap[part] ?? [part.toLowerCase()]) {
      if (haystack.includes(kw) && asana.avoidIf.some((a) => a.severity === "avoid")) {
        return true;
      }
    }
  }
  return false;
}

function estimatedMinutes(poses: TrainerPose[]): number {
  const secs = poses.reduce(
    (sum, p) => sum + p.holdSeconds * (p.sides === "each" ? 2 : 1),
    0,
  );
  return Math.max(1, Math.round(secs / 60));
}

/**
 * Extra poses, per need, used to rebuild a session after safety filtering.
 * Backfilling from a restorative-only pool was how a "Strength" request used to
 * turn into a sleep flow — the pool must match what was asked for.
 */
const BACKFILL: Record<string, string[]> = {
  calm: ["sukhasana", "marjaryasana-bitilasana", "supta-baddha-konasana", "balasana", "viparita-karani"],
  energy: ["tadasana", "urdhva-hastasana", "virabhadrasana-ii", "trikonasana", "high-lunge"],
  flexibility: ["marjaryasana-bitilasana", "anjaneyasana", "seated-side-bend", "supta-gomukhasana", "banana-pose"],
  sleep: ["salamba-balasana", "constructive-rest", "pawanmuktasana", "viparita-karani", "supta-baddha-konasana"],
  focus: ["sukhasana", "tadasana", "vrksasana", "garudasana", "vajrasana"],
  movement: ["tadasana", "marjaryasana-bitilasana", "urdhva-hastasana", "trikonasana", "anjaneyasana"],
  strength: ["tadasana", "utkatasana", "virabhadrasana-ii", "kumbhakasana", "ardha-navasana", "setu-bandhasana", "salabhasana"],
};

/** Last-resort pool when a need-specific backfill can't produce a real session. */
const SAFE_POOL = [
  "sukhasana",
  "balasana",
  "marjaryasana-bitilasana",
  "constructive-rest",
  "viparita-karani",
  "savasana",
];

/** Self-reported experience — caps how long a demanding shape may be held. */
export type TrainerExperience = "new" | "some" | "regular";

/**
 * Per-pose hold ceilings, in seconds.
 *
 * Dividing the session length evenly across poses produced a 2m30s Plank and a
 * 2m30s Chair Pose in a 30-minute strength session — instructions no beginner
 * should be given and no experienced practitioner would follow. Load-bearing
 * shapes have a hard ceiling; only restorative shapes absorb leftover time.
 */
const HOLD_LIMITS: Record<string, { min: number; max: number }> = {
  isometric: { min: 20, max: 60 }, // plank, chair, boat — the ones that hurt people
  standing: { min: 20, max: 75 },
  balance: { min: 15, max: 45 },
  default: { min: 20, max: 120 },
  seated: { min: 30, max: 180 },
  restorative: { min: 45, max: 300 },
};

/** Shapes held under real muscular load. Ceiling applies no matter the maths. */
const ISOMETRIC = new Set([
  "kumbhakasana",
  "chaturanga-dandasana",
  "utkatasana",
  "parivrtta-utkatasana",
  "navasana",
  "ardha-navasana",
  "uttana-padasana",
  "vasisthasana",
  "ardha-pincha-mayurasana",
  "dolphin-plank",
  "salabhasana",
  "virabhadrasana-i",
  "virabhadrasana-ii",
  "baddha-virabhadrasana",
  "high-lunge",
  "ardha-chandrasana",
  "adho-mukha-svanasana",
]);

const BALANCE = new Set([
  "vrksasana",
  "garudasana",
  "parivrtta-hasta-padangusthasana",
  "standing-figure-four",
]);

/** How much of the ceiling a practitioner at each level should be given. */
const EXPERIENCE_SCALE: Record<TrainerExperience, number> = {
  new: 0.6,
  some: 0.8,
  regular: 1,
};

function holdLimitsFor(slug: string, pose: Asana, experience: TrainerExperience) {
  // Only a genuine closing shape gets the long band. Keying this off
  // `category === "Restorative"` handed Cat-Cow — a flowing spinal warm-up the
  // catalog files as Restorative — a five-minute static hold.
  const band = CLOSERS.has(slug)
    ? HOLD_LIMITS.restorative
    : ISOMETRIC.has(slug)
      ? HOLD_LIMITS.isometric
      : BALANCE.has(slug)
        ? HOLD_LIMITS.balance
        : pose.category === "Standing"
          ? HOLD_LIMITS.standing
          : pose.category === "Seated"
            ? HOLD_LIMITS.seated
            : HOLD_LIMITS.default;

  // Experience scales effort, not rest. A beginner holding Plank for half as
  // long is right; a beginner allowed only half a Savasana is just a worse
  // session — and it was quietly halving the length of every long practice.
  const scale = band === HOLD_LIMITS.restorative ? 1 : (EXPERIENCE_SCALE[experience] ?? 1);
  const max = Math.max(band.min, Math.round((band.max * scale) / 5) * 5);
  return { min: band.min, max };
}

/**
 * Order a set of poses into warm-up → peak → cool-down.
 *
 * The reasoning copy promises the sequence "closes in rest"; before this, the
 * final pose of a strength session was Plank. Now the promise is enforced by
 * construction rather than asserted in a string.
 */
function arcRank(s: string): number {
  const pose = asanaBySlug(s);
  if (!pose) return 2;
  // CLOSERS — not `category === "Restorative"` — decides what ends a session.
  // The catalog files Cat-Cow as Restorative, and sorting on category put a
  // spinal warm-up after Savasana.
  if (CLOSERS.has(s)) return 4; // cool-down
  if (ISOMETRIC.has(s) || HIGH_LOAD.has(s) || pose.difficulty === "Advanced") return 3; // peak
  if (GENTLE.has(s) || pose.category === "Restorative") return 0; // warm-up / mobilise
  if (pose.category === "Seated") return 0;
  if (pose.category === "Standing") return 1;
  return 2;
}

function arcOrder(slugs: string[]): string[] {
  // Order of these checks is the whole algorithm. Testing "Seated" before
  // "isometric" filed Boat Pose as a warm-up and opened a strength session on
  // three core holds — a category is not a proxy for effort.
  // Warm-up first, peak in the middle, rest last; stable within each band so
  // the sequence's own authored order still shows through.
  return slugs
    .map((s, i) => ({ s, i, r: arcRank(s) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.s);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/**
 * Pick a different subset/order inside each arc bucket. Closers stay at the
 * end (at most two). Used by Adaptive "Regenerate" so the control is not a no-op.
 */
function pickVariantSlugs(slugs: string[], target: number, variant: number): string[] {
  const buckets: string[][] = [[], [], [], [], []];
  for (const s of slugs) {
    buckets[arcRank(s)]!.push(s);
  }
  const mixed = [0, 1, 2, 3].map((r) => shuffled(buckets[r]!, variant * 11 + r + 3));
  const closers = shuffled(buckets[4]!, variant * 11 + 9).slice(0, 2);
  const workingNeed = Math.max(3, target - closers.length);
  const working: string[] = [];
  for (const s of mixed.flat()) {
    if (working.length >= workingNeed) break;
    if (!working.includes(s)) working.push(s);
  }
  return [...working, ...closers.filter((s) => !working.includes(s))];
}

/** Minimum number of on-theme working poses before we'll claim a focus. */
const MIN_SIGNATURE_POSES = 2;

/** Needs where a vigorous pose is off-theme no matter how safe it is. */
const RESTFUL_NEEDS = new Set(["sleep", "calm"]);

/** The honest fallback when almost nothing on-theme is safe. */
const RESTORATIVE_POOL = [
  "salamba-balasana",
  "supta-baddha-konasana",
  "constructive-rest",
  "chair-viparita-karani",
  "viparita-karani",
  "sukhasana",
  "savasana",
];

/** Compose a personalized practice from the trainer check-in. */
export function composeTrainerSession(
  c: TrainerCheckIn,
  opts?: {
    preferSlugs?: string[];
    audience?: TrainerAudience;
    experience?: TrainerExperience;
    /** 0 = stable authored order. >0 reshuffles within warm-up / peak / cool-down. */
    variant?: number;
  },
): TrainerSession {
  const injured = c.body.some((b) => b.toLowerCase().includes("injured"));
  const audience = opts?.audience ?? "All";
  // Default to the most conservative reading — an unknown practitioner is
  // treated as new, not as an athlete.
  const experience = opts?.experience ?? "new";
  const requestedNeed = (c.need || "movement").toLowerCase();
  const key = SEQUENCES[requestedNeed] ? requestedNeed : "movement";
  const lowEnergy = /exhausted|tired|low/i.test(c.energy);
  const adjustments: string[] = [];

  const prefer = (opts?.preferSlugs ?? []).filter(hasSlug);

  const safe = (s: string): boolean => {
    const pose = asanaBySlug(s);
    if (!pose) return false;
    if (isWrongAudience(s, audience)) return false;
    if (isContraindicated(pose, c.soreParts, injured, audience)) return false;
    // Low energy caps intensity but must not change the focus.
    if (lowEnergy && pose.difficulty === "Advanced" && !GENTLE.has(s)) return false;
    return true;
  };

  // Start from what was actually asked for. Always. An injury changes which
  // poses survive the safety filter below; it never changes the request.
  const requested = [...(SEQUENCES[key] ?? SEQUENCES.movement)].filter(hasSlug);

  // Active profile poses are a flavour, not the plan: they are only woven in
  // when they suit the requested focus, they are capped, and they never lead.
  let slugs = requested;
  const compatiblePrefer = prefer.filter((s) => {
    if (CLOSERS.has(s)) return false;
    if (requested.includes(s)) return false;
    if (!RESTFUL_NEEDS.has(key)) return true;
    const pose = asanaBySlug(s);
    return !!pose && (GENTLE.has(s) || pose.category === "Restorative" || pose.category === "Seated");
  });
  if (compatiblePrefer.length > 0) {
    const mixed: string[] = requested.length > 0 ? [requested[0]] : [];
    const rest = requested.slice(mixed.length);
    const maxPrefer = Math.min(3, compatiblePrefer.length);
    for (let i = 0; i < Math.max(rest.length, maxPrefer); i++) {
      if (i < maxPrefer) mixed.push(compatiblePrefer[i]);
      if (i < rest.length) mixed.push(rest[i]);
    }
    slugs = mixed;
  }

  const beforeSafety = new Set(slugs);
  slugs = slugs.filter(safe);
  const droppedCount = beforeSafety.size - new Set(slugs).size;

  if (droppedCount > 0) {
    if (injured && c.soreParts.length > 0) {
      adjustments.push(
        `Left out ${droppedCount} pose${droppedCount === 1 ? "" : "s"} that load your ${c.soreParts.join(" and ").toLowerCase()}.`,
      );
    } else if (injured) {
      adjustments.push(
        `Kept the intensity low and left out ${droppedCount} pose${droppedCount === 1 ? "" : "s"} — you didn't say where the injury is, so I stayed conservative.`,
      );
    } else if (c.soreParts.length > 0) {
      adjustments.push(
        `Swapped out ${droppedCount} pose${droppedCount === 1 ? "" : "s"} to protect your ${c.soreParts.join(" and ").toLowerCase()}.`,
      );
    }
  }

  /**
   * How many poses this session needs.
   *
   * Fixed at 6–8 before, which is why a 30-minute request either produced
   * 2m30s planks (dividing the time across too few poses) or, once holds were
   * capped, a 5-minute session. Longer sessions need MORE poses, not longer
   * holds — that is what a longer class actually is.
   */
  const targetPoseCount = Math.max(
    6,
    Math.min(16, Math.round((Math.max(5, c.timeMinutes) * 60) / 90)),
  );

  const variant = opts?.variant ?? 0;
  const fillCap = targetPoseCount + (variant > 0 ? 8 : 0);
  const fillPools = [BACKFILL[key] ?? [], SEQUENCES[key] ?? [], SAFE_POOL].map((pool, i) =>
    variant > 0 ? shuffled(pool, variant * 17 + i + 1) : pool,
  );

  // Rebuild toward the requested focus first, then fall back to the safe pool.
  for (const pool of fillPools) {
    for (const s of pool) {
      if (slugs.length >= fillCap) break;
      if (!slugs.includes(s) && safe(s)) slugs.push(s);
    }
  }

  slugs = Array.from(new Set(slugs));

  // Low energy: trim length rather than swap the focus out from under them.
  if (lowEnergy) slugs = slugs.slice(0, Math.min(slugs.length, 6));

  if (variant === 0) slugs = slugs.slice(0, targetPoseCount);

  // Did enough of the requested focus survive to honestly call it that?
  const signature = slugs.filter(
    (s) => (SEQUENCES[key] ?? []).includes(s) && !CLOSERS.has(s),
  ).length;
  const deliveredNeed = signature >= MIN_SIGNATURE_POSES ? key : "restorative";
  if (deliveredNeed !== key) {
    // Say "restorative" and mean it — rebuild rather than keeping whatever
    // vigorous leftovers happened to pass the safety filter.
    slugs = slugs.filter((s) => {
      const pose = asanaBySlug(s);
      return !!pose && (GENTLE.has(s) || CLOSERS.has(s) || pose.category === "Restorative");
    });
    for (const s of RESTORATIVE_POOL) {
      if (slugs.length >= 6) break;
      if (!slugs.includes(s) && safe(s)) slugs.push(s);
    }
    slugs = slugs.slice(0, 8);
    adjustments.push(
      `Too little of a ${NEED_LABEL[key] ?? key} practice was safe today, so this is a restorative session instead. Nothing here will aggravate what you reported.`,
    );
  }

  // Warm-up → peak → cool-down, so the promise of "closes in rest" is a fact
  // about the sequence rather than a claim in a sentence.
  const lengthTarget = lowEnergy ? Math.min(6, targetPoseCount) : targetPoseCount;
  slugs = variant > 0 ? pickVariantSlugs(slugs, lengthTarget, variant) : arcOrder(slugs);

  // At most two closing shapes. Filling a long session's leftover time with
  // four consecutive rest poses is technically "closing in rest" and nobody
  // would call it a practice.
  let closersKept = 0;
  slugs = slugs.filter((s) => !CLOSERS.has(s) || ++closersKept <= 2);

  // Guarantee the closer AFTER truncation. Doing it before meant balasana and
  // savasana — last in every authored sequence — were the first things the
  // length cap threw away, and strength sessions ended on Plank.
  if (!slugs.some((s) => CLOSERS.has(s))) {
    const closer = ["savasana", "constructive-rest", "balasana", "parsva-savasana"].find(safe);
    if (closer) {
      if (slugs.length >= targetPoseCount) slugs.pop();
      slugs.push(closer);
    }
  }

  // ---- hold times ---------------------------------------------------------
  // Allocate the target time, then clamp every pose to its own safe band. Time
  // that doesn't fit goes to the restorative shapes that can absorb it — never
  // onto a plank.
  const targetSeconds = Math.max(5, c.timeMinutes) * 60;
  const bands = slugs.map((s) => holdLimitsFor(s, asanaBySlug(s)!, experience));
  const sidesCount = slugs.map((s) => (EACH_SIDE.has(s) ? 2 : 1));
  const weights = slugs.map((s) => (CLOSERS.has(s) ? 1.6 : 1));

  const round5 = (n: number) => Math.round(n / 5) * 5;
  const weightedUnits = weights.reduce((a, w, i) => a + w * sidesCount[i], 0) || 1;
  const perUnit = targetSeconds / weightedUnits;

  const holds = slugs.map((_, i) =>
    Math.min(bands[i].max, Math.max(bands[i].min, round5(perUnit * weights[i]))),
  );

  // Redistribute any shortfall onto poses that still have headroom, restorative
  // first. Overshoot is left alone: finishing early beats an unsafe hold.
  let remaining =
    targetSeconds - holds.reduce((sum, h, i) => sum + h * sidesCount[i], 0);
  if (remaining > 0) {
    const absorbers = slugs
      .map((s, i) => ({ i, restful: CLOSERS.has(s) }))
      .sort((a, b) => Number(b.restful) - Number(a.restful));
    for (const { i } of absorbers) {
      if (remaining <= 0) break;
      const room = bands[i].max - holds[i];
      if (room <= 0) continue;
      const add = round5(Math.min(room, remaining / sidesCount[i]));
      if (add <= 0) continue;
      holds[i] += add;
      remaining -= add * sidesCount[i];
    }
  }

  const poses: TrainerPose[] = slugs.map((s, i) => ({
    slug: s,
    holdSeconds: holds[i],
    sides: EACH_SIDE.has(s) ? "each" : "once",
    why: whyFor(asanaBySlug(s)!, audience),
  }));

  // If safe holds can't fill the requested time, say so rather than quietly
  // handing back a third of what was asked for.
  const actualMinutes = estimatedMinutes(poses);
  if (actualMinutes < c.timeMinutes - 3) {
    adjustments.push(
      `This came out at about ${actualMinutes} minutes rather than ${c.timeMinutes} — there weren't enough safe poses left to fill the time without holding something longer than it should be held.`,
    );
  }

  // Every branch of this sentence has to be a whole sentence. The empty-sore
  // branch used to leave it starting mid-clause and lowercase:
  // "with 30 minutes for strength, I've shaped…"
  const deliveredLabel = (NEED_LABEL[deliveredNeed] ?? deliveredNeed).toLowerCase();
  const reasoning = c.soreParts.length
    ? `Because your ${c.soreParts.join(" and ").toLowerCase()} ${c.soreParts.length > 1 ? "are" : "is"} asking for care, I've shaped ${c.timeMinutes} minutes of ${deliveredLabel} that meets you where you are and closes in rest.`
    : `Here are ${c.timeMinutes} minutes of ${deliveredLabel}, shaped for how you're feeling today and closing in rest.`;

  return {
    reasoning,
    poses,
    totalMinutes: estimatedMinutes(poses),
    requestedNeed: key,
    deliveredNeed,
    adjustments,
  };
}

/**
 * Body answers that contradict each other.
 *
 * The wizard let "Great" and "Injured" be selected together, and let "Nothing
 * specific" sit alongside named complaints — then fed both into a safety
 * filter. Whatever the composer did with that was going to be wrong, so the
 * contradiction is prevented at the input instead of resolved downstream.
 */
export const BODY_EXCLUSIVE = new Set(["Great", "Nothing specific"]);

/** Apply the answer `value` to `current`, enforcing mutual exclusion. */
export function toggleBodyAnswer(current: string[], value: string): string[] {
  if (BODY_EXCLUSIVE.has(value)) {
    // "Great" / "Nothing specific" mean *only* that.
    return current.includes(value) ? [] : [value];
  }
  const withoutExclusive = current.filter((v) => !BODY_EXCLUSIVE.has(v));
  return withoutExclusive.includes(value)
    ? withoutExclusive.filter((v) => v !== value)
    : [...withoutExclusive, value];
}

/** Same rule for the "where, specifically?" list. */
export function toggleBodyPart(current: string[], value: string): string[] {
  if (value === "None specific") return current.includes(value) ? [] : [value];
  const without = current.filter((v) => v !== "None specific");
  return without.includes(value) ? without.filter((v) => v !== value) : [...without, value];
}

export const BODY_OPTIONS = [
  "Great",
  "A little stiff",
  "Sore",
  "Tired",
  "Injured",
  "Nothing specific",
];

export const BODY_PARTS = [
  "Neck",
  "Shoulders",
  "Upper back",
  "Lower back",
  "Hips",
  "Hamstrings",
  "Knees",
  "Wrists",
  "None specific",
];

export const ENERGY_OPTIONS = ["Energized", "Balanced", "Low", "Exhausted", "Restless"];

/**
 * Map the Trainer's energy answer onto a journal mood.
 *
 * The Trainer already asks how the body feels and what the energy is; the
 * guided player then asked "How are you feeling?" a third time before the
 * session and a fourth after it. Reusing the answer we already have means the
 * before/after delta still works with one question fewer.
 */
export function moodFromEnergy(energy: string): "Calm" | "Grounded" | "Energized" | "Tired" | "Stressed" | null {
  switch (energy) {
    case "Energized":
      return "Energized";
    case "Balanced":
      return "Grounded";
    case "Low":
    case "Exhausted":
      return "Tired";
    case "Restless":
      return "Stressed";
    default:
      return null;
  }
}

export const TIME_OPTIONS = [5, 10, 15, 20, 30];

export const NEED_OPTIONS = [
  { id: "calm", label: "Calm" },
  { id: "energy", label: "Energy" },
  { id: "flexibility", label: "Flexibility" },
  { id: "sleep", label: "Better sleep" },
  { id: "focus", label: "Focus" },
  { id: "movement", label: "Just move" },
  { id: "strength", label: "Strength" },
];

export const NEED_LABEL: Record<string, string> = Object.fromEntries(
  NEED_OPTIONS.map((n) => [n.id, n.label]),
);

/** Used only to keep the catalog import warm for tree-shaking edge cases. */
export const TRAINER_CATALOG_SIZE = ASANAS.length;
