/** Billing compliance records use IStorage: Postgres in production, memory locally. */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { storage } from "./storage";
import type { BillingEntitlement, ConsentAuditEntry, PurchaseRecord, PendingConsent, AccountCancellation } from "../shared/billing";
export type { BillingInterval, BillingEntitlement, ConsentAuditEntry, PurchaseRecord, PendingConsent, AccountCancellation } from "../shared/billing";

export async function getEntitlement(ownerId: string): Promise<BillingEntitlement | undefined> {
  const row = await storage.getEntitlement(ownerId);
  const match = /^user:([1-9]\d*)$/.exec(ownerId);
  if (match) {
    const user = await storage.getUserById(Number(match[1]));
    if (!user) return undefined;
    return { ...structuredClone(row?.billingDetails || {}), plan: user.plan,
      status: row?.status || "active", renewsAt: row?.renewsAt ?? null,
    };
  }
  return structuredClone(row?.billingDetails ?? undefined);
}
export async function setEntitlement(ownerId: string, row: BillingEntitlement) {
  const match = /^user:([1-9]\d*)$/.exec(ownerId);
  const user = match ? await storage.getUserById(Number(match[1])) : undefined;
  if (match && !user) throw new Error("Billing owner no longer exists");
  const plan = user?.plan || row.plan;
  await storage.upsertEntitlement(ownerId, {
    plan, status: row.status, renewsAt: row.renewsAt,
    stripeCustomerId: row.stripeCustomerId || null,
    stripeSubscriptionId: row.stripeSubscriptionId || null,
    billingDetails: { ...row, plan },
  });
}
export async function allEntitlements(): Promise<Map<string, BillingEntitlement>> {
  const rows = await storage.listEntitlements();
  const result = new Map<string, BillingEntitlement>();
  for (const row of rows) {
    if (!row.billingDetails) continue;
    const detail = await getEntitlement(row.ownerId);
    if (detail) result.set(row.ownerId, detail);
  }
  return result;
}
export async function savePaywallSnapshot(html: string): Promise<string> {
  const id = `pw_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`;
  await storage.saveBillingPaywallSnapshot({ id, html: html.slice(0, 500_000) });
  return id;
}
export async function readPaywallSnapshot(id: string): Promise<string | null> {
  return storage.getBillingPaywallSnapshot(id);
}
/** Audit inserts never replace an existing ID, including during legacy import. */
export async function appendConsentAudit(entry: Omit<ConsentAuditEntry, "id" | "ts"> & { id?: string; ts?: string }): Promise<ConsentAuditEntry> {
  const row: ConsentAuditEntry = {
    ownerId: entry.ownerId, ip: entry.ip, userAgent: entry.userAgent,
    plan: entry.plan, interval: entry.interval, amount: entry.amount, currency: entry.currency,
    termsVersion: entry.termsVersion, priceDisplayed: entry.priceDisplayed,
    termsDisplayed: entry.termsDisplayed, paywallSnapshotId: entry.paywallSnapshotId,
    id: entry.id || `ca_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`,
    ts: entry.ts || new Date().toISOString(),
    checkoutSessionId: entry.checkoutSessionId ?? null,
    stripeSubscriptionId: entry.stripeSubscriptionId ?? null,
  };
  await storage.appendBillingConsentAudit(row);
  return row;
}
export async function readConsentAudit(ownerId?: string) { return storage.listBillingConsentAudit(ownerId); }
export async function setPendingConsent(ownerId: string, pending: PendingConsent) { await storage.saveBillingPendingConsent(ownerId, pending); }
export async function takePendingConsent(ownerId: string) { return storage.takeBillingPendingConsent(ownerId); }
export async function getPendingConsent(ownerId: string) { return storage.getBillingPendingConsent(ownerId); }
export async function savePurchase(record: PurchaseRecord) { await storage.saveBillingPurchase(record); }
export async function purchasesForOwner(ownerId: string) { return storage.listBillingPurchases(ownerId); }
export async function getPurchase(id: string) { return storage.getBillingPurchase(id); }
export async function updatePurchase(id: string, patch: Partial<PurchaseRecord>) { await storage.updateBillingPurchase(id, patch); }

const TOKEN_SECRET =
  process.env.BILLING_CANCEL_TOKEN_SECRET ||
  process.env.STRIPE_WEBHOOK_SECRET ||
  "sadhana-dev-cancel-token";

export function hashCancelToken(raw: string): string {
  return createHash("sha256").update(`${TOKEN_SECRET}:${raw}`).digest("hex");
}

export function issueCancelToken(): { raw: string; hash: string } {
  const raw = randomBytes(24).toString("base64url");
  return { raw, hash: hashCancelToken(raw) };
}

export function verifyCancelToken(raw: string, hash: string | null | undefined): boolean {
  if (!hash || !raw) return false;
  const a = Buffer.from(hashCancelToken(raw));
  const b = Buffer.from(hash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** First-charge refund window: 14 days. */
export const FIRST_CHARGE_REFUND_DAYS = 14;

export function refundEligible(ent: BillingEntitlement | undefined, now = Date.now()): boolean {
  if (!ent?.firstChargedAt || ent.refundedAt) return false;
  if (ent.plan === "free" && !ent.cancelAtPeriodEnd) {
    /* still allow if they canceled but within window and paid */
  }
  const charged = Date.parse(ent.firstChargedAt);
  if (!Number.isFinite(charged)) return false;
  const ms = FIRST_CHARGE_REFUND_DAYS * 86_400_000;
  return now - charged <= ms;
}

/** Renewal reminder: send when renewsAt is within (0, 3] days. */
export function needsRenewalReminder(
  ent: BillingEntitlement,
  now = Date.now(),
): boolean {
  if (!ent.renewsAt || ent.cancelAtPeriodEnd) return false;
  if (ent.plan === "free" || ent.status === "canceled") return false;
  const renewMs = Date.parse(ent.renewsAt);
  if (!Number.isFinite(renewMs)) return false;
  const days = (renewMs - now) / 86_400_000;
  if (days <= 0 || days > 3) return false;
  if (ent.lastReminderForRenewalAt === ent.renewsAt) return false;
  return true;
}


/** Cancellation confirmations share append-only audit storage, without an owner or email. */
export async function recordAccountCancellation(record: AccountCancellation): Promise<void> {
  await storage.appendBillingAccountCancellation(`bc_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`, record);
}
export async function deleteOwnerBillingData(ownerId: string): Promise<void> {
  await storage.deleteOwnerBillingData(ownerId);
}
