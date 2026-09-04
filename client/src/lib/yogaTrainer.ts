// Client-side Yoga Trainer composer — builds a safe, personalized sequence
// from today's check-in without needing an LLM or network.

import { ASANAS, asanaBySlug, type Asana, type Mood } from "@/data/content";
import {
  ARC_SLOT,
  CHILD_SLUGS,
  REST_SLUGS,
  type ArcSlot,
} from "@/data/arcSlots";

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
  /** 0 centering · 1 warm-up · 2 build · 3 peak · 4 cool-down · 5 rest */
  arcSlot: ArcSlot;
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
  /**
   * Set when standing / build work was deliberately left out (easing,
   * restful need, or a contraindication). Null when the standing floor holds.
   */
  standingExclusion: string | null;
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

/**
 * Extra gentle working poses for calm/sleep. Those sequences are mostly
 * closers — without this pool a 25-minute request is the same five poses as 15,
 * just hoping holds can stretch, which they can't past the restorative band.
 */
const RESTFUL_FILL = [
  "sukhasana",
  "marjaryasana-bitilasana",
  "supta-baddha-konasana",
  "paschimottanasana",
  "supta-matsyendrasana",
  "pawanmuktasana",
  "setu-bandhasana",
  "vajrasana",
  "makarasana",
  "shashankasana",
  "seated-side-bend",
  "banana-pose",
  "supta-gomukhasana",
  "jathara-parivartanasana",
  "salamba-setu-bandhasana",
];

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

/** Pools used to inject a missing arc role so regenerate cannot starve a slot. */
const CENTERING_POOL = ["sukhasana", "tadasana", "vajrasana", "dandasana", "virasana"];
const WARMUP_POOL = [
  "marjaryasana-bitilasana",
  "urdhva-hastasana",
  "ardha-uttanasana",
  "pawanmuktasana",
  "adho-mukha-svanasana",
  "high-lunge",
];
/**
 * Slot 2 is the standing / build phase — warriors, triangles, chair, tree.
 * Seated and supine shapes used to live here, which is why a "steady practice"
 * read as a wind-down: the bucket was never seeded with time on the feet.
 */
const STANDING_BUILD_POOL = [
  "virabhadrasana-ii",
  "trikonasana",
  "utkatasana",
  "vrksasana",
  "standing-side-stretch",
  "baddha-virabhadrasana",
  "utkata-konasana",
  "standing-figure-four",
  "goddess-pulse",
  "garudasana",
  "utthita-parsvakonasana",
  "baddha-parsvakonasana",
];
/** Floor-based build shapes when standing work is deliberately off. */
const SEATED_BUILD_POOL = [
  "baddha-konasana",
  "paschimottanasana",
  "seated-side-bend",
  "janu-sirsasana",
  "anjaneyasana",
  "banana-pose",
  "gomukhasana",
];
const PEAK_POOL: Record<string, string[]> = {
  calm: ["setu-bandhasana", "salamba-setu-bandhasana", "soft-bridge-pulse"],
  sleep: ["salamba-setu-bandhasana", "setu-bandhasana"],
  energy: ["camatkarasana", "virabhadrasana-i", "utkatasana"],
  flexibility: ["eka-pada-rajakapotasana", "hanumanasana", "setu-bandhasana"],
  focus: ["parivrtta-hasta-padangusthasana", "natarajasana", "setu-bandhasana"],
  movement: ["virabhadrasana-i", "setu-bandhasana", "camatkarasana", "kumbhakasana"],
  strength: ["kumbhakasana", "navasana", "ardha-navasana", "utkatasana"],
  restorative: ["setu-bandhasana", "salamba-setu-bandhasana"],
};
const COOLDOWN_POOL = [
  "supta-matsyendrasana",
  "jathara-parivartanasana",
  "balasana",
  "supta-kapotasana",
  "shashankasana",
];
const REST_POOL = ["savasana", "constructive-rest", "viparita-karani", "parsva-savasana"];

const TWIST_SLUGS = new Set([
  "supta-matsyendrasana",
  "jathara-parivartanasana",
  "ardha-matsyendrasana",
  "bharadvajasana",
  "prenatal-supported-twist",
]);

/**
 * Arc slots: 0 centering · 1 warm-up · 2 build/standing · 3 peak · 4 cool-down · 5 rest.
 * Catalog poses carry this as `asana.arcSlot`; regenerate only shuffles inside a slot.
 */
export function poseArcRank(s: string): ArcSlot {
  const pose = asanaBySlug(s);
  if (pose) return pose.arcSlot;
  if (REST_SLUGS.has(s)) return ARC_SLOT.rest;
  if (CHILD_SLUGS.has(s)) return ARC_SLOT.cooldown;
  return ARC_SLOT.build;
}

