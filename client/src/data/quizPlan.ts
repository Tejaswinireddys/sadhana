/**
 * Maps acquisition-quiz answers to a real guided pose queue.
 * BetterMe-style funnels often stop at a marketing “plan”; Sadhana loads practice.
 */
import { asanaBySlug } from "./content";
import { sessionMinutes, sessionSeconds, sessionTimeLabel } from "./quickSessions";
import { TRANSITION_SECONDS } from "@/lib/guidedDuration";
import { MAX_HOLD_SECONDS as SCHEMA_MAX_HOLD_SECONDS } from "@shared/schema";
import {
  evaluateSessionFit,
  holdBudgetSeconds,
  maxPosesForBudget,
  nearestOfferedMinutes,
  sessionOverheadSeconds,
  type SessionFit,
} from "@/lib/sessionFit";
import {
  KEYS,
  readJson,
  writeJson,
  type ExperienceLevel,
  type PracticeIntent,
} from "@/lib/localPrefs";

export type QuizAnswers = {
  goal?: string;
  body?: string;
  experience?: string;
  time?: string;
  habit?: string;
};

export type QuizPose = {
  slug: string;
  holdSeconds: number;
  /** Matches guided session bilateral holds (`sessionMinutes` / player). */
  sides?: "each";
};

export type BuiltQuizPlan = {
  title: string;
  focus: string;
  experience: ExperienceLevel;
  intent: PracticeIntent;
  poses: QuizPose[];
  minutes: number;
  timeLabel: string;
  breathSlug?: string;
  introPoseSlug: string;
  poseNames: string[];
  /** The length asked for in the quiz, in minutes. */
  requestedMinutes: number;
  /** Whether the plan honours that request, and what to say when it cannot. */
  fit: SessionFit;
  /** A length that can hold this sequence, when the request cannot be met. */
  offerMinutes: number | null;
};

/** Program tile seeds from /welcome?ref=program-* */
export const PROGRAM_SEEDS: Record<string, Partial<QuizAnswers>> = {
  "program-morning": { goal: "calm", body: "full", time: "10", habit: "busy" },
  "program-desk": { goal: "mobility", body: "neck", time: "10", habit: "busy" },
  "program-sleep": { goal: "sleep", body: "breath", time: "20", habit: "energy" },
  "program-beginner": { goal: "calm", body: "full", experience: "new", time: "10", habit: "unsure" },
};

const HOLD = {
  short: { new: 25, some: 35, regular: 45 },
  medium: { new: 40, some: 55, regular: 70 },
  long: { new: 60, some: 80, regular: 100 },
  rest: { new: 75, some: 90, regular: 120 },
} as const;

function hold(
  kind: keyof typeof HOLD,
  experience: ExperienceLevel,
  timeBudget: "10" | "20" | "30",
): number {
  const base = HOLD[kind][experience];
  if (timeBudget === "10") return Math.round(base * 0.75);
  if (timeBudget === "30") return Math.round(base * 1.15);
  return base;
}

function templateFor(goal: string, body: string): { slugs: string[]; breathSlug?: string } {
  if (goal === "sleep" || body === "breath") {
    return {
      slugs: [
        "vajrasana",
        "salamba-balasana",
        "supta-baddha-konasana",
        "jathara-parivartanasana",
        "viparita-karani",
        "parsva-savasana",
        "savasana",
      ],
      breathSlug: "nadi-shodhana",
    };
  }
  if (goal === "strength") {
    return {
      slugs: [
        "tadasana",
        "utkatasana",
        "virabhadrasana-ii",
        "virabhadrasana-i",
        "adho-mukha-svanasana",
        "balasana",
        "savasana",
      ],
    };
  }
  if (goal === "mobility" || body === "hips") {
    return {
      slugs: [
        "tadasana",
        "uttanasana",
        "anjaneyasana",
        "eka-pada-rajakapotasana",
        "supta-padangusthasana",
        "jathara-parivartanasana",
        "balasana",
        "savasana",
      ],
    };
  }
  if (body === "neck") {
    return {
      slugs: [
        "sukhasana",
        "garudasana",
        "gomukhasana",
        "balasana",
        "matsyasana",
        "viparita-karani",
        "savasana",
      ],
    };
  }
  // calm / full default
  return {
    slugs: [
      "tadasana",
      "urdhva-hastasana",
      "uttanasana",
      "adho-mukha-svanasana",
      "balasana",
      "apanasana",
      "jathara-parivartanasana",
      "savasana",
    ],
    breathSlug: "nadi-shodhana",
  };
}

