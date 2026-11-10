/**
 * Subscription tiers. Whether Plus can be bought — and whether checkout is a
 * Stripe test or live one — comes from the server's configuration, never from
 * this file: see `billingCopy.ts` for the wording of each state.
 */
import { PLUS_CLASSES_BULLET } from "../data/classFormat";

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
    // Matches the live Stripe yearly price (price_1UWrZQ2NFlxWL0RyWmKP6woV).
    // Only shown when the server cannot read prices from Stripe.
    yearlyUsd: 59.99,
    status: "planned",
    // Only what Plus unlocks today. "Filmed movement demonstrations" and
    // "Full offline practice" were listed here while neither existed (the FAQ
    // says practice needs a connection), so a purchase would have bought them.
    bullets: [PLUS_CLASSES_BULLET, "Everything in Free"],
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
