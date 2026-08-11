/**
 * Durable billing records for subscription compliance.
 * Entitlements + purchase snapshots use JSON maps; consent audit is append-only
 * JSONL (never rewritten) so the consent trail is effectively immutable.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { loadMap, saveMap } from "./jsonStore";

const DIR = resolve(process.cwd(), ".data");
const AUDIT_PATH = resolve(DIR, "billing-consent-audit.jsonl");
const SNAPSHOT_DIR = resolve(DIR, "billing-paywall-snapshots");

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
  /** Access continues until this ISO timestamp when cancel_at_period_end. */
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

const ENTITLEMENTS = "billing-entitlements";
const PURCHASES = "billing-purchases";
const PENDING_CONSENT = "billing-pending-consent";

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

function ensureDir(path: string) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

export function getEntitlement(ownerId: string): BillingEntitlement | undefined {
  return loadMap<BillingEntitlement>(ENTITLEMENTS).get(ownerId);
}

export function setEntitlement(ownerId: string, row: BillingEntitlement) {
  const map = loadMap<BillingEntitlement>(ENTITLEMENTS);
  map.set(ownerId, row);
  saveMap(ENTITLEMENTS, map);
}

export function allEntitlements(): Map<string, BillingEntitlement> {
  return loadMap<BillingEntitlement>(ENTITLEMENTS);
}

export function savePaywallSnapshot(html: string): string {
  ensureDir(SNAPSHOT_DIR);
  const id = `pw_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`;
  const safe = html.slice(0, 500_000); // hard cap
  writeFileSync(resolve(SNAPSHOT_DIR, `${id}.html`), safe, "utf8");
  return id;
}

export function readPaywallSnapshot(id: string): string | null {
  const path = resolve(SNAPSHOT_DIR, `${id}.html`);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

/** Append-only consent audit — never updates or deletes prior rows. */
export function appendConsentAudit(
  entry: Omit<ConsentAuditEntry, "id" | "ts"> & { id?: string; ts?: string },
): ConsentAuditEntry {
  ensureDir(DIR);
  const row: ConsentAuditEntry = {
    id: entry.id || `ca_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`,
    ts: entry.ts || new Date().toISOString(),
    ownerId: entry.ownerId,
    ip: entry.ip,
    userAgent: entry.userAgent,
    plan: entry.plan,
    interval: entry.interval,
    amount: entry.amount,
    currency: entry.currency,
    termsVersion: entry.termsVersion,
    priceDisplayed: entry.priceDisplayed,
    termsDisplayed: entry.termsDisplayed,
    paywallSnapshotId: entry.paywallSnapshotId,
    checkoutSessionId: entry.checkoutSessionId ?? null,
    stripeSubscriptionId: entry.stripeSubscriptionId ?? null,
  };
  appendFileSync(AUDIT_PATH, `${JSON.stringify(row)}\n`, "utf8");
  return row;
}

export function readConsentAudit(ownerId?: string): ConsentAuditEntry[] {
  if (!existsSync(AUDIT_PATH)) return [];
  const lines = readFileSync(AUDIT_PATH, "utf8").split("\n").filter(Boolean);
  const rows: ConsentAuditEntry[] = [];
  for (const line of lines) {
    try {
      const row = JSON.parse(line) as ConsentAuditEntry;
      if (!ownerId || row.ownerId === ownerId) rows.push(row);
    } catch {
      /* skip corrupt line */
    }
  }
  return rows;
}

export function setPendingConsent(ownerId: string, pending: PendingConsent) {
  const map = loadMap<PendingConsent>(PENDING_CONSENT);
  map.set(ownerId, pending);
  saveMap(PENDING_CONSENT, map);
}

export function takePendingConsent(ownerId: string): PendingConsent | undefined {
  const map = loadMap<PendingConsent>(PENDING_CONSENT);
  const row = map.get(ownerId);
  if (row) {
    map.delete(ownerId);
    saveMap(PENDING_CONSENT, map);
  }
  return row;
}

export function getPendingConsent(ownerId: string): PendingConsent | undefined {
  return loadMap<PendingConsent>(PENDING_CONSENT).get(ownerId);
}

export function savePurchase(record: PurchaseRecord) {
  const map = loadMap<PurchaseRecord>(PURCHASES);
  map.set(record.id, record);
  saveMap(PURCHASES, map);
}

export function purchasesForOwner(ownerId: string): PurchaseRecord[] {
  return [...loadMap<PurchaseRecord>(PURCHASES).values()]
    .filter((p) => p.ownerId === ownerId)
    .sort((a, b) => (a.chargedAt < b.chargedAt ? -1 : 1));
}

export function getPurchase(id: string): PurchaseRecord | undefined {
  return loadMap<PurchaseRecord>(PURCHASES).get(id);
}

export function updatePurchase(id: string, patch: Partial<PurchaseRecord>) {
  const map = loadMap<PurchaseRecord>(PURCHASES);
  const prev = map.get(id);
  if (!prev) return;
  map.set(id, { ...prev, ...patch });
  saveMap(PURCHASES, map);
}

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
