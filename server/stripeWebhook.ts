import type Stripe from "stripe";
import { randomBytes } from "node:crypto";
import type { IStorage } from "./storage";
import type { BillingEntitlement, ConsentAuditEntry } from "../shared/billing";
import { reconcileStripeCustomer, syncPlusEvent, stripeEventReferences, UnmatchedStripeUserError } from "./stripePlus";
import { subscriptionCancellation, subscriptionPeriodEnd } from "./stripeSubscriptionState";
import { issueCancelToken } from "./billingStore";
import { BILLING_TERMS_VERSION, DEFAULT_TERMS_DISPLAYED, priceLabel } from "./billingCompliance";
import { reportError } from "./errorReporting";

export type StripeWebhookNotification = {
  kind: "purchase_completed" | "subscription_started" | "subscription_cancelled" | "payment_failed";
  ownerId: string;
  email: string;
  plan: "free" | "plus";
  amount?: number;
  currency?: string;
  daysActive?: number;
  sessionsCompleted?: number;
};
export type StripeWebhookOptions = {
  notify?: (notification: StripeWebhookNotification) => void | Promise<unknown>;
  alert?: (error: unknown, event: Stripe.Event) => void | Promise<void>;
};

type Reconciled = NonNullable<Awaited<ReturnType<typeof reconcileStripeCustomer>>>;

/**
 * Subscription-derived billing details, shared by webhooks and resync so both
 * write identical state. Cancellation comes from `subscriptionCancellation`
 * (`cancel_at_period_end` OR `cancel_at`); a subscription that has ended keeps
 * the date it was cancelled even if Stripe's copy is gone.
 */
function subscriptionDetails({ stored, source, plan }: Reconciled): BillingEntitlement {
  const previous = stored.billingDetails || { plan, status: stored.status, renewsAt: stored.renewsAt };
  const periodEnd = subscriptionPeriodEnd(source);
  const cancellation = subscriptionCancellation(source);
  // Pending: Stripe's canceled_at, else when we first saw it. Ended: keep the
  // date we had. Active and not cancelling (incl. un-cancelled): none.
  const canceledAt = cancellation.canceledAt
    ?? (cancellation.cancelAtPeriodEnd ? previous.canceledAt || new Date().toISOString()
      : plan === "free" ? previous.canceledAt ?? null : null);
  return {
    ...previous, plan, status: source?.status || "inactive",
    renewsAt: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    stripeCustomerId: stored.stripeCustomerId || undefined,
    stripeSubscriptionId: source?.id || stored.stripeSubscriptionId || undefined,
    cancelAtPeriodEnd: cancellation.cancelAtPeriodEnd,
    accessUntil: cancellation.accessUntil,
    canceledAt,
    stripeSyncedAt: new Date().toISOString(),
  };
}

async function writeDetails(store: IStorage, ownerId: string, details: BillingEntitlement) {
  await store.updateStripeEntitlement(ownerId, { status: details.status, renewsAt: details.renewsAt, stripeCustomerId: details.stripeCustomerId, stripeSubscriptionId: details.stripeSubscriptionId, billingDetails: details });
}

/**
 * Rebuild one owner's entitlement from Stripe's current state. Corrects rows
 * written before `cancel_at` was understood (and any missed webhook). Returns
 * false when there is no Stripe customer to read from.
 */
export async function resyncStripeEntitlement(stripe: Stripe, store: IStorage, ownerId: string): Promise<boolean> {
  const row = await store.getEntitlement(ownerId);
  if (!row?.stripeCustomerId) return false;
  return store.runInTransaction(async () => {
    const matched = await reconcileStripeCustomer(stripe, store, {
      customerId: row.stripeCustomerId || undefined, subscriptionId: row.stripeSubscriptionId || undefined,
    });
    if (matched.ownerId !== ownerId) throw new UnmatchedStripeUserError(row.stripeCustomerId || undefined);
    await writeDetails(store, ownerId, subscriptionDetails(matched));
    console.info("[billing] Resynced entitlement from Stripe", { ownerId, status: matched.source?.status || "none" });
    return true;
  });
}

