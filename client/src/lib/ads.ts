/**
 * Who sees free-tier ads, and where. Pure, so the rule is unit-tested; the
 * `AdSlot` component only renders what this decides.
 *
 * Plus is decided with `hasPaidPlan` — the same rule `/plus` uses — so a
 * member whose cancel is scheduled stays ad-free until their access date, and
 * "unknown" (auth or entitlement still loading) renders nothing, so a member
 * never sees an ad flash before their plan is known.
 */
import type { AdsConfig } from "@shared/adsConfig";
import { hasPaidPlan, type PlusEntitlementView } from "@/lib/plusStatus";

export type AdEligibility = "show" | "hide" | "unknown";

export function adEligibility(input: {
  ads: Pick<AdsConfig, "enabled">;
  /** `undefined` while /api/auth/me is pending; `null` for a guest. */
  user: { plan?: string } | null | undefined;
  /** `undefined` while /api/billing/entitlement is pending. */
  entitlement: PlusEntitlementView | undefined;
  /** The entitlement request failed: plan cannot be confirmed. */
  entitlementError?: boolean;
  now?: number;
}): AdEligibility {
  if (!input.ads.enabled) return "hide";
  const { user, entitlement } = input;
  if (user === undefined) return "unknown";
  // users.plan is authoritative for accounts; no need to wait for billing.
  if (user?.plan === "plus") return "hide";
  if (input.entitlementError) return "hide"; // can't confirm free: err on the side of no ad
  if (entitlement === undefined) return "unknown";
  if (!hasPaidPlan(user, entitlement)) return "show";
  // A scheduled cancel keeps Plus until the access date; after it, they are free.
  const until = Date.parse(entitlement.accessUntil ?? "");
  if (entitlement.cancelAtPeriodEnd && Number.isFinite(until) && until <= (input.now ?? Date.now())) return "show";
  return "hide";
}

/**
 * Pages that never carry an ad, whatever a component asks for: buying,
 * account, billing and sign-in flows, the kids area, and the players.
 */
const NO_AD_PREFIXES = [
  "/plus", "/checkout", "/account", "/billing", "/cancel", "/signin", "/sign-in", "/login",
  "/register", "/signup", "/verify", "/reset", "/forgot", "/kids", "/guided", "/practice",
  "/welcome", "/start", "/privacy", "/terms", "/settings", "/instructor", "/pose-coach", "/health-disclaimer",
];

export function adsAllowedOnPath(path: string): boolean {
  const pathname = (path.split(/[?#]/)[0] || "/").replace(/\/+$/, "") || "/";
  return !NO_AD_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
