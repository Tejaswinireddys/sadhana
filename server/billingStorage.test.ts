import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { MemoryStorage, DatabaseStorage, type IStorage } from "./storage";
import type Stripe from "stripe";
import { processStripeWebhook } from "./stripeWebhook";
import { importLegacyBillingData } from "./billingMigration";
import type { PendingConsent, PurchaseRecord, ConsentAuditEntry } from "../shared/billing";

const pending: PendingConsent = { ownerId: "billing-owner", plan: "plus", interval: "month", amount: 9.99, currency: "USD", termsVersion: "v1", priceDisplayed: "$9.99/mo", termsDisplayed: "Renewal terms exactly as shown", paywallSnapshotId: "pw_fixture", email: "billing@example.com", createdAt: "2026-11-01T00:00:00Z", ip: "127.0.0.1", userAgent: "fixture" };
const audit: ConsentAuditEntry = { ...pending, id: "ca_fixture", ts: pending.createdAt, checkoutSessionId: "cs_fixture", stripeSubscriptionId: "sub_fixture" };
const purchase: PurchaseRecord = { id: "cs_fixture", ownerId: pending.ownerId, plan: pending.plan, interval: pending.interval, amount: pending.amount, currency: pending.currency, chargedAt: pending.createdAt, paywallSnapshotId: pending.paywallSnapshotId, consentAuditId: audit.id, isFirstCharge: true, refundedAt: null };

