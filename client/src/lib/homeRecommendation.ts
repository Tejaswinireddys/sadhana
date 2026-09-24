/**
 * What should I practise today?
 *
 * Home used to answer that with a directory: mood sessions, curated flows, the
 * Trainer, the Adaptive Plan and a shortcut grid, all weighted the same, all
 * scrolled past. This picks *one* practice, says truthfully why it picked it,
 * and offers three alternatives — so the page is a decision, not a catalogue.
 *
 * Deliberately pure and deliberately small: it owns the ranking, not the
 * generating. Sessions come from `composeTrainerSession`, the quiz plan, the
 * enrolled program or the active profile — the same generators every other
 * screen uses, so a recommendation cannot drift from what those screens do.
 *
 * Every `reason` here must be checkable against the inputs. "Selected because
 * your focus is better sleep" is only allowed to appear when the practitioner
 * actually chose better sleep.
 *
 * An unfinished session is *not* a recommendation and is not ranked here — it
 * is something already in progress, and Home shows it in its own Continue
 * section rather than dressing it up as a choice.
 */
import { equipmentFreeSwapFor, sessionEquipment } from "@/lib/sessionEquipment";
import { isFloorFree, swapPreservesConstraints } from "@/data/floorAccess";
import { asanaBySlug, type Mood } from "@/data/content";
import type { SavedQuizPlan } from "@/data/quizPlan";
import type { Profile } from "@/data/profiles";
import { composeTrainerSession, NEED_LABEL, TIME_OPTIONS } from "@/lib/yogaTrainer";
import type { SessionFit } from "@/lib/sessionFit";
import type { ExperienceLevel, PracticeIntent } from "@/lib/localPrefs";

export type RecommendedPose = {
  slug: string;
  holdSeconds: number;
  sides?: "once" | "each";
};

export type RecommendationSource =
  | "program"
  | "quiz-plan"
  | "profile"
  | "generated";

export type PracticeRecommendation = {
  id: string;
  source: RecommendationSource;
  title: string;
  /** One short, checkable sentence. Never a benefit claim. */
  reason: string;
  poses: RecommendedPose[];
  /** Passed straight to `loadSession`. */
  meta: {
    label: string;
    pathwaySlug?: string | null;
    breathSlug?: string | null;
    introPoseSlug?: string | null;
    preMood?: Mood | null;
  };
  /** The length this was composed for, when a length was requested. */
  requestedMinutes: number | null;
  /** True when the practitioner can re-generate this at another length/focus. */
  adjustable: boolean;
  /**
   * Whether the requested length was honoured, for practices composed against
   * one. Null when nothing was requested (a program day is whatever it is).
   */
  fit: SessionFit | null;
};

export type HomeContext = {
  /** Today's day of an enrolled program, when there is one. */
  programDay: {
    pathwaySlug: string;
    pathwayName: string;
    day: number;
    theme: string;
    poses: RecommendedPose[];
  } | null;
  quizPlan: SavedQuizPlan | null;
  profile: Profile | null;
  intent: PracticeIntent | null;
  experience: ExperienceLevel | null;
  /** Local hour, 0–23. Used only to prefer a wind-down in the evening. */
  hour: number;
  /** Minutes the practitioner last asked for, when they have asked. */
  preferredMinutes: number | null;
  /** The focus they last chose, if any — a NEED_OPTIONS id. */
  preferredNeed?: string | null;
  /** True once at least one session has been completed on this device/account. */
  hasPracticed: boolean;
  /** The short, gentle first practice for someone who has told us nothing yet. */
  warmup: { title: string; poses: RecommendedPose[] } | null;
};

const INTENT_NEED: Record<PracticeIntent, string> = {
  calm: "calm",
  strength: "strength",
  flexibility: "flexibility",
  sleep: "sleep",
  explore: "movement",
};

