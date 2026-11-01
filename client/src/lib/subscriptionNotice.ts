/**
 * The one billing notice Today shows, if any.
 *
 * Today used to render two components from the same entitlement: a
 * "Subscription canceled / You keep access until …" banner and a separate
 * "Subscription canceled — review your access end date" card. Both said
 * "canceled" about a plan that was still active. This decides a single
 * notice, and only calls it canceled once access has actually ended.
 */

export type EntitlementView = {
  plan: string;
  status?: string;
  cancelAtPeriodEnd?: boolean;
  accessUntil?: string | null;
};

export type SubscriptionNotice =
  /** Cancel scheduled, still Plus until `accessUntil`. */
  | { kind: "ending"; accessUntil: string }
  /** Access has ended (recently enough to still mention). */
  | { kind: "ended"; accessUntil: string }
  /** Active paid plan, no cancel scheduled: the two-tap cancel entry point. */
  | { kind: "cancel-cta" }
  | null;

/** How long after access ends Today still mentions it. */
export const ENDED_NOTICE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function parse(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : time;
}

export function subscriptionNotice(entitlement: EntitlementView | null | undefined, now = Date.now()): SubscriptionNotice {
  if (!entitlement || entitlement.status === "refunded") return null;
  const until = parse(entitlement.accessUntil);
  const canceled = !!entitlement.cancelAtPeriodEnd || entitlement.status === "canceled";

  if (canceled && until !== null && entitlement.accessUntil) {
    if (until > now && entitlement.plan !== "free") return { kind: "ending", accessUntil: entitlement.accessUntil };
    if (until <= now && now - until <= ENDED_NOTICE_DAYS * DAY_MS) return { kind: "ended", accessUntil: entitlement.accessUntil };
    if (until <= now) return null;
  }

  const paid = entitlement.plan !== "free" &&
    (entitlement.status === "active" || entitlement.status === "trialing");
  if (paid && !entitlement.cancelAtPeriodEnd) return { kind: "cancel-cta" };
  return null;
}

/** "December 1, 2026" in the viewer's locale and time zone. */
export function formatAccessDate(iso: string, locale?: string): string {
  const time = parse(iso);
  if (time === null) return iso;
  return new Date(time).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
}

/** The notice's words, kept here so they are tested with the rule. */
export function subscriptionNoticeCopy(notice: Exclude<SubscriptionNotice, null | { kind: "cancel-cta" }>, locale?: string) {
  const date = formatAccessDate(notice.accessUntil, locale);
  return notice.kind === "ending"
    ? { title: `Your Plus plan ends on ${date}.`, body: "You keep access until then. No further charges." }
    : { title: "Subscription canceled", body: `Your Plus access ended on ${date}.` };
}
