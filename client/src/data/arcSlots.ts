/**
 * Practice-arc slot for every catalog pose.
 *
 * 0 centering · 1 warm-up · 2 build/standing · 3 peak · 4 cool-down · 5 rest
 *
 * Best-for strings already encode the tail ("Every warm-up", "Final pose before
 * Savasana", "Closing every practice"). This promotes that to a numeric slot
 * so the whole plan can sort by it, not just the closing bucket.
 */

export type ArcSlot = 0 | 1 | 2 | 3 | 4 | 5;

export const ARC_SLOT = {
  centering: 0,
  warmup: 1,
  build: 2,
  peak: 3,
  cooldown: 4,
  rest: 5,
} as const;

export const ARC_SLOT_LABEL: Record<ArcSlot, string> = {
  0: "centering",
  1: "warm-up",
  2: "build",
  3: "peak",
  4: "cool-down",
  5: "rest",
};

/** Official integration shapes — last in the class, long holds. */
export const REST_SLUGS = new Set([
  "savasana",
  "parsva-savasana",
  "constructive-rest",
  "viparita-karani",
  "chair-viparita-karani",
  "legs-up-bolster",
  "prenatal-side-lying-rest",
  "prenatal-legs-elevated",
]);

/** Child's Pose and siblings sit in cool-down, just before rest. */
export const CHILD_SLUGS = new Set([
  "balasana",
  "salamba-balasana",
  "wide-child-pose",
  "shashankasana",
]);

const SLOT_OVERRIDE: Record<string, ArcSlot> = {
  // 0 — centering / arrival
  sukhasana: 0,
  vajrasana: 0,
  tadasana: 0,
  padmasana: 0,
  virasana: 0,
  dandasana: 0,
  "womb-seat": 0,

  // 1 — warm-up
  "marjaryasana-bitilasana": 1,
  "urdhva-hastasana": 1,
  "ardha-uttanasana": 1,
  "adho-mukha-svanasana": 1,
  chakravakasana: 1,
  "prenatal-cat-cow": 1,
  "hip-circles-tabletop": 1,
  "world-greatest-stretch": 1,
  pawanmuktasana: 1,
  "active-hamstring-raise": 1,
  "high-lunge": 1,
  "eka-pada-adho-mukha-svanasana": 1,
  "prenatal-hip-circles": 1,
  "prenatal-pelvic-tilt": 1,

  // 2 — build / standing (explicit where category would mis-file)
  "baddha-konasana": 2,
  "paschimottanasana": 2,
  "janu-sirsasana": 2,
  "upavistha-konasana": 2,
  "seated-side-bend": 2,
  "banana-pose": 2,
  gomukhasana: 2,
  "ananda-balasana": 2,
  anjaneyasana: 2,
  "virabhadrasana-i": 3,
  "virabhadrasana-ii": 2,
  "baddha-virabhadrasana": 2,
  "baddha-parsvakonasana": 2,
  trikonasana: 2,
  utkatasana: 2,
  "utthita-parsvakonasana": 2,
  vrksasana: 2,
  garudasana: 2,
  "standing-figure-four": 2,
  "standing-side-stretch": 2,
  "ardha-hanumanasana": 2,
  "half-kneeling-hamstring": 2,
  "couch-hip-flexor": 2,
  "runner-lunge-twist": 2,
  malasana: 2,
  "goddess-pulse": 2,
  "utkata-konasana": 2,
  "prenatal-warrior-ii": 2,
  "prenatal-goddess": 2,
  "moon-lunge": 2,

  // 3 — peak
  "setu-bandhasana": 3,
  "salamba-setu-bandhasana": 3,
  "urdhva-dhanurasana": 3,
  ustrasana: 3,
  dhanurasana: 3,
  camatkarasana: 3,
  kumbhakasana: 3,
  "chaturanga-dandasana": 3,
  navasana: 3,
  "ardha-navasana": 3,
  "uttana-padasana": 3,
  vasisthasana: 3,
  "ardha-pincha-mayurasana": 3,
  "natarajasana": 3,
  "hanumanasana": 3,
  "viparita-virabhadrasana": 3,
  "parivrtta-hasta-padangusthasana": 3,
  bakasana: 3,
  "soft-bridge-pulse": 3,
  "glute-bridge-march": 3,

  // 4 — cool-down
  "supta-matsyendrasana": 4,
  "jathara-parivartanasana": 4,
  "ardha-matsyendrasana": 4,
  "bharadvajasana": 4,
  "supta-kapotasana": 4,
  "supta-gomukhasana": 4,
  "supta-garudasana": 4,
  "reclined-figure-four-soft": 4,
  "parsva-balasana": 4,
  "thread-needle-rest": 4,
  "uttana-shishosana": 4,
  "melting-heart": 4,
  caterpillar: 4,
  "supported-fish-block": 4,
  "salamba-matsyasana": 4,
  "chair-forward-fold": 4,
  "wall-calf-stretch": 4,
  "prenatal-supported-twist": 4,
  "prenatal-thread-needle": 4,
  balasana: 4,
  "salamba-balasana": 4,
  "wide-child-pose": 4,
  shashankasana: 4,

  // 5 — rest (beyond REST_SLUGS)
  makarasana: 5,
  "supta-baddha-konasana": 5,
  "supta-virasana": 5,
  "reclined-goddess": 5,
  "wall-butterfly": 5,
  "supported-side-curl": 5,
};