const INTENT_LABEL: Record<PracticeIntent, string> = {
  calm: "calmer",
  strength: "stronger",
  flexibility: "more flexible",
  sleep: "better sleep",
  explore: "exploring",
};

/** Round a requested length onto something the generators actually offer. */
export function snapToOfferedMinutes(minutes: number): number {
  return (
    [...TIME_OPTIONS].sort(
      (a, b) => Math.abs(a - minutes) - Math.abs(b - minutes),
    )[0] ?? 15
  );
}

function experienceFor(ctx: HomeContext) {
  return ctx.experience ?? "new";
}

/**
 * A generated practice for a need and a length, using the shared composer.
 *
 * `reason` is a function of the length that was actually composed, not the one
 * that was asked for. The composer trims to fit but cannot always reach a short
 * request — writing "the same focus in 5 minutes" over an 8-minute practice is
 * the exact dishonesty the rest of this work removes.
 */
export function generatePractice(opts: {
  need: string;
  minutes: number;
  experience: ExperienceLevel;
  reason: string | ((achievedMinutes: number) => string);
  title?: string;
  /** An ENERGY_OPTIONS value. "Low" keeps Advanced shapes out. */
  energy?: string;
}): PracticeRecommendation {
  const session = composeTrainerSession(
    {
      body: ["Great"],
      soreParts: [],
      energy: opts.energy ?? "Balanced",
      timeMinutes: opts.minutes,
      need: opts.need,
    },
    { experience: opts.experience },
  );
  const label = opts.title ?? `${NEED_LABEL[opts.need] ?? "Your"} practice`;
  return {
    id: `generated:${opts.need}:${opts.minutes}${opts.energy && opts.energy !== "Balanced" ? `:${opts.energy}` : ""}`,
    source: "generated",
    title: label,
    reason:
      typeof opts.reason === "function" ? opts.reason(session.totalMinutes) : opts.reason,
    poses: session.poses.map((p) => ({
      slug: p.slug,
      holdSeconds: p.holdSeconds,
      sides: p.sides,
    })),
    meta: { label, introPoseSlug: session.poses[0]?.slug ?? null },
    requestedMinutes: opts.minutes,
    adjustable: true,
    fit: session.fit,
  };
}

/**
 * The single practice Home leads with.
 *
 * Order of preference: finish what you started, then the program you enrolled
 * in, then the plan you built, then your profile, then a composed practice for
 * your stated focus. Each step is something the practitioner did, so each
 * reason is something we can say back to them.
 */