/**
 * Standing work for the build slot. Mountain / Upward Salute still count as
 * category "Standing" but they live in centering / warm-up — they do not
 * satisfy the standing-pose floor.
 */
export function isStandingBuild(slug: string): boolean {
  const pose = asanaBySlug(slug);
  return !!pose && pose.category === "Standing" && poseArcRank(slug) === ARC_SLOT.build;
}

/** 10 min → 1, 15 min → 2, 20+ min → 3. Below 10 is too short for a standing block. */
export function standingFloorFor(minutes: number): number {
  if (minutes < 10) return 0;
  if (minutes < 15) return 1;
  if (minutes < 20) return 2;
  return 3;
}

function arcOrder(slugs: string[]): string[] {
  return slugs
    .map((s, i) => ({ s, i, r: poseArcRank(s) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.s);
}

export function orderPosesByArc<T extends { slug: string }>(poses: T[]): T[] {
  return poses
    .map((p, i) => ({ p, i, r: poseArcRank(p.slug) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.p);
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
 * Choose a subset sorted by arc slot. Variant only reshuffles inside a slot —
 * rest never migrates into the opening.
 */
function selectArcSlugs(
  slugs: string[],
  target: number,
  variant: number,
  safe: (s: string) => boolean,
  need: string,
  minStanding: number,
  allowStanding: boolean,
): string[] {
  const n = Math.max(6, target);
  const buckets = bucketize(slugs);
  const taken = new Set(slugs);

  const counts = slotCounts(n, allowStanding ? minStanding : 0);
  fillSlot(buckets[0]!, CENTERING_POOL, counts[0]!, taken, safe, 0);
  fillSlot(buckets[1]!, WARMUP_POOL, counts[1]!, taken, safe, 1);
  if (allowStanding) {
    fillStandingBuild(buckets[2]!, Math.max(counts[2]!, minStanding), taken, safe);
  }
  fillSlot(
    buckets[3]!,
    [...(PEAK_POOL[need] ?? []), ...(PEAK_POOL.movement ?? [])],
    counts[3]!,
    taken,
    safe,
    3,
  );
  fillSlot(buckets[4]!, COOLDOWN_POOL, counts[4]!, taken, safe, 4);
  fillSlot(buckets[5]!, REST_POOL, counts[5]!, taken, safe, 5);
  fillSlot(buckets[2]!, SEATED_BUILD_POOL, counts[2]!, taken, safe, 2);

  // Prefer a twist and Child's Pose in the cool-down so the close stays
  // twist → child → rest even when the working set is large.
  if (!buckets[4]!.some((s) => TWIST_SLUGS.has(s))) {
    fillSlot(buckets[4]!, [...TWIST_SLUGS], buckets[4]!.length + 1, taken, safe, 4);
  }
  if (!buckets[4]!.some((s) => CHILD_SLUGS.has(s))) {
    fillSlot(buckets[4]!, [...CHILD_SLUGS], buckets[4]!.length + 1, taken, safe, 4);
  }
  if (!buckets[5]!.some((s) => REST_SLUGS.has(s))) {
    fillSlot(buckets[5]!, REST_POOL, buckets[5]!.length + 1, taken, safe, 5);
  }

  if (allowStanding) {
    buckets[2]!.sort((a, b) => standingBuildRank(a) - standingBuildRank(b));
  }
  const standingPref = new Set(buckets[2]!.filter(isStandingBuild));
  const picked = [
    ...pickFromBucket(buckets[0]!, counts[0]!, variant, 0),
    ...pickFromBucket(buckets[1]!, counts[1]!, variant, 1),
    ...pickFromBucket(buckets[2]!, counts[2]!, variant, 2, standingPref),
    ...pickFromBucket(buckets[3]!, counts[3]!, variant, 3),
    ...pickFromBucket(buckets[4]!, counts[4]!, variant, 4, TWIST_SLUGS, new Set(["balasana", "salamba-balasana", "wide-child-pose"])),
    ...pickFromBucket(buckets[5]!, counts[5]!, variant, 5, new Set(), REST_SLUGS),
  ];

  const ordered = arcOrder(Array.from(new Set(picked)));
  return allowStanding
    ? swapInStanding(ordered, minStanding, safe)
    : ordered;
}

function bucketize(slugs: string[]): string[][] {
  const buckets: string[][] = [[], [], [], [], [], []];
  const seen = new Set<string>();
  for (const s of slugs) {
    if (seen.has(s)) continue;
    seen.add(s);
    buckets[poseArcRank(s)]!.push(s);
  }
  return buckets;
}

function pushUnique(bucket: string[], slug: string, taken: Set<string>): boolean {
  if (taken.has(slug)) return false;
  taken.add(slug);
  bucket.push(slug);
  return true;
}

function fillSlot(
  bucket: string[],
  pool: string[],
  need: number,
  taken: Set<string>,
  safe: (s: string) => boolean,
  slot: number,
): void {
  for (const s of pool) {
    if (bucket.length >= need) return;
    if (!safe(s)) continue;
    if (poseArcRank(s) !== slot) continue;
    pushUnique(bucket, s, taken);
  }
}

/** Keep adding standing work even when the bucket is already full of seated builds. */
function fillStandingBuild(
  bucket: string[],
  want: number,
  taken: Set<string>,
  safe: (s: string) => boolean,
): void {
  for (const s of STANDING_BUILD_POOL) {
    if (bucket.filter(isStandingBuild).length >= want) return;
    if (!safe(s) || !isStandingBuild(s)) continue;
    pushUnique(bucket, s, taken);
  }
}

function standingBuildRank(slug: string): number {
  if (!isStandingBuild(slug)) return 1000 + STANDING_BUILD_POOL.length;
  const i = STANDING_BUILD_POOL.indexOf(slug);
  return i >= 0 ? i : STANDING_BUILD_POOL.length;
}

/**
 * Replace a seated/kneeling build pose with standing work so the floor is met
 * without changing sequence length (which would slide the peak out of 45–65%).
 */
function swapInStanding(
  slugs: string[],
  minStanding: number,
  safe: (s: string) => boolean,
): string[] {
  if (minStanding <= 0) return slugs;
  const next = slugs.slice();
  let have = next.filter(isStandingBuild).length;
  if (have >= minStanding) return next;
  for (const s of STANDING_BUILD_POOL) {
    if (have >= minStanding) break;
    if (!safe(s) || next.includes(s) || !isStandingBuild(s)) continue;
    const replaceAt = next.findIndex((x) => poseArcRank(x) === ARC_SLOT.build && !isStandingBuild(x));
    if (replaceAt < 0) break;
    next[replaceAt] = s;
    have += 1;
  }
  return arcOrder(next);
}

/**
 * How many poses per slot so the warm-up lands at 1-based position 2 or 3
 * and the peak cluster sits between 45% and 65% of the sequence.
 */
function slotCounts(n: number, minBuild = 0): number[] {
  const len = Math.max(6, n);
  const C = 1;
  const W = 1;
  const Pmin = 1;
  let Dmin = len >= 8 ? 2 : 1;
  const R = 1;
  let leftover = len - C - W - Pmin - Dmin - R;
  const wantBuild = Math.max(0, minBuild);
  if (wantBuild > leftover && leftover + (Dmin - 1) >= wantBuild) {
    const steal = wantBuild - leftover;
    Dmin -= steal;
    leftover += steal;
  }

  const lo = Math.max(1, Math.ceil(len * 0.45));
  const hi = Math.max(lo, Math.floor(len * 0.65));
  const targetPeak = Math.round((lo + hi) / 2);
  let B = Math.max(wantBuild, Math.max(0, targetPeak - C - W - 1));
  if (B > leftover) B = Math.max(wantBuild, leftover);
  leftover -= B;

  let P = Pmin;
  let D = Dmin;
  while (leftover > 0) {
    const lastPeak = C + W + B + P;
    if (lastPeak < hi) {
      P += 1;
      leftover -= 1;
      continue;
    }
    D += 1;
    leftover -= 1;
  }

  while (C + W + B + 1 > hi && B > wantBuild) {
    B -= 1;
    D += 1;
  }
  while (C + W + B + 1 < lo) {
    if (D > Dmin) {
      D -= 1;
      B += 1;
    } else {
      break;
    }
  }

  return [C, W, B, P, D, R];
}

function pickFromBucket(
  bucket: string[],
  count: number,
  variant: number,
  slot: number,
  preferFirst: Set<string> = new Set(),
  preferLast: Set<string> = new Set(),
): string[] {
  const pool = variant > 0 ? shuffled(bucket, variant * 11 + slot + 3) : bucket.slice();
  const first: string[] = [];
  const mid: string[] = [];
  const last: string[] = [];
  for (const s of pool) {
    if (preferLast.has(s)) last.push(s);
    else if (preferFirst.has(s)) first.push(s);
    else mid.push(s);
  }
  // Reserve preferred closers / openers so slice(0, count) cannot drop
  // Savasana in favour of a restorative that happened to shuffle first.
  const takeLast = last.slice(0, count);
  const remaining = count - takeLast.length;
  const takeFirst = first.slice(0, remaining);
  const takeMid = mid.slice(0, Math.max(0, remaining - takeFirst.length));
  return [...takeFirst, ...takeMid, ...takeLast];
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

/**
 * Subject-verb agreement for "your knees are asking" vs "your neck is asking".
 * A single part that already looks plural (hips, knees, wrists) takes "are".
 */
export function careAgreement(parts: string[]): "is" | "are" {
  if (parts.length !== 1) return "are";
  const w = (parts[0] ?? "").trim().toLowerCase();
  if (w.endsWith("ss")) return "is";
  if (w.endsWith("s")) return "are";
  return "is";
}

/** Compose a personalized practice from the trainer check-in. */
export function composeTrainerSession(
  c: TrainerCheckIn,
  opts?: {
    preferSlugs?: string[];
    audience?: TrainerAudience;
    experience?: TrainerExperience;
    /** 0 = stable authored order. >0 reshuffles within warm-up / peak / cool-down. */
    variant?: number;
    /**
     * When false, slot 2 stays on the floor (calm / sleep / easing). Default
     * is true for vigorous needs and false for restful ones.
     */
    allowStanding?: boolean;
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
  const fillPools = [
    BACKFILL[key] ?? [],
    RESTFUL_NEEDS.has(key) ? RESTFUL_FILL : [],
    SEQUENCES[key] ?? [],
    SAFE_POOL,
  ].map((pool, i) => (variant > 0 ? shuffled(pool, variant * 17 + i + 1) : pool));

  // Rebuild toward the requested focus first, then fall back to the safe pool.
  for (const pool of fillPools) {
    for (const s of pool) {
      if (slugs.length >= fillCap) break;
      if (!slugs.includes(s) && safe(s)) slugs.push(s);
    }
  }

  slugs = Array.from(new Set(slugs));

  const allowStanding = opts?.allowStanding ?? !RESTFUL_NEEDS.has(key);

  // Seed slot-2 standing work into the candidate list so selectArcSlugs can
  // draw it after the warm-up. Mountain alone is centering, not a practice arc.
  if (allowStanding) {
    const want = Math.max(standingFloorFor(c.timeMinutes), 3);
    for (const s of STANDING_BUILD_POOL) {
      if (slugs.filter(isStandingBuild).length >= want) break;
      if (safe(s) && !slugs.includes(s)) slugs.push(s);
    }
  }

  // Did enough of the requested focus survive to honestly call it that?
  const signature = slugs.filter(
    (s) => (SEQUENCES[key] ?? []).includes(s) && poseArcRank(s) < ARC_SLOT.cooldown,
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

  const standingOn =
    allowStanding && deliveredNeed !== "restorative" && !RESTFUL_NEEDS.has(key);
  const standingWanted = standingOn ? standingFloorFor(c.timeMinutes) : 0;

  // Centering → warm-up → build → peak → cool-down → rest. Regenerating
  // reshuffles inside a slot; it never promotes rest into the opening.
  slugs = selectArcSlugs(
    slugs,
    targetPoseCount,
    variant,
    safe,
    deliveredNeed,
    standingWanted,
    standingOn,
  );

  if (standingOn && slugs.filter(isStandingBuild).length < standingWanted) {
    slugs = swapInStanding(slugs, standingWanted, safe);
  }

  if (!slugs.some((s) => poseArcRank(s) === ARC_SLOT.rest)) {
    const closer = REST_POOL.find(safe);
    if (closer) slugs = arcOrder([...slugs, closer]);
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
    arcSlot: poseArcRank(s),
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
    ? `Because your ${c.soreParts.join(" and ").toLowerCase()} ${careAgreement(c.soreParts)} asking for care, I've shaped ${c.timeMinutes} minutes of ${deliveredLabel} that meets you where you are and closes in rest.`
    : `Here are ${c.timeMinutes} minutes of ${deliveredLabel}, shaped for how you're feeling today and closing in rest.`;

  let standingExclusion: string | null = null;
  const standingCount = poses.filter((p) => isStandingBuild(p.slug)).length;
  if (standingOn && standingWanted > 0 && standingCount < standingWanted) {
    standingExclusion = c.soreParts.length
      ? `Keeping you off your feet today to protect your ${c.soreParts.join(" and ").toLowerCase()}.`
      : "Keeping you off your feet today — standing work wasn't safe with what you reported.";
    if (!adjustments.includes(standingExclusion)) adjustments.push(standingExclusion);
  } else if (opts?.allowStanding === false) {
    standingExclusion = "Keeping you off your feet today.";
  } else if (deliveredNeed === "restorative") {
    standingExclusion =
      adjustments.find((a) => /restorative session instead/i.test(a)) ??
      "Keeping you off your feet today — this is a restorative session.";
  }

  return {
    reasoning,
    poses,
    totalMinutes: estimatedMinutes(poses),
    requestedNeed: key,
    deliveredNeed,
    adjustments,
    standingExclusion,
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
export function moodFromEnergy(energy: string): Mood | null {
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
