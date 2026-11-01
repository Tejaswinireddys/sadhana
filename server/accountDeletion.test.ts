import { after, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Stripe from "stripe";

// Live billing must work in an empty cwd without creating legacy .data files.
const originalDirectory = process.cwd();
const fixtureDirectory = mkdtempSync(join(tmpdir(), "sadhana-account-deletion-"));
process.chdir(fixtureDirectory);
after(() => {
  process.chdir(originalDirectory);
  try { assert.equal(existsSync(join(fixtureDirectory, ".data")), false); }
  finally { rmSync(fixtureDirectory, { recursive: true, force: true }); }
});
const stores = await import("./storage");
const { cancelSubscriptionsForAccountDeletion } = await import("./accountDeletion");
const { setEntitlement, getEntitlement } = await import("./billingStore");
const { registerRoutes } = await import("./routes");
const { hashPassword, authCookie, sessionExpiry } = await import("./auth");
const { entitlements } = await import("../shared/schema");

function mockStripe(status = "active", fail = false) {
  let current = { id: "sub_fixture", status, customer: "cus_fixture", livemode: false, canceled_at: null, cancel_at_period_end: true };
  const calls: string[] = [];
  const client = { subscriptions: {
    retrieve: async () => current,
    list: async () => ({ data: [current], has_more: false }),
    cancel: async (id: string, params: unknown) => {
      calls.push(id);
      assert.deepEqual(params, { invoice_now: false, prorate: false });
      if (fail) throw new Error("Stripe unavailable");
      current = { ...current, status: "canceled", canceled_at: 1800000000 as never };
      return current;
    },
  } } as unknown as Pick<Stripe, "subscriptions">;
  return { client, calls };
}

async function seed(store: InstanceType<typeof stores.MemoryStorage>, status = "active") {
  const user = await store.createUser("account@example.com", await hashPassword("password123"));
  const owner = `user:${user.id}`;
  await store.setUserPlan(user.id, "plus");
  await store.upsertEntitlement(owner, { plan: "plus", status, stripeCustomerId: "cus_fixture", stripeSubscriptionId: "sub_fixture" });
  await store.createAuthSession(user.id, "account-token", sessionExpiry());
  await store.createSession(owner, { date: "2026-11-01", durationMinutes: 10 } as never);
  return { user, owner };
}

test("active/trialing subscriptions, including scheduled cancellations, cancel immediately and are recorded", async () => {
  for (const status of ["active", "trialing"]) {
    const store = new stores.MemoryStorage();
    const { user, owner } = await seed(store, status);
    const { client, calls } = mockStripe(status);
    const records: unknown[] = [];
    await cancelSubscriptionsForAccountDeletion(user.id, store, client, (record) => records.push(record));
    assert.deepEqual(calls, ["sub_fixture"]);
    assert.deepEqual(records, [{ stripeSubscriptionId: "sub_fixture", canceledAt: new Date(1800000000000).toISOString(), reason: "account_deletion" }]);
    assert.equal((await store.getEntitlement(owner))?.status, "canceled");
    assert.equal((await store.getUserById(user.id))?.plan, "free");
    // A retry after a later deletion failure records confirmation without canceling twice.
    await cancelSubscriptionsForAccountDeletion(user.id, store, client, () => {});
    assert.deepEqual(calls, ["sub_fixture"]);
  }
});

test("free/no-subscription accounts do not require Stripe; failures preserve account and sessions", async () => {
  const store = new stores.MemoryStorage();
  const free = await store.createUser("free@example.com", "hash");
  await cancelSubscriptionsForAccountDeletion(free.id, store, null);
  const { user, owner } = await seed(store);
  await assert.rejects(cancelSubscriptionsForAccountDeletion(user.id, store, null), /unavailable/);
  const { client } = mockStripe("active", true);
  await assert.rejects(cancelSubscriptionsForAccountDeletion(user.id, store, client), /unavailable/);
  assert.ok(await store.getUserById(user.id));
  assert.ok(await store.getAuthSession("account-token"));
  assert.equal((await store.getSessions(owner)).length, 1);
  assert.equal((await store.getEntitlement(owner))?.status, "active");
  const inactive = mockStripe("incomplete_expired");
  await cancelSubscriptionsForAccountDeletion(user.id, store, inactive.client);
  assert.equal(inactive.calls.length, 0);
});

test("cleanup removes source entitlements while preserving destination billing", async () => {
  stores.initStorage();
  const store = stores.storage as InstanceType<typeof stores.MemoryStorage>;
  const row = { plan: "plus", status: "active", stripeSubscriptionId: "sub_source", stripeCustomerId: "cus_source" };
  await store.upsertEntitlement("source", row);
  await store.upsertEntitlement("destination", { ...row, stripeCustomerId: "cus_destination", stripeSubscriptionId: "sub_destination" });
  await setEntitlement("source", { ...row, renewsAt: null });
  await store.transferOwnerData("source", "destination");
  assert.equal(await store.getEntitlement("source"), undefined);
  assert.equal(await getEntitlement("source"), undefined);
  assert.equal((await store.getEntitlement("destination"))?.stripeSubscriptionId, "sub_destination");
  await store.transferOwnerData("destination", "destination");
  assert.ok(await store.getEntitlement("destination"));
  await store.clearOwnerData("destination", { preserveBilling: true });
  assert.ok(await store.getEntitlement("destination"));
  await store.clearOwnerData("destination");
  assert.equal(await store.getEntitlement("destination"), undefined);
});

test("database cleanup deletes entitlement rows for both clear and transfer", async () => {
  const deleted: unknown[] = [];
  const db = {
    delete: (table: unknown) => ({ where: async () => { deleted.push(table); } }),
    select: () => ({ from: () => ({ where: async () => [] }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
  };
  const store = new stores.DatabaseStorage(db as never);
  await store.clearOwnerData("database-source");
  assert.ok(deleted.includes(entitlements));
  deleted.length = 0;
  await store.transferOwnerData("database-source", "database-destination");
  assert.ok(deleted.includes(entitlements));
  deleted.length = 0;
  await store.clearOwnerData("database-source", { preserveBilling: true });
  assert.equal(deleted.includes(entitlements), false);
});

test("DELETE account authenticates first, aborts on Stripe failure, and deletes only after recorded cancellation", async () => {
  delete process.env.DATABASE_URL;
  stores.initStorage();
  const store = stores.storage as InstanceType<typeof stores.MemoryStorage>;
  const { user, owner } = await seed(store);
  const mock = mockStripe("trialing", true);
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server, app, { stripe: mock.client });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const cookie = authCookie("account-token", false).split(";")[0];
  const request = (password: string, authenticated = true) => fetch(`${base}/api/auth/account`, {
    method: "DELETE", headers: { "Content-Type": "application/json", ...(authenticated ? { Cookie: cookie } : {}) }, body: JSON.stringify({ password }),
  });
  try {
    assert.equal((await request("password123", false)).status, 401);
    assert.equal((await request("wrong-password")).status, 401);
    assert.deepEqual(mock.calls, []);
    const failed = await request("password123");
    assert.equal(failed.status, 502);
    assert.equal((await failed.json()).code, "SUBSCRIPTION_CANCELLATION_FAILED");
    assert.equal(failed.headers.get("set-cookie")?.includes("sadhana_session="), false);
    assert.ok(await store.getUserById(user.id));
    assert.ok(await store.getAuthSession("account-token"));
    assert.equal((await store.getSessions(owner)).length, 1);
    const success = mockStripe("trialing");
    mock.client.subscriptions.cancel = success.client.subscriptions.cancel;
    await setEntitlement(owner, { plan: "plus", status: "trialing", renewsAt: null, email: user.email, stripeSubscriptionId: "sub_fixture" });
    const deleteUser = store.deleteUser.bind(store);
    store.deleteUser = async (id) => {
      assert.equal((await store.listBillingAccountCancellations())[0]?.stripeSubscriptionId, "sub_fixture");
      assert.equal(success.calls.length, 1, "Stripe must finish before deleteUser");
      await deleteUser(id);
    };
    const deleted = await request("password123");
    assert.equal(deleted.status, 204);
    assert.deepEqual(success.calls, ["sub_fixture"]);
    const records = JSON.stringify(await store.listBillingAccountCancellations());
    assert.match(records, /sub_fixture/);
    assert.doesNotMatch(records, /account@example.com|user:/);
    assert.equal(await store.getUserById(user.id), undefined);
    assert.equal(await store.getEntitlement(owner), undefined);
    assert.equal(await getEntitlement(owner), undefined);
    assert.equal(await store.getAuthSession("account-token"), undefined);
    assert.equal((await store.getSessions(owner)).length, 0);
    assert.match(deleted.headers.get("set-cookie") || "", /sadhana_session=;/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});


test("customer-only records still cancel a subscription before the Checkout webhook arrives", async () => {
  const store = new stores.MemoryStorage();
  const { user, owner } = await seed(store);
  await store.upsertEntitlement(owner, { plan: "free", status: "inactive", stripeCustomerId: "cus_fixture", stripeSubscriptionId: null });
  const mock = mockStripe();
  mock.client.subscriptions.retrieve = (async () => { throw new Error("Must discover by customer"); }) as never;
  await cancelSubscriptionsForAccountDeletion(user.id, store, mock.client, () => {});
  assert.deepEqual(mock.calls, ["sub_fixture"]);
});

test("lookup and cancellation-record failures keep account data available for retry", async () => {
  const store = new stores.MemoryStorage();
  const { user, owner } = await seed(store);
  const lookup = mockStripe();
  lookup.client.subscriptions.retrieve = (async () => { throw new Error("Lookup failed"); }) as never;
  await assert.rejects(cancelSubscriptionsForAccountDeletion(user.id, store, lookup.client), /Lookup failed/);
  assert.deepEqual(lookup.calls, []);
  const audit = mockStripe();
  await assert.rejects(cancelSubscriptionsForAccountDeletion(user.id, store, audit.client, () => { throw new Error("Audit unavailable"); }), /Audit unavailable/);
  assert.ok(await store.getUserById(user.id));
  assert.ok(await store.getAuthSession("account-token"));
  assert.equal((await store.getSessions(owner)).length, 1);
});