export function recommendPractice(ctx: HomeContext): PracticeRecommendation | null {
  // Someone who has told us nothing and practised nothing gets the short,
  // gentle first practice, not a composed "Strong / Intermediate" session
  // generated from defaults they never chose.
  const knowsNothing =
    !ctx.programDay && !ctx.quizPlan && !ctx.profile && !ctx.intent && !ctx.hasPracticed;
  if (knowsNothing && ctx.warmup && ctx.warmup.poses.length > 0) {
    return {
      id: "first-practice",
      source: "generated",
      title: ctx.warmup.title,
      reason: "A short, gentle first practice with no props — take the two-minute quiz any time for a plan of your own.",
      poses: ctx.warmup.poses,
      meta: {
        label: ctx.warmup.title,
        introPoseSlug: ctx.warmup.poses[0]?.slug ?? null,
      },
      requestedMinutes: null,
      adjustable: false,
      fit: null,
    };
  }

  if (ctx.programDay && ctx.programDay.poses.length > 0) {
    const d = ctx.programDay;
    return {
      id: `program:${d.pathwaySlug}:${d.day}`,
      source: "program",
      title: `${d.pathwayName} — Day ${d.day}`,
      reason: `Day ${d.day} of the program you started.${d.theme ? ` Today's focus is ${d.theme.toLowerCase()}.` : ""}`,
      poses: d.poses,
      meta: {
        label: `${d.pathwayName} — Day ${d.day}`,
        pathwaySlug: d.pathwaySlug,
        introPoseSlug: d.poses[0]?.slug ?? null,
      },
      requestedMinutes: null,
      adjustable: false,
      fit: null,
    };
  }

  if (ctx.quizPlan && ctx.quizPlan.poses.length > 0) {
    const plan = ctx.quizPlan;
    const intent = plan.intent ?? ctx.intent;
    return {
      id: `quiz:${plan.title}`,
      source: "quiz-plan",
      title: plan.title,
      reason: intent
        ? `Built from your answers — you said you're here for ${INTENT_LABEL[intent]}.`
        : "Built from the answers you gave when you set up your plan.",
      poses: plan.poses.map((p) => ({
        slug: p.slug,
        holdSeconds: p.holdSeconds,
        ...(p.sides === "each" ? { sides: "each" as const } : {}),
      })),
      meta: {
        label: plan.title,
        breathSlug: plan.breathSlug ?? null,
        introPoseSlug: plan.introPoseSlug ?? null,
      },
      requestedMinutes: plan.minutes ?? null,
      adjustable: false,
      fit: null,
    };
  }

  if (ctx.profile) {
    const profile = ctx.profile;
    const poses = profile.recommendedAsanas
      .map((slug) => asanaBySlug(slug))
      .filter((a): a is NonNullable<typeof a> => !!a)
      .map((a) => ({ slug: a.slug, holdSeconds: a.holdSeconds }));
    if (poses.length > 0) {
      return {
        id: `profile:${profile.id}`,
        source: "profile",
        title: `${profile.name} session`,
        reason: `Selected because your ${profile.name} profile is the one you're following.`,
        poses,
        meta: { label: `${profile.name} session`, introPoseSlug: poses[0]?.slug ?? null },
        requestedMinutes: null,
        adjustable: false,
        fit: null,
      };
    }
  }

  // Nothing chosen yet. Compose something honest rather than pretending to
  // know a focus nobody set.
  const minutes = ctx.preferredMinutes ?? 10;
  const evening = ctx.hour >= 20 || ctx.hour < 4;
  if (ctx.intent) {
    return generatePractice({
      need: INTENT_NEED[ctx.intent],
      minutes: snapToOfferedMinutes(minutes),
      experience: experienceFor(ctx),
      reason: `Selected because your focus is ${INTENT_LABEL[ctx.intent]}.`,
      title: ctx.intent === "sleep" ? "Your evening wind-down" : undefined,
    });
  }
  return generatePractice({
    need: evening ? "sleep" : "movement",
    minutes: snapToOfferedMinutes(minutes),
    experience: experienceFor(ctx),
    reason: evening
      ? "A wind-down, because it's late and you haven't set a focus yet."
      : "A balanced practice — set a focus any time and this changes with it.",
    title: evening ? "Your evening wind-down" : undefined,
  });
}

/** The focus we compose for when nobody has picked one. */
export function defaultNeedFor(ctx: HomeContext): string {
  if (ctx.intent) return INTENT_NEED[ctx.intent];
  return ctx.hour >= 20 || ctx.hour < 4 ? "sleep" : "movement";
}

/**
 * What the practitioner asked for with "Change time" / "Change focus".
 *
 * An adjustment is an instruction, not a hint: it replaces the recommendation
 * outright, including for a first-time visitor who would otherwise be handed
 * the warm-up no matter which chip they tapped.
 */
export type HomeAdjust = {
  minutes: number | null;
  need: string | null;
  /** "Low" | "Balanced" | "Energized", or null when not chosen. */
  energy?: string | null;
  /** Practise with no props — swap or drop anything that needs one. */
  noProps?: boolean;
};

/** True when an adjustment asks for a different composed practice. */
export function adjustRegenerates(adjust: HomeAdjust): boolean {
  return !!(adjust.need || adjust.minutes || (adjust.energy && adjust.energy !== "Balanced"));
}

