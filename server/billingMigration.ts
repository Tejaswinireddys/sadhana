/** File access is restricted to the explicit legacy import, never live billing reads/writes. */
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { IStorage } from "./storage";
import type { BillingEntitlement, PendingConsent, PurchaseRecord, ConsentAuditEntry, AccountCancellation } from "../shared/billing";

const text = z.string().min(1);
const money = z.number().finite();
const base = z.object({ ownerId: text, plan: text, interval: z.enum(["month", "year"]), amount: money, currency: text }).passthrough();
const pendingSchema = base.extend({ termsVersion: text, priceDisplayed: text, termsDisplayed: text, paywallSnapshotId: text, createdAt: text, ip: z.string(), userAgent: z.string(), email: z.string().optional() });
const purchaseSchema = base.extend({ id: text, chargedAt: text, paywallSnapshotId: text, consentAuditId: text, isFirstCharge: z.boolean() });
const auditSchema = base.extend({ id: text, ts: text, ip: z.string(), userAgent: z.string(), termsVersion: text, priceDisplayed: text, termsDisplayed: text, paywallSnapshotId: text });
const entitlementSchema = z.object({ plan: text, status: text, renewsAt: z.string().nullable().default(null) }).passthrough();
const cancellationSchema = z.object({ stripeSubscriptionId: text, canceledAt: text, reason: z.literal("account_deletion") }).passthrough();

async function readMap<T>(file: string, schema: z.ZodTypeAny): Promise<[string, T][]> {
  if (!existsSync(file)) return [];
  try {
    const obj = z.record(schema).parse(JSON.parse(await readFile(file, "utf8")));
    return Object.entries(obj) as [string, T][];
  } catch { throw new Error(`Invalid billing records in ${basename(file)}; no import performed`); }
}
async function readLines<T>(file: string, schema: z.ZodTypeAny): Promise<{ id: string; record: T }[]> {
  if (!existsSync(file)) return [];
  return (await readFile(file, "utf8")).split("\n").flatMap((line, index) => {
    if (!line.trim()) return [];
    try {
      const record = schema.parse(JSON.parse(line)) as T;
      return [{ id: `legacy_${createHash("sha256").update(`${basename(file)}:${index}:${line}`).digest("hex")}`, record }];
    } catch { throw new Error(`Invalid billing record in ${basename(file)} at line ${index + 1}; no import performed`); }
  });
}

/** Validate first, then import missing records during cutover without overwriting destination state. */
export async function importLegacyBillingData(store: IStorage, options: { directory?: string; onlyEntitlements?: boolean; dryRun?: boolean } = {}) {
  const directory = resolve(options.directory || ".data");
  const entitlements = await readMap<BillingEntitlement>(resolve(directory, "billing-entitlements.json"), entitlementSchema);
  const pending = options.onlyEntitlements ? [] : await readMap<PendingConsent>(resolve(directory, "billing-pending-consent.json"), pendingSchema);
  const purchases = options.onlyEntitlements ? [] : await readMap<PurchaseRecord>(resolve(directory, "billing-purchases.json"), purchaseSchema);
  const audit = options.onlyEntitlements ? [] : await readLines<ConsentAuditEntry>(resolve(directory, "billing-consent-audit.jsonl"), auditSchema);
  const cancellations = options.onlyEntitlements ? [] : await readLines<AccountCancellation>(resolve(directory, "billing-account-cancellations.jsonl"), cancellationSchema);
  const snapshots: { id: string; html: string }[] = [];
  const snapshotDirectory = resolve(directory, "billing-paywall-snapshots");
  if (!options.onlyEntitlements && existsSync(snapshotDirectory)) {
    for (const name of (await readdir(snapshotDirectory)).sort()) {
      if (name.endsWith(".html")) snapshots.push({ id: name.slice(0, -5), html: await readFile(resolve(snapshotDirectory, name), "utf8") });
    }
  }
  // Old maps keyed rows independently of their embedded ID. Preserve lookup semantics.
  for (const [id, record] of purchases) {
    if (record.id !== id) throw new Error(`Purchase key does not match ID: ${id}`);
  }
  for (const [ownerId, record] of pending) {
    if (record.ownerId !== ownerId) throw new Error(`Pending consent owner mismatch: ${ownerId}`);
  }
  if (options.dryRun) return { entitlements: entitlements.length, pending: pending.length, purchases: purchases.length, audit: audit.length, cancellations: cancellations.length, snapshots: snapshots.length };
  return store.runInTransaction(async () => {
    const counts = { entitlements: 0, pending: 0, purchases: 0, audit: 0, cancellations: 0, snapshots: 0 };
    for (const snapshot of snapshots) if (await store.saveBillingPaywallSnapshot(snapshot)) counts.snapshots++;
    for (const [ownerId, record] of entitlements) {
      const existing = await store.getEntitlement(ownerId);
      if (existing?.billingDetails) continue;
      await store.upsertEntitlement(ownerId, {
        plan: existing?.plan ?? record.plan, status: existing?.status ?? record.status,
        renewsAt: existing?.renewsAt ?? record.renewsAt,
        stripeCustomerId: existing?.stripeCustomerId ?? record.stripeCustomerId,
        stripeSubscriptionId: existing?.stripeSubscriptionId ?? record.stripeSubscriptionId,
        billingDetails: record,
      });
      counts.entitlements++;
    }
    for (const [ownerId, record] of pending) if (await store.saveBillingPendingConsent(ownerId, record, true)) counts.pending++;
    for (const [, record] of purchases) if (await store.saveBillingPurchase(record, true)) counts.purchases++;
    for (const { record } of audit) if (await store.appendBillingConsentAudit(record)) counts.audit++;
    for (const { id, record } of cancellations) if (await store.appendBillingAccountCancellation(id, record)) counts.cancellations++;
    return counts;
  });
}