function titleFor(goal: string): string {
  const titles: Record<string, string> = {
    calm: "Your Calm Reset",
    mobility: "Your Mobility Flow",
    strength: "Your Steady Strength",
    sleep: "Your Better Sleep Ritual",
  };
  return titles[goal] || "Your Personal Practice";
}

function focusFor(body: string): string {
  const focuses: Record<string, string> = {
    neck: "neck and shoulders",
    hips: "hips and lower back",
    full: "your whole body",
    breath: "breath and stillness",
  };
  return focuses[body] || "your whole body";
}

function intentFor(goal: string): PracticeIntent {
  if (goal === "strength") return "strength";
  if (goal === "mobility") return "flexibility";
  if (goal === "sleep") return "sleep";
  if (goal === "calm") return "calm";
  return "explore";
}

function experienceFor(raw?: string): ExperienceLevel {
  if (raw === "some" || raw === "regular") return raw;
  return "new";
}

function timeFor(raw?: string): "10" | "20" | "30" {
  if (raw === "20" || raw === "30") return raw;
  return "10";
}

/** The shortest hold we will compose down to before dropping a pose instead. */
const MIN_HOLD_SECONDS = 20;

/**
 * Longest hold we will stretch a pose to while chasing a budget.
 *
 * The catalog's own `holdSeconds` is the reviewed hold for that shape. Doubling
 * it is a generous ceiling for a longer session; filling a 28-minute slot by
 * parking someone in Warrior II for five minutes is not "fitting the request",
 * it is an injury with a stopwatch. When the budget cannot be filled inside
 * this ceiling the plan stays short and `fit` says so.
 */
function safeMaxHold(slug: string): number {
  const catalogHold = asanaBySlug(slug)?.holdSeconds ?? 60;
  return Math.min(SCHEMA_MAX_HOLD_SECONDS, Math.max(MIN_HOLD_SECONDS, catalogHold * 2));
}

/**
 * Make the plan the length the practitioner asked for.
 *
 * The old version trimmed to no fewer than four poses and then stopped as soon
 * as it was "within two minutes", which is how a 10-minute answer produced a
 * 12-minute plan. Narration is 55–70s per pose and cannot be shortened, so the
 * count of poses — not the length of the holds — is what a short budget really
 * buys. Drop poses from the middle of the arc first (openers and the closing
 * rest are the practice), then scale the remaining holds onto the target.
 */
function fitToBudget(poses: QuizPose[], budget: "10" | "20" | "30"): QuizPose[] {
  const target = budget === "10" ? 10 : budget === "20" ? 20 : 28;
  const targetSeconds = target * 60;
  let list = [...poses];

  // How many poses can this budget carry with a real hold on each one?
  const perPoseOverhead =
    list.length > 0
      ? sessionOverheadSeconds(timedFor(list)) / list.length
      : TRANSITION_SECONDS + 60;
  const cap = maxPosesForBudget({
    targetSeconds,
    perPoseOverheadSeconds: perPoseOverhead,
    minHoldSeconds: MIN_HOLD_SECONDS,
    floor: 3,
    cap: list.length,
  });
  while (list.length > cap && list.length > 3) {
    const mid = Math.floor(list.length / 2) - 1;
    if (mid <= 0 || mid >= list.length - 1) break;
    list.splice(mid, 1);
  }

  for (let i = 0; i < 10; i++) {
    const secs = sessionSeconds(list);
    if (secs <= 0) break;
    if (Math.abs(secs - targetSeconds) <= 45) break;
    const holdSecs = list.reduce(
      (sum, p) => sum + p.holdSeconds * (p.sides === "each" ? 2 : 1),
      0,
    );
    const holdBudget = holdBudgetSeconds(targetSeconds, timedFor(list));
    if (holdSecs <= 0 || holdBudget <= 0) break;
    const scale = Math.min(2.6, Math.max(0.4, holdBudget / holdSecs));
    const next = list.map((p) => ({
      ...p,
      holdSeconds: Math.min(
        safeMaxHold(p.slug),
        Math.max(MIN_HOLD_SECONDS, Math.round(p.holdSeconds * scale)),
      ),
    }));
    // At the hold floor there is nothing left to trim; drop a pose instead.
    const stalled = sessionSeconds(next) >= secs && sessionSeconds(next) > targetSeconds;
    list = next;
    if (stalled && list.length > 3) {
      const mid = Math.floor(list.length / 2) - 1;
      if (mid > 0 && mid < list.length - 1) list.splice(mid, 1);
      else break;
    }
  }
  return list;
}