export function adjustedPractice(ctx: HomeContext, adjust: HomeAdjust): PracticeRecommendation {
  const need = adjust.need ?? defaultNeedFor(ctx);
  const requested = adjust.minutes ?? ctx.preferredMinutes ?? 10;
  const asked = snapToOfferedMinutes(requested);
  const energy = adjust.energy ?? "Balanced";
  const energyNote =
    energy === "Low" ? " Kept gentle because you said your energy is low." : energy === "Energized" ? " A little more active, as you asked." : "";
  const rec = generatePractice({
    need,
    minutes: asked,
    energy,
    experience: ctx.experience ?? "new",
    reason: (mins) => `${adjustedReason(mins)}${energyNote}`,
  });
  return rec;

  function adjustedReason(mins: number): string {
      const focusLabel = NEED_LABEL[need]?.toLowerCase() ?? "this focus";
      // Only claim the requested length when it was actually met. Saying "at
      // the length you asked for" above an eight-minute answer to a five-minute
      // request is the thing this whole module exists to avoid.
      if (mins === asked) {
        return adjust.need
          ? `You asked for ${focusLabel}, in ${mins} minutes.`
          : `Your focus, at the length you asked for: ${mins} minutes.`;
      }
      return `${
        adjust.need ? `You asked for ${focusLabel}` : "Your focus"
      }, in ${mins} minutes — the closest a narrated ${focusLabel} sequence gets to ${asked}.`;
  }
}

/**
 * The same practice with nothing that needs a prop.
 *
 * Each prop-dependent pose is swapped for its reviewed prop-free pair only
 * when that pair keeps the level and (in a floor-free practice) keeps the
 * practitioner off the floor; otherwise the pose is dropped. Never silently —
 * the reason line lists what changed.
 */
export function withoutProps(rec: PracticeRecommendation): PracticeRecommendation {
  const asanas = rec.poses.map((p) => asanaBySlug(p.slug)).filter((a): a is NonNullable<typeof a> => !!a);
  const needing = new Set(sessionEquipment(asanas).requiredBy.map((r) => r.slug));
  if (needing.size === 0) return rec;
  const keepOffFloor = isFloorFree(rec.poses.map((p) => p.slug));
  const swapped: string[] = [];
  const dropped: string[] = [];
  const poses: RecommendedPose[] = [];
  for (const p of rec.poses) {
    if (!needing.has(p.slug)) {
      poses.push(p);
      continue;
    }
    const english = asanaBySlug(p.slug)?.english ?? p.slug;
    const swap = equipmentFreeSwapFor(p.slug);
    if (
      swap &&
      swapPreservesConstraints(p.slug, swap.slug, { keepOffFloor }) &&
      !rec.poses.some((q) => q.slug === swap.slug)
    ) {
      poses.push({ ...p, slug: swap.slug });
      swapped.push(`${english} → ${asanaBySlug(swap.slug)?.english ?? swap.slug}`);
    } else {
      dropped.push(english);
    }
  }
  const parts = [
    swapped.length ? `Swapped for no props: ${swapped.join(", ")}.` : "",
    dropped.length ? `Left out (needs a prop, no equal swap): ${dropped.join(", ")}.` : "",
  ].filter(Boolean);
  return {
    ...rec,
    id: `${rec.id}:no-props`,
    poses,
    reason: `${rec.reason} ${parts.join(" ")}`.trim(),
    meta: { ...rec.meta, introPoseSlug: poses[0]?.slug ?? null },
  };
}

/**
 * Three practices that are genuinely different from the one on offer.
 *
 * Not a shelf of everything: a shorter version, a gentler version, and one
 * different focus. Anything broader belongs on Practice, which is a catalogue
 * on purpose.
 */
