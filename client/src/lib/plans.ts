/**
 * Transparent subscription tiers.
 * Stripe Checkout activates when STRIPE_SECRET_KEY (+ price IDs) are set.
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
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    monthlyUsd: 0,
    yearlyUsd: 0,
    alwaysIncluded: true,
    bullets: [
      "Guest practice and full pose safety library",
      "Limited daily generated session",
      "Basic breathing, progress, export/delete",
      "Accessibility features and captions",
    ],
  },
  {
    id: "plus",
    name: "Sadhana Plus",
    monthlyUsd: 9.99,
    yearlyUsd: 79,
    bullets: [
      "Unlimited personalized sessions",
      "Structured outcome programs",
      "Full offline downloads",
      "Advanced progress insights",
      "Household profiles for two",
    ],
  },
  {
    id: "coach",
    name: "Coach",
    monthlyUsd: 14.99,
    yearlyUsd: 149,
    bullets: [
      "Everything in Plus",
      "On-device pose coach pilot",
      "Adaptive recovery suggestions",
      "Deeper assessments",
    ],
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
