/**
 * Every sentence the app says about buying Sadhana Plus, derived from the
 * server's real billing configuration. Pure so each state is unit-tested.
 *
 * Why: the live site ran with billing on in Stripe test mode while the landing
 * page still called Plus "planned but not on sale", and /plus showed a "Test
 * subscriptions" badge only when billing was *off*. Each screen had worked out
 * its own wording from a different flag. Screens now ask this module instead.
 *
 * - `disabled` — purchasing is unavailable; nothing can be charged.
 * - `test`     — checkout works, but only Stripe test cards; no real charges.
 * - `live`     — ordinary upgrade wording.
 */
import { PLANS } from "./plans";

export type BillingState = "disabled" | "test" | "live";

/** Billing is only "on" when the server says so; anything but explicit "live" is test. */
export function billingState(enabled: boolean, mode: unknown): BillingState {
  if (!enabled) return "disabled";
  return mode === "live" ? "live" : "test";
}

export type PlusPrices = { month: number; year: number };

const plus = PLANS.find((p) => p.id === "plus")!;
/** The catalog prices, used until the server's Stripe prices have loaded. */
export const CATALOG_PLUS_PRICES: PlusPrices = { month: plus.monthlyUsd, year: plus.yearlyUsd };

/** Prices from `/api/billing/config` when present, else the catalog's. */
export function plusPrices(config?: { prices?: { month?: { amount: number }; year?: { amount: number } } } | null): PlusPrices {
  return {
    month: config?.prices?.month?.amount ?? CATALOG_PLUS_PRICES.month,
    year: config?.prices?.year?.amount ?? CATALOG_PLUS_PRICES.year,
  };
}

/** "$9.99", "$90" — whole amounts without a trailing ".00". */
export function usd(amount: number): string {
  return `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

export function priceSentence(prices: PlusPrices): string {
  return `${usd(prices.month)}/month or ${usd(prices.year)}/year`;
}

export type BillingCopy = {
  state: BillingState;
  /** Short label next to the Plus plan name; `null` when nothing needs saying. */
  badge: string | null;
  /** Landing "Free today" card: the sentence about Plus. */
  landingPlus: string;
  landingPlusLink: string;
  /** /plus header. */
  plansIntro: string;
  /** /plus fallback status line when the server sent no note. */
  statusNote: string;
  /**
   * /plus Subscribe button. Still "Subscribe" while billing is off: signed-out
   * and unverified practitioners can use it to reach signup / verification.
   */
  subscribeLabel: string;
  /** /plus line under the subscription actions. */
  manageNote: string | null;
  /** Account-status line for a free or signed-out practitioner. */
  freeAccount: string;
  /** Plus-only content gate. */
  gateNote: string;
  gateCta: string;
  /** Help centre answer to "Can I buy Sadhana Plus?". */
  help: string;
};

export function billingCopy(state: BillingState, prices: PlusPrices = CATALOG_PLUS_PRICES): BillingCopy {
  const price = priceSentence(prices);
  switch (state) {
    case "disabled":
      return {
        state,
        badge: "Not on sale",
        landingPlus: `Sadhana Plus (${price}) adds the Plus video classes, but purchasing is unavailable right now, so nothing can be charged.`,
        landingPlusLink: "About Sadhana Plus",
        plansIntro: "Purchasing Sadhana Plus is unavailable right now, so nothing can be charged. Free practice and the safety library stay available.",
        statusNote: "Purchasing is unavailable right now.",
        subscribeLabel: "Subscribe",
        manageNote: null,
        freeAccount: "You're on the free plan. Purchasing Plus is unavailable right now.",
        gateNote: "This practice is for Plus members. Purchasing Plus is unavailable right now.",
        gateCta: "About Sadhana Plus",
        help: "Not right now — purchasing is unavailable on this server, so nothing can be charged. Everything free stays free.",
      };
    case "test":
      return {
        state,
        badge: "Test checkout",
        landingPlus: `Sadhana Plus (${price}) adds the Plus video classes. Checkout is in Stripe test mode: it only accepts Stripe test cards, and no real charges are made.`,
        landingPlusLink: "See Plus — test checkout",
        plansIntro: `Test checkout — no real charges. Plus checkout runs in Stripe test mode and only accepts Stripe test cards. Cancel in two taps from Home. The safety library stays free.`,
        statusNote: "Stripe test mode — use test cards only. No real charges.",
        subscribeLabel: "Subscribe (test checkout)",
        manageNote: "Cancel is two taps from Home. You can also manage or cancel in Stripe's test-mode portal — no real charges are made.",
        freeAccount: "You're on the free plan. Checkout is in Stripe test mode — no real charges.",
        gateNote: "This practice is for Plus members. Checkout is in Stripe test mode — no real charges.",
        gateCta: "Subscribe (test checkout)",
        help: `Checkout is open in Stripe test mode. It only accepts Stripe test cards and no real charges are made. Plus is listed at ${price}.`,
      };
    case "live":
      return {
        state,
        badge: null,
        landingPlus: `Sadhana Plus adds the Plus video classes for ${price}. Cancel in two taps from Home.`,
        landingPlusLink: "Upgrade to Plus",
        plansIntro: "Cancel in two taps from Home. Renewal reminder 3 days before every charge. First-charge refund within 14 days, auto-approved. The safety library stays free.",
        statusNote: "Manage or cancel anytime.",
        subscribeLabel: "Subscribe",
        manageNote: "Cancel is two taps from Home. You can also manage or cancel your subscription in the Stripe billing portal.",
        freeAccount: "You're on the free plan.",
        gateNote: "This practice is for Plus members.",
        gateCta: "Upgrade to Plus",
        help: `Yes. Sadhana Plus is ${price} and adds the Plus video classes. Cancel in two taps from Home; the first charge can be refunded within 14 days.`,
      };
  }
}
