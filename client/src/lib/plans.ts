/**
 * Subscription tiers. Only Free exists today; the paid tiers are planned and
 * waitlisted. Stripe Checkout activates when STRIPE_SECRET_KEY (+ price IDs)
 * are set — until then nothing can be charged.
 */
export type PlanId = "free" | "plus" | "coach";

export type Plan = {
  id: PlanId;
  name: string;
  monthlyUsd: number;
  yearlyUsd: number;
  bullets: string[];
  /** Never paywalled */
  alwaysIncluded?: boolean;
  /**
   * "available" — works today. "planned" — priced, on a waitlist, and not for
   * sale: its bullets describe what it is meant to add, none of which exists
   * yet. A planned tier must never list something the free tier already does.
   */
  status: "available" | "planned";
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    monthlyUsd: 0,
    yearlyUsd: 0,
    alwaysIncluded: true,
    status: "available",
    bullets: [
      "Every feature that works today: all poses, guided sessions, programs and breathing",
      "The full pose safety library — modifications and what to avoid",
      "Progress, journal, export and delete",
      "Accessibility features and captions",
    ],
  },
  {
    id: "plus",
    name: "Sadhana Plus",
    monthlyUsd: 9.99,
    yearlyUsd: 79,
    status: "planned",
    bullets: [
      "Filmed movement demonstrations",
      "Full offline practice — sequences, timing and narration",
      "Advanced progress insights",
    ],
  },
  {
    id: "coach",
    name: "Coach",
    monthlyUsd: 14.99,
    yearlyUsd: 149,
    status: "planned",
    bullets: ["Everything planned for Plus", "Deeper assessments"],
  },
];

const PLAN_KEY = "sadhana.plan.preference";

export function readPreferredPlan(): PlanId {
  try {
    const v = localStorage.getItem(PLAN_KEY);
    if (v === "plus" || v === "coach" || v === "free") return v;
  } catch {
    /* ignore */
  }
  return "free";
}

export function writePreferredPlan(id: PlanId) {
  try {
    localStorage.setItem(PLAN_KEY, id);
  } catch {
    /* ignore */
  }
}