type PoseHint = {
  slug: string;
  category: string;
  difficulty: string;
  english?: string;
  bestFor?: string[];
};

function fromBestFor(text: string): ArcSlot | null {
  if (
    /closing every practice|deep restorative|prone restorative|nap-adjacent|before sleep|right before sleep|nervous-system (downshift|calm)|deep rest &|deep rest\b|savasana alternative|tired legs (at bedtime|restore)|falling asleep/.test(
      text,
    )
  ) {
    return 5;
  }
  if (
    /every warm-up|any warm-up|full-body warm-up|athletic warm-up|prenatal warm-up|core-friendly warm-up|warming up|starting sun salutation|sun salutation transition/.test(
      text,
    )
  ) {
    return 1;
  }
  if (
    /starting any practice|starting seated|soft start to practice|centering and calm|meditation & breathwork|meditation seat|simple meditation/.test(
      text,
    )
  ) {
    return 0;
  }
  if (
    /final pose before savasana|closing strong|closing any strong|closing inversion|evening unwind|cool-?down/.test(
      text,
    )
  ) {
    return 4;
  }
  if (/\bpeak\b/.test(text)) return 3;
  return null;
}

/**
 * Numeric arc slot for a catalog pose. Overrides win, then best-for copy,
 * then category / difficulty — never the old "gentle ⇒ opening" collapse.
 */
export function arcSlotFor(pose: PoseHint): ArcSlot {
  const slug = pose.slug;
  if (SLOT_OVERRIDE[slug] != null) return SLOT_OVERRIDE[slug]!;
  if (REST_SLUGS.has(slug)) return 5;
  if (CHILD_SLUGS.has(slug)) return 4;

  const blob = `${pose.english ?? ""} ${(pose.bestFor ?? []).join(" ")}`.toLowerCase();
  const fromCopy = fromBestFor(blob);
  if (fromCopy != null) return fromCopy;

  if (pose.difficulty === "Advanced") return 3;
  if (pose.category === "Standing") return 2;
  if (pose.category === "Inversions") {
    if (/viparita|legs.?up|sarvangasana|halasana|karna-pidasana/.test(slug)) return 4;
    return 3;
  }
  if (pose.category === "Backbends") return 3;
  if (pose.category === "Core") return 2;
  if (pose.category === "Supine/Prone") return 1;
  if (pose.category === "Hip Openers") {
    if (/^supta-/.test(slug) || /reclined|supine|rest/.test(blob)) return 4;
    return 2;
  }
  if (pose.category === "Restorative") return 5;
  if (pose.category === "Seated" || pose.category === "Forward Bends") return 4;
  return 2;
}

export function isArcSlot(n: number): n is ArcSlot {
  return Number.isInteger(n) && n >= 0 && n <= 5;
}