export function alternativePractices(
  ctx: HomeContext,
  primary: PracticeRecommendation | null,
  count = 3,
): PracticeRecommendation[] {
  const experience = experienceFor(ctx);
  const base = ctx.preferredMinutes ?? primary?.requestedMinutes ?? 10;
  const shorter = snapToOfferedMinutes(Math.max(5, Math.round(base / 2)));
  const evening = ctx.hour >= 20 || ctx.hour < 4;
  /**
   * The focus actually on offer, including one chosen from "Change focus".
   * Reading only `intent` is why "Wake up instead — rather than settling"
   * appeared beside a "Just move" practice, which settles nothing.
   */
  const primaryNeed = ctx.preferredNeed ?? defaultNeedFor(ctx);
  const primaryLabel = needLabel(primaryNeed);

  /** A focus that genuinely asks less of the body than `primaryNeed`. */
  const gentlerNeed = GENTLER_THAN[primaryNeed] ?? null;
  /** A focus that genuinely contrasts with it. */
  const contrastNeed = CONTRAST_WITH[primaryNeed] ?? (evening ? "flexibility" : "energy");

  const candidates: (PracticeRecommendation | null)[] = [
    generatePractice({
      need: primaryNeed,
      minutes: shorter,
      experience,
      // Only claims "the same focus" when the primary was composed for it.
      reason: (mins) =>
        primary?.id.startsWith(`generated:${primaryNeed}:`)
          ? `The same ${primaryLabel} focus in ${mins} minutes, for a day with less room in it.`
          : `A ${mins}-minute ${primaryLabel} practice, for a day with less room in it.`,
      title: "A shorter version",
    }),
    gentlerNeed
      ? generatePractice({
          need: gentlerNeed,
          minutes: snapToOfferedMinutes(base),
          experience,
          reason: `${capitalize(needLabel(gentlerNeed))} instead of ${primaryLabel} — slower shapes and longer rests.`,
          title: "Something gentler",
        })
      : null,
    generatePractice({
      need: contrastNeed,
      minutes: snapToOfferedMinutes(base),
      experience,
      reason: `${capitalize(needLabel(contrastNeed))} instead of ${primaryLabel} — a different thing to ask of today.`,
      title: `${capitalize(needLabel(contrastNeed))} instead`,
    }),
    generatePractice({
      need: evening ? "sleep" : "flexibility",
      minutes: snapToOfferedMinutes(base),
      experience,
      reason: evening
        ? "A wind-down to come back to tonight."
        : "Longer holds in the hips and hamstrings.",
      title: evening ? "Before bed" : "Open the hips",
    }),
  ];

  const seen = new Set([primary?.id]);
  /** Same poses in the same order is the same practice, whatever it is called. */
  const signature = (r: PracticeRecommendation) => r.poses.map((p) => p.slug).join(">");
  const signatures = new Set(primary ? [signature(primary)] : []);
  const out: PracticeRecommendation[] = [];
  for (const c of candidates) {
    if (!c || seen.has(c.id)) continue;
    const sig = signature(c);
    // Offering the practice they are already looking at, under a different
    // heading, is not an alternative.
    if (signatures.has(sig)) continue;
    seen.add(c.id);
    signatures.add(sig);
    out.push(c);
    if (out.length === count) break;
  }
  return out;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function needLabel(need: string): string {
  return (NEED_LABEL[need] ?? need).toLowerCase();
}

/**
 * Which focus is honestly gentler than which. Null where there is nothing
 * gentler to offer — a calm practice has no calmer sibling, and saying
 * "something gentler" above an identical session is the claim this table
 * exists to prevent.
 */
const GENTLER_THAN: Record<string, string | null> = {
  strength: "movement",
  energy: "movement",
  movement: "flexibility",
  focus: "calm",
  flexibility: "calm",
  calm: null,
  sleep: null,
};

/** A focus that asks something genuinely different of the day. */
const CONTRAST_WITH: Record<string, string> = {
  calm: "energy",
  sleep: "energy",
  movement: "calm",
  flexibility: "strength",
  strength: "flexibility",
  energy: "calm",
  focus: "movement",
};
