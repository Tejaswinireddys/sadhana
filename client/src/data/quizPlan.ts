/**
 * Maps acquisition-quiz answers to a real guided pose queue.
 * BetterMe-style funnels often stop at a marketing “plan”; Sadhana loads practice.
 */
import { asanaBySlug } from "./content";
import { sessionMinutes, sessionSeconds, sessionTimeLabel } from "./quickSessions";
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

/** Trim or scale a pose list so wall-clock length matches the chosen budget. */
function fitToBudget(poses: QuizPose[], budget: "10" | "20" | "30"): QuizPose[] {
  const target = budget === "10" ? 10 : budget === "20" ? 20 : 28;
  let list = [...poses];
  // Drop middle poses (keep openers + closer) while too long.
  while (sessionMinutes(list) > target + 2 && list.length > 4) {
    const mid = Math.floor(list.length / 2) - 1;
    if (mid <= 0 || mid >= list.length - 2) break;
    list.splice(mid, 1);
  }
  for (let i = 0; i < 8; i++) {
    const mins = sessionMinutes(list);
    if (Math.abs(mins - target) <= 2) break;
    const secs = sessionSeconds(list);
    if (secs <= 0) break;
    const scale = Math.min(2.6, Math.max(0.65, (target * 60) / secs));
    list = list.map((p) => ({
      ...p,
      holdSeconds: Math.max(20, Math.round(p.holdSeconds * scale)),
    }));
  }
  return list;
}

export type SavedQuizPlan = Pick<
  BuiltQuizPlan,
  "title" | "minutes" | "timeLabel" | "poses" | "breathSlug" | "introPoseSlug" | "experience" | "intent"
>;

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
  };
}

export function parseProgramRef(search: string): Partial<QuizAnswers> | null {
  const ref = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("ref");
  if (!ref) return null;
  return PROGRAM_SEEDS[ref] ?? null;
}
