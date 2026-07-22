// Client-side Yoga Trainer composer — builds a safe, personalized sequence
// from today's check-in without needing an LLM or network.

import { ASANAS, asanaBySlug, type Asana } from "@/data/content";

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
};

const SEQUENCES: Record<string, string[]> = {
  calm: ["sukhasana", "balasana", "paschimottanasana", "supta-matsyendrasana", "viparita-karani", "constructive-rest", "savasana"],
  energy: ["urdhva-hastasana", "tadasana", "eka-pada-adho-mukha-svanasana", "high-lunge", "baddha-virabhadrasana", "virabhadrasana-i", "camatkarasana", "adho-mukha-svanasana", "balasana", "savasana"],
  flexibility: ["marjaryasana-bitilasana", "anjaneyasana", "ardha-hanumanasana", "supta-kapotasana", "paschimottanasana", "parivrtta-paschimottanasana", "parivrtta-upavistha-konasana", "balasana", "savasana"],
  sleep: ["salamba-balasana", "pawanmuktasana", "jathara-parivartanasana", "salamba-setu-bandhasana", "chair-viparita-karani", "constructive-rest", "parsva-savasana"],
  focus: ["sukhasana", "vajrasana", "vrksasana", "garudasana", "parivrtta-hasta-padangusthasana", "balasana", "savasana"],
  movement: ["tadasana", "urdhva-hastasana", "ardha-uttanasana", "adho-mukha-svanasana", "anjaneyasana", "baddha-parsvakonasana", "trikonasana", "balasana", "savasana"],
  strength: ["tadasana", "utkatasana", "virabhadrasana-ii", "kumbhakasana", "uttana-padasana", "ardha-navasana", "makara-adho-mukha-svanasana", "navasana", "balasana", "savasana"],
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

function hasSlug(slug: string): boolean {
  return !!asanaBySlug(slug);
}

function isContraindicated(asana: Asana, soreParts: string[], injured: boolean): boolean {
  if (injured && asana.category !== "Restorative" && !GENTLE.has(asana.slug)) return true;

  const parts = new Set(soreParts);
  if ((parts.has("Lower back") || parts.has("Upper back")) &&
      ["urdhva-dhanurasana", "ustrasana", "mayurasana", "adho-mukha-vrksasana"].includes(asana.slug)) {
    return true;
  }
  if (parts.has("Hamstrings") &&
      ["hanumanasana", "paschimottanasana", "uttanasana", "ardha-hanumanasana", "padangusthasana"].includes(asana.slug)) {
    return true;
  }
  if (parts.has("Hips") &&
      ["eka-pada-rajakapotasana", "utthan-pristhasana", "rajakapotasana", "samakonasana"].includes(asana.slug)) {
    return true;
  }
  if (parts.has("Knees") &&
      ["virabhadrasana-i", "anjaneyasana", "high-lunge", "utthan-pristhasana", "utkatasana", "padmasana", "malasana"].includes(asana.slug)) {
    return true;
  }
  if (parts.has("Wrists") &&
      ["adho-mukha-svanasana", "urdhva-dhanurasana", "bakasana", "mayurasana", "kumbhakasana", "chaturanga-dandasana"].includes(asana.slug)) {
    return true;
  }
  if (parts.has("Neck") &&
      ["sirsasana", "halasana", "sarvangasana", "pincha-mayurasana", "vrischikasana"].includes(asana.slug)) {
    return true;
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

/** Compose a personalized practice from the trainer check-in. */
export function composeTrainerSession(c: TrainerCheckIn): TrainerSession {
  const injured = c.body.some((b) => b.toLowerCase().includes("injured"));
  const need = (c.need || "movement").toLowerCase();
  const key = SEQUENCES[need] ? need : "movement";

  let slugs = injured
    ? ["salamba-balasana", "constructive-rest", "chair-viparita-karani", "parsva-savasana"]
    : [...(SEQUENCES[key] ?? SEQUENCES.movement)];

  // Prefer poses that exist in the catalog.
  slugs = slugs.filter(hasSlug);

  // Filter contraindicated shapes.
  slugs = slugs.filter((s) => {
    const pose = asanaBySlug(s);
    return pose ? !isContraindicated(pose, c.soreParts, injured) : false;
  });

  // Energy tweaks: low energy → lean restorative; high → keep standing heat.
  if (/exhausted|tired|low/i.test(c.energy)) {
    slugs = slugs.filter((s) => {
      const a = asanaBySlug(s);
      return a && (a.difficulty !== "Advanced" || GENTLE.has(s));
    });
    for (const s of ["constructive-rest", "chair-viparita-karani", "balasana"]) {
      if (!slugs.includes(s) && hasSlug(s)) slugs.unshift(s);
    }
  }

  // Backfill safe poses to keep a real session.
  for (const s of [
    "sukhasana",
    "balasana",
    "marjaryasana-bitilasana",
    "adho-mukha-svanasana",
    "viparita-karani",
    "constructive-rest",
    "savasana",
  ]) {
    if (slugs.length >= 6) break;
    if (!slugs.includes(s) && hasSlug(s)) {
      const pose = asanaBySlug(s)!;
      if (!isContraindicated(pose, c.soreParts, injured)) slugs.push(s);
    }
  }

  if (!slugs.includes("savasana") && !slugs.includes("parsva-savasana") && !slugs.includes("constructive-rest")) {
    if (hasSlug("savasana")) slugs.push("savasana");
  }

  slugs = Array.from(new Set(slugs)).slice(0, 8);

  const targetSeconds = Math.max(5, c.timeMinutes) * 60;
  const weights = slugs.map((s) =>
    s === "savasana" || s === "constructive-rest" || s === "parsva-savasana"
      ? 1.6
      : s === "viparita-karani" || s === "chair-viparita-karani"
        ? 1.4
        : 1,
  );
  const sidesCount = slugs.map((s) => (EACH_SIDE.has(s) ? 2 : 1));
  const weightedUnits = weights.reduce((a, w, i) => a + w * sidesCount[i], 0) || 1;
  const perUnit = targetSeconds / weightedUnits;

  const poses: TrainerPose[] = slugs.map((s, i) => {
    const pose = asanaBySlug(s)!;
    const raw = Math.round((perUnit * weights[i]) / 5) * 5;
    const holdSeconds = Math.max(20, Math.min(300, raw));
    return {
      slug: s,
      holdSeconds,
      sides: EACH_SIDE.has(s) ? "each" : "once",
      why:
        pose.bestFor[0] ??
        pose.benefits[0] ??
        (s.includes("savasana") || s.includes("rest")
          ? "Rest and integrate."
          : "A steady, supportive shape for today."),
    };
  });

  const soreLine = c.soreParts.length
    ? `Because your ${c.soreParts.join(" and ").toLowerCase()} ${c.soreParts.length > 1 ? "are" : "is"} asking for care, `
    : "";
  const needLabel = need.replace(/-/g, " ");
  const reasoning = `${soreLine}with ${c.timeMinutes} minutes for ${needLabel}, I've shaped a sequence that meets you where you are and closes in rest.`;

  return {
    reasoning,
    poses,
    totalMinutes: estimatedMinutes(poses),
  };
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
