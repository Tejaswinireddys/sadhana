/**
 * Acquisition quiz flows for /start.
 * Answers are enum ids only — never free text — so analytics stays privacy-safe.
 */

export type QuizOption = { id: string; label: string };

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: QuizOption[];
};

export type QuizFlow = {
  id: string;
  title: string;
  subtitle: string;
  questions: QuizQuestion[];
  /** Plan recommended after quiz completion (drives paywall price). */
  recommendedPlan: "plus" | "coach";
};

export const DEFAULT_FLOW_ID = "onboarding_v1";

export const QUIZ_FLOWS: Record<string, QuizFlow> = {
  [DEFAULT_FLOW_ID]: {
    id: DEFAULT_FLOW_ID,
    title: "Find your practice",
    subtitle: "Four quick questions — then a plan that fits how you actually move.",
    recommendedPlan: "plus",
    questions: [
      {
        id: "goal",
        prompt: "What do you want most from yoga right now?",
        options: [
          { id: "calm", label: "Feel calmer" },
          { id: "mobility", label: "Move more freely" },
          { id: "strength", label: "Build strength" },
          { id: "sleep", label: "Sleep better" },
        ],
      },
      {
        id: "experience",
        prompt: "How familiar are you with yoga?",
        options: [
          { id: "new", label: "Brand new" },
          { id: "some", label: "A little experience" },
          { id: "regular", label: "I practice regularly" },
        ],
      },
      {
        id: "time",
        prompt: "How much time do you usually have?",
        options: [
          { id: "10", label: "About 10 minutes" },
          { id: "20", label: "About 20 minutes" },
          { id: "30", label: "30 minutes or more" },
        ],
      },
      {
        id: "focus",
        prompt: "Where should we go gently?",
        options: [
          { id: "neck", label: "Neck & shoulders" },
          { id: "hips", label: "Hips & lower back" },
          { id: "full", label: "Full body, easy pace" },
          { id: "breath", label: "Breath & stillness" },
        ],
      },
    ],
  },
  pose_cta: {
    id: "pose_cta",
    title: "Turn this pose into a practice",
    subtitle: "A short check-in so we can build a session around what you need.",
    recommendedPlan: "plus",
    questions: [
      {
        id: "goal",
        prompt: "What brought you here today?",
        options: [
          { id: "learn_pose", label: "Learn this pose safely" },
          { id: "full_session", label: "A full guided session" },
          { id: "routine", label: "Start a daily routine" },
        ],
      },
      {
        id: "experience",
        prompt: "Your experience level?",
        options: [
          { id: "new", label: "Beginner" },
          { id: "some", label: "Intermediate" },
          { id: "regular", label: "Advanced" },
        ],
      },
      {
        id: "time",
        prompt: "Session length?",
        options: [
          { id: "10", label: "10 min" },
          { id: "20", label: "20 min" },
          { id: "30", label: "30+ min" },
        ],
      },
    ],
  },
};

/** Resolve flow from an explicit id or a marketing `ref` (e.g. pose-tadasana → pose_cta). */
export function resolveFlowId(flowId?: string | null, ref?: string | null): string {
  if (flowId && QUIZ_FLOWS[flowId]) return flowId;
  if (ref && /^pose[-_]/i.test(ref)) return "pose_cta";
  return DEFAULT_FLOW_ID;
}

export function getFlow(flowId: string): QuizFlow {
  return QUIZ_FLOWS[flowId] ?? QUIZ_FLOWS[DEFAULT_FLOW_ID];
}