/** Claim + all database effects commit together; external notifications run only after commit. */
export async function processStripeWebhook(stripe: Stripe, store: IStorage, event: Stripe.Event, options: StripeWebhookOptions = {}) {
  if (event.livemode || !event.id || !event.type) throw new Error("Invalid test-mode Stripe event");
  const notifications: StripeWebhookNotification[] = [];
  try {
    const processed = await store.runInTransaction(async () => {
      if (!await store.claimStripeEvent(event.id, event.type)) {
        console.info("[billing] Ignored Stripe event: already processed", { eventId: event.id, eventType: event.type });
        return false;
      }
      const matched = await syncPlusEvent(stripe, store, event);
      if (!matched) {
        // Unsupported event types are acknowledged once.
        console.info("[billing] Ignored Stripe event: unsupported type", { eventId: event.id, eventType: event.type });
        return true;
      }
      const { user, ownerId, stored, source, plan } = matched;
      const previous = stored.billingDetails || { plan, status: stored.status, renewsAt: stored.renewsAt };
      let details: BillingEntitlement = subscriptionDetails(matched);
      const base = { ownerId, email: user.email, plan };
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        if (!await store.getBillingPurchase(session.id)) {
          const pending = await store.takeBillingPendingConsent(ownerId);
          const item = source?.items.data[0]?.price;
          const interval = pending?.interval || (item?.recurring?.interval === "year" ? "year" : "month");
          const amount = pending?.amount ?? (session.amount_total != null ? session.amount_total / 100 : (item?.unit_amount ?? 0) / 100);
          const currency = (pending?.currency || session.currency || item?.currency || "usd").toUpperCase();
          let snapshotId = pending?.paywallSnapshotId || session.metadata?.paywallSnapshotId;
          if (!snapshotId) {
            snapshotId = `pw_${randomBytes(12).toString("hex")}`;
            await store.saveBillingPaywallSnapshot({ id: snapshotId, html: "<!-- missing client snapshot; webhook placeholder -->" });
          }
          const audit: ConsentAuditEntry = {
            id: `ca_${session.id}`, ts: new Date().toISOString(), ownerId,
            ip: pending?.ip || "stripe-webhook", userAgent: pending?.userAgent || "stripe-webhook",
            plan: "plus", interval, amount, currency,
            termsVersion: pending?.termsVersion || BILLING_TERMS_VERSION,
            priceDisplayed: pending?.priceDisplayed || priceLabel(amount, currency, interval),
            termsDisplayed: pending?.termsDisplayed || DEFAULT_TERMS_DISPLAYED,
            paywallSnapshotId: snapshotId, checkoutSessionId: session.id,
            stripeSubscriptionId: stripeEventReferences(event)?.subscriptionId || null,
          };
          await store.appendBillingConsentAudit(audit);
          const isFirst = !previous.firstChargedAt;
          await store.saveBillingPurchase({ id: session.id, ownerId, plan: "plus", interval, amount, currency,
            chargedAt: audit.ts, paywallSnapshotId: snapshotId, consentAuditId: audit.id,
            stripeCheckoutSessionId: session.id, isFirstCharge: isFirst, refundedAt: null,
          });
          details = { ...details, email: user.email, interval, amount, currency,
            firstChargedAt: previous.firstChargedAt || audit.ts,
            firstChargeAmount: previous.firstChargeAmount ?? amount,
            firstChargeCurrency: previous.firstChargeCurrency || currency,
            cancelTokenHash: previous.cancelTokenHash || issueCancelToken().hash,
            termsVersion: audit.termsVersion, paywallSnapshotId: snapshotId, consentAuditId: audit.id,
          };
          notifications.push({ ...base, kind: "purchase_completed", amount, currency });
          if (plan === "plus") notifications.push({ ...base, kind: "subscription_started" });
        }
      }
      if (event.type === "invoice.paid") {
        const invoice = event.data.object as Stripe.Invoice & { payment_intent?: string | { id: string } };
        details = { ...details,
          firstChargedAt: previous.firstChargedAt || new Date().toISOString(),
          firstChargeAmount: previous.firstChargeAmount ?? invoice.amount_paid / 100,
          firstChargeCurrency: previous.firstChargeCurrency || invoice.currency.toUpperCase(),
          firstInvoiceId: previous.firstInvoiceId || invoice.id,
          firstPaymentIntentId: previous.firstPaymentIntentId || (typeof invoice.payment_intent === "string" ? invoice.payment_intent : invoice.payment_intent?.id) || null,
          email: previous.email || user.email,
        };
      }
      if (event.type === "invoice.payment_failed") notifications.push({ ...base, kind: "payment_failed" });
      if (event.type === "customer.subscription.deleted" && plan === "free") {
        const started = previous.firstChargedAt ? Date.parse(previous.firstChargedAt) : NaN;
        notifications.push({ ...base, kind: "subscription_cancelled", sessionsCompleted: (await store.getSessions(ownerId)).length,
          daysActive: Number.isFinite(started) ? Math.max(0, Math.floor((Date.now() - started) / 86400000)) : 0,
        });
      }
      await writeDetails(store, ownerId, details);
      console.info("[billing] Applied Stripe event", { eventId: event.id, eventType: event.type, ownerId,
        status: details.status, cancelAtPeriodEnd: details.cancelAtPeriodEnd, accessUntil: details.accessUntil });
      return true;
    });
    if (processed && options.notify) {
      for (const notification of notifications) {
        try { await options.notify(notification); }
        catch { console.error("[billing] Post-commit Stripe notification failed", event.id, notification.kind); }
      }
    }
    return { received: true, duplicate: !processed };
  } catch (error) {
    const references = stripeEventReferences(event);
    console.error("[billing] Stripe webhook failed", { eventId: event.id, eventType: event.type, ...references, error: error instanceof Error ? error.name : "unknown" });
    if (options.alert) {
      try { await options.alert(error, event); } catch { console.error("[billing] Stripe alert delivery failed", event.id); }
    } else {
      await reportError({ message: error instanceof UnmatchedStripeUserError ? "Unmatched Stripe webhook user" : "Stripe webhook processing failed",
        source: "server", path: "/api/billing/webhook", extra: { eventId: event.id, eventType: event.type, ...references },
      });
    }
    throw error;
  }
}
