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
  /** True once at least one session has been completed on this device/account. */
  hasPracticed: boolean;
  /** A short, gentle on-ramp for someone who has told us nothing yet. */
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
}): PracticeRecommendation {
  const session = composeTrainerSession(
    {
      body: ["Great"],
      soreParts: [],
      energy: "Balanced",
      timeMinutes: opts.minutes,
      need: opts.need,
    },
    { experience: opts.experience },
  );
  const label = opts.title ?? `${NEED_LABEL[opts.need] ?? "Your"} practice`;
  return {
    id: `generated:${opts.need}:${opts.minutes}`,
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
  // Someone who has told us nothing and practised nothing gets the reviewed
  // warm-up, not a composed "Strong / Intermediate" session generated from
  // defaults they never chose.
  const knowsNothing =
    !ctx.programDay && !ctx.quizPlan && !ctx.profile && !ctx.intent && !ctx.hasPracticed;
  if (knowsNothing && ctx.warmup && ctx.warmup.poses.length > 0) {
    return {
      id: "warmup",
      source: "generated",
      title: ctx.warmup.title,
      reason: "A gentle first practice — take the two-minute quiz any time for a plan of your own.",
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
export function adjustedPractice(
  ctx: HomeContext,
  adjust: { minutes: number | null; need: string | null },
): PracticeRecommendation {
  const need = adjust.need ?? defaultNeedFor(ctx);
  const requested = adjust.minutes ?? ctx.preferredMinutes ?? 10;
  const asked = snapToOfferedMinutes(requested);
  return generatePractice({
    need,
    minutes: asked,
    experience: ctx.experience ?? "new",
    reason: (mins) => {
      const focus = adjust.need
        ? `You asked for ${NEED_LABEL[need]?.toLowerCase() ?? "this focus"}`
        : "Your focus, at the length you asked for";
      const length =
        mins === asked
          ? `${mins} minutes`
          : `${mins} minutes — the closest a narrated ${NEED_LABEL[need]?.toLowerCase() ?? ""} sequence gets to ${asked}`.trim();
      return `${focus}, in ${length}.`;
    },
  });
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
  const primaryNeed = ctx.intent ? INTENT_NEED[ctx.intent] : evening ? "sleep" : "movement";

  const candidates: PracticeRecommendation[] = [
    generatePractice({
      need: primaryNeed,
      minutes: shorter,
      experience,
      reason: (mins) => `The same focus in ${mins} minutes, for a day with less room in it.`,
      title: "A shorter version",
    }),
    generatePractice({
      need: "calm",
      minutes: snapToOfferedMinutes(base),
      experience,
      reason: "Slower shapes and longer rests, if today asks for less effort.",
      title: "Something gentler",
    }),
    generatePractice({
      need: evening ? "flexibility" : "energy",
      minutes: snapToOfferedMinutes(base),
      experience,
      reason: evening
        ? "A different focus — opening rather than settling."
        : "A different focus — waking the body up rather than settling it.",
      title: evening ? "Open the hips instead" : "Wake up instead",
    }),
    generatePractice({
      need: "sleep",
      minutes: snapToOfferedMinutes(base),
      experience,
      reason: "A wind-down to come back to tonight.",
      title: "Before bed",
    }),
  ];

  const seen = new Set([primary?.id]);
  const out: PracticeRecommendation[] = [];
  for (const c of candidates) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
    if (out.length === count) break;
  }
  return out;
}