for (const backend of ["memory", "postgres"] as const) {
  describe(`billing storage (${backend})`, { skip: backend === "postgres" && !process.env.BILLING_TEST_DATABASE_URL }, () => {
    let store: IStorage;
    let root: Pool;
    let pool: Pool;
    let schema: string;
    before(async () => {
      if (backend === "memory") { store = new MemoryStorage(); return; }
      schema = `billing_test_${randomBytes(8).toString("hex")}`;
      root = new Pool({ connectionString: process.env.BILLING_TEST_DATABASE_URL });
      await root.query(`CREATE SCHEMA ${schema}`);
      pool = new Pool({ connectionString: process.env.BILLING_TEST_DATABASE_URL, options: `-c search_path=${schema}` });
      const ddl = await readFile(new URL("../drizzle/schema.sql", import.meta.url), "utf8");
      await pool.query(ddl);
      await pool.query(ddl); // Boot DDL must be safe to apply twice.
      store = new DatabaseStorage(drizzle(pool));
    });
    after(async () => {
      if (pool) await pool.end();
      if (root) { await root.query(`DROP SCHEMA ${schema} CASCADE`); await root.end(); }
    });
    it("pending consent is detached, owner-isolated, and consumed once under concurrency", async () => {
      await store.saveBillingPendingConsent(pending.ownerId, pending);
      const copy = await store.getBillingPendingConsent(pending.ownerId);
      copy!.amount = 0;
      assert.equal((await store.getBillingPendingConsent(pending.ownerId))?.amount, 9.99);
      assert.equal(await store.getBillingPendingConsent("other-owner"), undefined);
      const results = await Promise.all([store.takeBillingPendingConsent(pending.ownerId), store.takeBillingPendingConsent(pending.ownerId)]);
      assert.equal(results.filter(Boolean).length, 1);
      assert.equal(await store.takeBillingPendingConsent(pending.ownerId), undefined);
    });
    it("preserves exact HTML and immutable audit IDs, in append order", async () => {
      const html = "<main data-price='9.99'>α &amp; terms\nexact whitespace</main>";
      assert.equal(await store.saveBillingPaywallSnapshot({ id: "pw_immutable", html }), true);
      assert.equal(await store.saveBillingPaywallSnapshot({ id: "pw_immutable", html: "changed" }), false);
      assert.equal(await store.getBillingPaywallSnapshot("pw_immutable"), html);
      assert.equal(await store.getBillingPaywallSnapshot("missing"), null);
      await store.appendBillingConsentAudit(audit);
      assert.equal(await store.appendBillingConsentAudit({ ...audit, amount: 0 }), false);
      await store.appendBillingConsentAudit({ ...audit, id: "ca_backdated", ts: "2000-01-01" });
      const rows = await store.listBillingConsentAudit(pending.ownerId);
      assert.deepEqual(rows.map((row) => row.id), [audit.id, "ca_backdated"]);
      rows[0].amount = 1;
      assert.equal((await store.listBillingConsentAudit(pending.ownerId))[0].amount, 9.99);
      assert.deepEqual(await store.listBillingConsentAudit("other-owner"), []);
    });
    it("updates refunds without losing purchase fields or reordering equal timestamps", async () => {
      await store.saveBillingPurchase({ ...purchase, id: "z_first" });
      await store.saveBillingPurchase({ ...purchase, id: "a_second" });
      await store.updateBillingPurchase("z_first", { refundedAt: "2026-11-02" });
      assert.deepEqual((await store.listBillingPurchases(pending.ownerId)).map((row) => row.id), ["z_first", "a_second"]);
      assert.deepEqual(await store.getBillingPurchase("z_first"), { ...purchase, id: "z_first", refundedAt: "2026-11-02" });
      assert.deepEqual(await store.listBillingPurchases("other-owner"), []);
      await store.updateBillingPurchase("missing", { refundedAt: "today" });
      assert.equal(await store.getBillingPurchase("missing"), undefined);
    });
    it("keeps full entitlement details through Stripe core updates and retains anonymous cancellation records", async () => {
      const details = { plan: "plus", status: "active", renewsAt: null, amount: 9.99, interval: "month" as const, email: "billing@example.com", cancelTokenHash: "hash", cancelAtPeriodEnd: true, firstChargedAt: pending.createdAt };
      await store.upsertEntitlement("entitlement-owner", { plan: "plus", status: "active", billingDetails: details });
      await store.upsertEntitlement("entitlement-owner", { plan: "free", status: "canceled" });
      assert.deepEqual((await store.getEntitlement("entitlement-owner"))?.billingDetails, details);
      const cancellation = { stripeSubscriptionId: "sub_fixture", canceledAt: pending.createdAt, reason: "account_deletion" as const };
      await store.appendBillingAccountCancellation("bc_fixture", cancellation);
      await store.clearOwnerData("entitlement-owner");
      assert.equal(await store.getEntitlement("entitlement-owner"), undefined);
      assert.deepEqual(await store.listBillingAccountCancellations(), [cancellation]);
      assert.equal((await store.listBillingConsentAudit()).some((row) => row.id === "bc_fixture"), false);
    });
    it("cleans pending consent with owner data and preserves destination billing on transfer", async () => {
      await store.saveBillingPendingConsent("clear-owner", { ...pending, ownerId: "clear-owner" });
      await store.upsertEntitlement("clear-owner", { plan: "plus", status: "active" });
      await store.clearOwnerData("clear-owner", { preserveBilling: true });
      assert.ok(await store.getBillingPendingConsent("clear-owner"));
      await store.transferOwnerData("clear-owner", "target-owner");
      assert.equal(await store.getBillingPendingConsent("clear-owner"), undefined);
      assert.equal(await store.getEntitlement("clear-owner"), undefined);
      await store.saveBillingPendingConsent("clear-owner", { ...pending, ownerId: "clear-owner" });
      await store.clearOwnerData("clear-owner");
      assert.equal(await store.getBillingPendingConsent("clear-owner"), undefined);
    });
    it("imports all legacy formats once without overwriting newer destination data", async () => {
      const directory = await mkdtemp(join(tmpdir(), "billing-import-"));
      try {
        await mkdir(join(directory, "billing-paywall-snapshots"));
        const legacyPending = { ...pending, ownerId: "import-owner" };
        const legacyAudit = { ...audit, ownerId: "import-owner", id: "ca_import" };
        const legacyPurchase = { ...purchase, ownerId: "import-owner", id: "cs_import" };
        await writeFile(join(directory, "billing-pending-consent.json"), JSON.stringify({ "import-owner": legacyPending }));
        await writeFile(join(directory, "billing-purchases.json"), JSON.stringify({ cs_import: legacyPurchase }));
        await writeFile(join(directory, "billing-consent-audit.jsonl"), `${JSON.stringify(legacyAudit)}\n`);
        await writeFile(join(directory, "billing-entitlements.json"), JSON.stringify({ "import-owner": { plan: "plus", status: "active", renewsAt: null, email: "billing@example.com", cancelTokenHash: "legacy-hash" } }));
        await writeFile(join(directory, "billing-account-cancellations.jsonl"), JSON.stringify({ stripeSubscriptionId: "sub_import", canceledAt: pending.createdAt, reason: "account_deletion" }) + "\n");
        await writeFile(join(directory, "billing-paywall-snapshots/pw_import.html"), "<b>exact legacy terms</b>");
        const dryRun = await importLegacyBillingData(store, { directory, dryRun: true });
        assert.equal(dryRun.pending, 1);
        assert.equal(await store.getBillingPendingConsent("import-owner"), undefined);
        assert.equal(await store.getBillingPaywallSnapshot("pw_import"), null);
        const counts = await importLegacyBillingData(store, { directory });
        assert.deepEqual(counts, { entitlements: 1, pending: 1, purchases: 1, audit: 1, cancellations: 1, snapshots: 1 });
        await store.updateBillingPurchase("cs_import", { refundedAt: "newer-refund" });
        await store.saveBillingPendingConsent("import-owner", { ...legacyPending, termsVersion: "newer" });
        assert.deepEqual(await importLegacyBillingData(store, { directory }), { entitlements: 0, pending: 0, purchases: 0, audit: 0, cancellations: 0, snapshots: 0 });
        assert.equal((await store.getBillingPurchase("cs_import"))?.refundedAt, "newer-refund");
        assert.equal((await store.getBillingPendingConsent("import-owner"))?.termsVersion, "newer");
        assert.equal((await store.getEntitlement("import-owner"))?.billingDetails?.cancelTokenHash, "legacy-hash");
        assert.equal(await store.getBillingPaywallSnapshot("pw_import"), "<b>exact legacy terms</b>");
        assert.ok((await readFile(join(directory, "billing-consent-audit.jsonl"), "utf8")).includes("ca_import"));
        // Validate every source before writing even the valid map entries.
        await writeFile(join(directory, "billing-consent-audit.jsonl"), "not-json\n");
        await writeFile(join(directory, "billing-pending-consent.json"), JSON.stringify({ "invalid-import-owner": { ...legacyPending, ownerId: "invalid-import-owner" } }));
        await assert.rejects(importLegacyBillingData(store, { directory }), /line 1/);
        assert.equal(await store.getBillingPendingConsent("invalid-import-owner"), undefined);
        await writeFile(join(directory, "billing-pending-consent.json"), "not-json");
        await assert.rejects(importLegacyBillingData(store, { directory }), /billing-pending-consent.json/);
      } finally { await rm(directory, { recursive: true, force: true }); }
    });
    async function webhookFixture() {
      const suffix = randomBytes(6).toString("hex");
      const user = await store.createUser(`${suffix}@example.com`, "test-hash");
      const ownerId = `user:${user.id}`;
      const customerId = `cus_${suffix}`;
      const subscriptionId = `sub_${suffix}`;
      process.env.STRIPE_PRICE_MONTHLY = "price_contract";
      await store.upsertEntitlement(ownerId, { plan: "free", status: "inactive", stripeCustomerId: customerId, stripeSubscriptionId: null });
      let current = { id: subscriptionId, customer: customerId, livemode: false, status: "active", cancel_at_period_end: false,
        metadata: { ownerId: "user:999999", sadhanaPlan: "coach" },
        items: { data: [{ current_period_end: 2000000000, price: { id: "price_contract", unit_amount: 999, currency: "usd", recurring: { interval: "month" } } }] },
      };
      const client = { subscriptions: { retrieve: async () => structuredClone(current), list: async () => ({ data: [structuredClone(current)], has_more: false }) } } as unknown as Stripe;
      const event = { id: `evt_${suffix}`, type: "checkout.session.completed", livemode: false,
        data: { object: { id: `cs_${suffix}`, customer: customerId, subscription: subscriptionId, mode: "subscription", metadata: { ownerId: "user:999999", sadhanaPlan: "coach" } } },
      } as unknown as Stripe.Event;
      await store.saveBillingPaywallSnapshot({ id: `pw_${suffix}`, html: "exact checkout terms" });
      await store.saveBillingPendingConsent(ownerId, { ...pending, ownerId, paywallSnapshotId: `pw_${suffix}` });
      return { user, ownerId, customerId, subscriptionId, client, event, current, setCurrent: (value: typeof current) => { current = value; } };
    }
    it("deduplicates simultaneous event IDs, commits notifications once, and trusts no owner metadata", async () => {
      const f = await webhookFixture();
      const notified: string[] = [];
      const options = { notify: async (notification: { kind: string }) => {
        assert.ok(await store.getStripeEvent(f.event.id), "notifications run after commit");
        notified.push(notification.kind);
      } };
      const results = await Promise.all(Array.from({ length: 8 }, () => processStripeWebhook(f.client, store, f.event, options)));
      assert.equal(results.filter((result) => !result.duplicate).length, 1);
      assert.equal((await store.getUserById(f.user.id))?.plan, "plus");
      assert.equal((await store.getEntitlement(f.ownerId))?.plan, "free", "webhook must not write the legacy plan column");
      assert.equal((await store.listBillingPurchases(f.ownerId)).length, 1);
      assert.equal((await store.listBillingConsentAudit(f.ownerId)).length, 1);
      assert.deepEqual(notified, ["purchase_completed", "subscription_started"]);
      assert.equal(await store.getBillingPendingConsent(f.ownerId), undefined);
      // A distinct event for the same checkout also cannot duplicate its purchase/audit/email.
      await processStripeWebhook(f.client, store, { ...f.event, id: `${f.event.id}_second` }, options);
      assert.equal((await store.listBillingConsentAudit(f.ownerId)).length, 1);
      assert.equal(notified.length, 2);
    });
    it("rolls back event claim, user plan, purchase, consent consumption and audit on failure; retry succeeds", async () => {
      const f = await webhookFixture();
      const update = store.updateStripeEntitlement.bind(store);
      let updates = 0;
      const notifications: unknown[] = [];
      const alerts: unknown[] = [];
      const options = { notify: (event: unknown) => { notifications.push(event); }, alert: (error: unknown) => { alerts.push(error); } };
      store.updateStripeEntitlement = async (...args) => { await update(...args); if (++updates === 2) throw new Error("forced final billing failure"); };
      try { await assert.rejects(processStripeWebhook(f.client, store, f.event, options), /forced final billing failure/); }
      finally { store.updateStripeEntitlement = update; }
      assert.equal(await store.getStripeEvent(f.event.id), undefined);
      assert.equal((await store.getUserById(f.user.id))?.plan, "free");
      assert.equal((await store.getEntitlement(f.ownerId))?.status, "inactive");
      assert.ok(await store.getBillingPendingConsent(f.ownerId));
      assert.equal((await store.listBillingPurchases(f.ownerId)).length, 0);
      assert.equal((await store.listBillingConsentAudit(f.ownerId)).length, 0);
      assert.equal(notifications.length, 0);
      assert.equal(alerts.length, 1);
      await processStripeWebhook(f.client, store, f.event, options);
      assert.ok(await store.getStripeEvent(f.event.id));
      assert.equal((await store.getUserById(f.user.id))?.plan, "plus");
    });
    it("alerts on unmatched customer/user without marking processed or trusting valid-looking owner metadata", async () => {
      const f = await webhookFixture();
      await store.deleteOwnerBillingData(f.ownerId);
      const alerts: { error: unknown; eventId: string }[] = [];
      const options = { alert: (error: unknown, event: Stripe.Event) => { alerts.push({ error, eventId: event.id }); } };
      await assert.rejects(processStripeWebhook(f.client, store, f.event, options), /no matching user/);
      assert.equal(alerts.length, 1);
      assert.equal(alerts[0].eventId, f.event.id);
      assert.equal(await store.getStripeEvent(f.event.id), undefined);
      assert.equal((await store.getUserById(f.user.id))?.plan, "free");
      await store.upsertEntitlement("user:2147483000", { plan: "free", status: "inactive", stripeCustomerId: f.customerId });
      await assert.rejects(processStripeWebhook(f.client, store, f.event, options), /no matching user/);
      assert.equal(alerts.length, 2);
      await store.deleteOwnerBillingData("user:2147483000");
      // Repairing the stored binding allows Stripe to retry the same event.
      await store.upsertEntitlement(f.ownerId, { plan: "free", status: "inactive", stripeCustomerId: f.customerId });
      await processStripeWebhook(f.client, store, f.event, options);
      assert.ok(await store.getStripeEvent(f.event.id));
    });
    it("rejects duplicate Stripe customer/subscription ownership and permits multiple NULLs", async () => {
      const suffix = randomBytes(6).toString("hex");
      await store.upsertEntitlement(`unique_a_${suffix}`, { plan: "free", status: "inactive", stripeCustomerId: `cus_unique_${suffix}`, stripeSubscriptionId: `sub_unique_${suffix}` });
      await assert.rejects(store.upsertEntitlement(`unique_b_${suffix}`, { plan: "free", status: "inactive", stripeCustomerId: `cus_unique_${suffix}` }));
      await assert.rejects(store.upsertEntitlement(`unique_b_${suffix}`, { plan: "free", status: "inactive", stripeSubscriptionId: `sub_unique_${suffix}` }));
      await store.upsertEntitlement(`null_a_${suffix}`, { plan: "free", status: "inactive" });
      await store.upsertEntitlement(`null_b_${suffix}`, { plan: "free", status: "inactive" });
      assert.equal(await store.getEntitlement(`unique_b_${suffix}`), undefined);
    });
    it("does not capture unrelated operations in a failed transaction", async () => {
      const suffix = randomBytes(6).toString("hex");
      let entered!: () => void;
      let finish!: () => void;
      const started = new Promise<void>((resolve) => { entered = resolve; });
      const gate = new Promise<void>((resolve) => { finish = resolve; });
      const failed = store.runInTransaction(async () => {
        await store.saveBillingPaywallSnapshot({ id: `tx_${suffix}`, html: "rolled back" });
        entered(); await gate; throw new Error("rollback isolated transaction");
      });
      await started;
      const independent = store.saveBillingPaywallSnapshot({ id: `outside_${suffix}`, html: "committed independently" });
      finish();
      await assert.rejects(failed, /rollback isolated/);
      await independent;
      assert.equal(await store.getBillingPaywallSnapshot(`tx_${suffix}`), null);
      assert.equal(await store.getBillingPaywallSnapshot(`outside_${suffix}`), "committed independently");
    });
    it("serializes different event IDs for one user before retrieving Stripe state", async () => {
      const f = await webhookFixture();
      const active = structuredClone(f.current);
      let entered!: () => void;
      let finish!: () => void;
      const started = new Promise<void>((resolve) => { entered = resolve; });
      const gate = new Promise<void>((resolve) => { finish = resolve; });
      let retrieved = 0;
      let listed = 0;
      f.client.subscriptions.retrieve = (async () => {
        retrieved++;
        if (retrieved === 1) { entered(); await gate; return active; }
        return { ...active, status: "canceled" };
      }) as never;
      f.client.subscriptions.list = (async () => ({ data: [++listed === 1 ? active : { ...active, status: "canceled" }], has_more: false })) as never;
      const update = { ...f.event, type: "customer.subscription.updated", data: { object: active } } as unknown as Stripe.Event;
      const first = processStripeWebhook(f.client, store, update);
      await started;
      const second = processStripeWebhook(f.client, store, { ...update, id: `${update.id}_new` });
      await new Promise((resolve) => setTimeout(resolve, 20));
      assert.equal(retrieved, 1, "second event waits on the user binding lock");
      finish();
      await Promise.all([first, second]);
      assert.equal((await store.getUserById(f.user.id))?.plan, "free");
      assert.ok(await store.getStripeEvent(update.id));
      assert.ok(await store.getStripeEvent(`${update.id}_new`));
    });
    it("persists across independent storage instances (Postgres) and rolls back failed imports", async () => {
      if (backend === "memory") {
        assert.equal(await new MemoryStorage().getBillingPaywallSnapshot("pw_immutable"), null);
        return;
      }
      const other = new DatabaseStorage(drizzle(pool));
      assert.equal(await other.getBillingPaywallSnapshot("pw_immutable"), await store.getBillingPaywallSnapshot("pw_immutable"));
      await assert.rejects(store.runInTransaction(async () => {
        await store.saveBillingPaywallSnapshot({ id: "rolled_back", html: "never committed" });
        throw new Error("forced rollback");
      }), /forced rollback/);
      assert.equal(await other.getBillingPaywallSnapshot("rolled_back"), null);
      const directory = await mkdtemp(join(tmpdir(), "billing-cli-pg-"));
      try {
        await mkdir(join(directory, "billing-paywall-snapshots"));
        await writeFile(join(directory, "billing-paywall-snapshots/pw_cli.html"), "<p>CLI import</p>");
        const database = new URL(process.env.BILLING_TEST_DATABASE_URL!);
        database.searchParams.set("options", `-c search_path=${schema}`);
        if (!database.searchParams.has("sslmode")) database.searchParams.set("sslmode", "disable");
        const result = await promisify(execFile)(process.execPath, ["--import", "tsx", fileURLToPath(new URL("../script/migrate-billing.ts", import.meta.url)), "--directory", directory], {
          env: { ...process.env, DATABASE_URL: database.toString(), DOTENV_CONFIG_PATH: join(directory, "no-env") },
        });
        assert.match(result.stdout, /"snapshots":1/);
        assert.equal(await other.getBillingPaywallSnapshot("pw_cli"), "<p>CLI import</p>");
      } finally { await rm(directory, { recursive: true, force: true }); }

    });
  });
}


it("migration CLI validates without a DB and refuses to import into disposable memory", async () => {
  const directory = await mkdtemp(join(tmpdir(), "billing-cli-"));
  const script = fileURLToPath(new URL("../script/migrate-billing.ts", import.meta.url));
  const env = { ...process.env, DOTENV_CONFIG_PATH: join(directory, "no-env") };
  delete env.DATABASE_URL;
  try {
    await writeFile(join(directory, "billing-entitlements.json"), JSON.stringify({ "cli-owner": { plan: "free", status: "active", renewsAt: null } }));
    const execute = promisify(execFile);
    const result = await execute(process.execPath, ["--import", "tsx", script, "--directory", directory, "--dry-run"], { env });
    assert.match(result.stdout, /no writes/);
    assert.match(result.stdout, /"entitlements":1/);
    await assert.rejects(execute(process.execPath, ["--import", "tsx", script, "--directory", directory], { env }), /DATABASE_URL is required/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