function timedFor(poses: QuizPose[]) {
  return poses.map((p) => ({
    holdSeconds: p.holdSeconds,
    sides: p.sides,
    slug: p.slug,
    stepCount: asanaBySlug(p.slug)?.steps.length ?? 0,
  }));
}

export type SavedQuizPlan = Pick<
  BuiltQuizPlan,
  "title" | "minutes" | "timeLabel" | "poses" | "breathSlug" | "introPoseSlug" | "experience" | "intent"
> & {
  savedAt?: string;
};

export function saveQuizPlan(plan: BuiltQuizPlan | SavedQuizPlan): void {
  writeJson<SavedQuizPlan>(KEYS.quizPlan, {
    title: plan.title,
    minutes: plan.minutes,
    timeLabel: plan.timeLabel,
    poses: plan.poses,
    breathSlug: plan.breathSlug,
    introPoseSlug: plan.introPoseSlug,
    experience: plan.experience,
    intent: plan.intent,
    savedAt: "savedAt" in plan && plan.savedAt ? plan.savedAt : new Date().toISOString(),
  });
}

export function readQuizPlan(): SavedQuizPlan | null {
  const raw = readJson<Partial<SavedQuizPlan> | null>(KEYS.quizPlan, null);
  if (!raw?.title || !Array.isArray(raw.poses) || raw.poses.length === 0) return null;
  return raw as SavedQuizPlan;
}

export function buildQuizPlan(answers: QuizAnswers): BuiltQuizPlan {
  const goal = answers.goal || "calm";
  const body = answers.body || "full";
  const experience = experienceFor(answers.experience);
  const timeBudget = timeFor(answers.time);
  const { slugs, breathSlug } = templateFor(goal, body);

  const raw: QuizPose[] = slugs.map((slug, i) => {
    const kind =
      i === 0
        ? "short"
        : i >= slugs.length - 2
          ? "rest"
          : i === 1
            ? "short"
            : "medium";
    const bilateral =
      slug.includes("virabhadrasana") ||
      slug === "anjaneyasana" ||
      slug === "eka-pada-rajakapotasana" ||
      slug === "supta-padangusthasana" ||
      slug === "gomukhasana";
    return {
      slug,
      holdSeconds: hold(kind, experience, timeBudget),
      ...(bilateral ? { sides: "each" as const } : {}),
    } satisfies QuizPose;
  });

  const poses = fitToBudget(raw, timeBudget).filter((p) => !!asanaBySlug(p.slug));
  const poseNames = poses
    .map((p) => asanaBySlug(p.slug)?.english)
    .filter((n): n is string => !!n)
    .slice(0, 5);

  const requestedMinutes = Number(timeBudget);
  const fit = evaluateSessionFit({
    requestedMinutes,
    poses: timedFor(poses),
    minHoldSeconds: poses.map(() => MIN_HOLD_SECONDS),
  });

  return {
    title: titleFor(goal),
    focus: focusFor(body),
    experience,
    intent: intentFor(goal),
    poses,
    minutes: sessionMinutes(poses),
    timeLabel: sessionTimeLabel(poses),
    breathSlug,
    introPoseSlug: poses[0]?.slug || "tadasana",
    poseNames,
    requestedMinutes,
    fit,
    offerMinutes: fit.fits ? null : nearestOfferedMinutes(fit.plannedMinutes, QUIZ_TIME_OPTIONS),
  };
}

/** The lengths the quiz offers, so an alternative is a real answer to re-pick. */
export const QUIZ_TIME_OPTIONS = [10, 20, 30];

export function parseProgramRef(search: string): Partial<QuizAnswers> | null {
  const ref = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("ref");
  if (!ref) return null;
  return PROGRAM_SEEDS[ref] ?? null;
}
