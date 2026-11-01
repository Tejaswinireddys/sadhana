export type BillingInterval = "month" | "year";

export type BillingEntitlement = {
  plan: string;
  status: string;
  renewsAt: string | null;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  email?: string;
  interval?: BillingInterval;
  /** Major units (e.g. 9.99), matching what was shown on the paywall. */
  amount?: number;
  currency?: string;
  /** Access ends at this ISO timestamp when a cancel is pending (Stripe `cancel_at`, else period end). */
  accessUntil?: string | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string | null;
  firstChargedAt?: string | null;
  firstChargeAmount?: number | null;
  firstChargeCurrency?: string | null;
  firstInvoiceId?: string | null;
  firstPaymentIntentId?: string | null;
  refundedAt?: string | null;
  /** Period-end ISO we already sent a 3-day renewal reminder for. */
  lastReminderForRenewalAt?: string | null;
  /** Hash of one-click cancel token (raw token emailed, never stored). */
  cancelTokenHash?: string | null;
  termsVersion?: string;
  /** Id of paywall HTML snapshot captured at purchase. */
  paywallSnapshotId?: string | null;
  consentAuditId?: string | null;
  /** Last time these details were rebuilt from Stripe (webhook or resync). */
  stripeSyncedAt?: string | null;
};

export type ConsentAuditEntry = {
  id: string;
  ownerId: string;
  ts: string;
  ip: string;
  userAgent: string;
  plan: string;
  interval: BillingInterval;
  amount: number;
  currency: string;
  termsVersion: string;
  /** Exact price string shown (e.g. "$9.99/mo"). */
  priceDisplayed: string;
  /** Exact terms copy displayed at purchase. */
  termsDisplayed: string;
  paywallSnapshotId: string;
  checkoutSessionId?: string | null;
  stripeSubscriptionId?: string | null;
};

export type PurchaseRecord = {
  id: string;
  ownerId: string;
  plan: string;
  interval: BillingInterval;
  amount: number;
  currency: string;
  chargedAt: string;
  paywallSnapshotId: string;
  consentAuditId: string;
  stripeCheckoutSessionId?: string;
  stripeInvoiceId?: string;
  isFirstCharge: boolean;
  refundedAt?: string | null;
};

export type PendingConsent = {
  ownerId: string;
  plan: string;
  interval: BillingInterval;
  amount: number;
  currency: string;
  termsVersion: string;
  priceDisplayed: string;
  termsDisplayed: string;
  paywallSnapshotId: string;
  email?: string;
  createdAt: string;
  ip: string;
  userAgent: string;
};

export type AccountCancellation = {
  stripeSubscriptionId: string;
  canceledAt: string;
  reason: "account_deletion";
};

export type PaywallSnapshot = { id: string; html: string };
