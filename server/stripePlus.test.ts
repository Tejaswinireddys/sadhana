import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import Stripe from "stripe";
import { MemoryStorage, initStorage, storage } from "./storage";
import { checkoutForUser, isStripeTestKey, plusPrice, syncPlusEvent } from "./stripePlus";

process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_fixture";
process.env.STRIPE_PRICE_MONTHLY = "price_month";
process.env.STRIPE_PRICE_YEARLY = "price_year";
process.env.BILLING_ENABLED = "true";
process.env.PUBLIC_APP_URL = "http://localhost:5055";
const { registerBillingRoutes } = await import("./billing");

function fixture(ownerId: string) {
  let current = {
    id: "sub_test", customer: "cus_test", livemode: false,
    status: "active", cancel_at_period_end: false,
    metadata: { ownerId, sadhanaPlan: "plus" },
    items: { data: [{ price: { id: "price_month" }, current_period_end: 2000000000 }] },
  };
  let rows = [current];
  const calls: { checkout?: Stripe.Checkout.SessionCreateParams; portal?: { customer: string } } = {};
  const sdk = new Stripe("sk_test_fixture");
  const stripe = {
    webhooks: sdk.webhooks,
    prices: { retrieve: async (id: string) => ({
      id, active: true, livemode: false, currency: "usd", unit_amount: id === "price_year" ? 7900 : 999,
      type: "recurring", billing_scheme: "per_unit", recurring: { interval: id === "price_year" ? "year" : "month", interval_count: 1, usage_type: "licensed" },
    }) },
    customers: { create: async () => ({ id: "cus_test", livemode: false }) },
    checkout: { sessions: { create: async (params: Stripe.Checkout.SessionCreateParams) => {
      calls.checkout = params;
      return { id: "cs_test", url: "https://checkout.stripe.com/c/pay/cs_test" };
    } } },
    subscriptions: { retrieve: async () => current, list: async () => ({ data: rows, has_more: false }) },
    billingPortal: { sessions: { create: async (params: { customer: string }) => {
      calls.portal = params; return { url: "https://billing.stripe.com/p/session/test" };
    } } },
  } as unknown as Stripe;
  return { stripe, calls, current, setRows: (next: typeof rows) => { rows = next; },
    setCurrent: (next: typeof current) => { current = next; } };
}

let eventCounter = 0;
function event(type: string, object: unknown): Stripe.Event {
  return { id: `evt_${++eventCounter}_${type}`, type, livemode: false, data: { object } } as Stripe.Event;
}

test("only test keys and fixed recurring test prices are accepted", async () => {
  assert.equal(isStripeTestKey("sk_live_notallowed"), false);
  assert.equal(isStripeTestKey("sk_test_fixture"), true);
  const { stripe } = fixture("user:1");
  assert.equal((await plusPrice(stripe, "month")).amount, 9.99);
  stripe.prices.retrieve = (async () => ({ livemode: true })) as never;
  await assert.rejects(plusPrice(stripe, "month"));
});

test("Checkout uses configured monthly/yearly prices and server account identity", async () => {
  const store = new MemoryStorage();
  const user = await store.createUser("stripe@example.com", "hash");
  await store.markEmailVerified(user.id);
  const f = fixture(`user:${user.id}`);
  f.setRows([]);
  for (const interval of ["month", "year"] as const) {
    await checkoutForUser(f.stripe, store, user.id, interval, "http://localhost:5055", {});
    assert.equal(f.calls.checkout?.line_items?.[0].price, `price_${interval}`);
    assert.equal(f.calls.checkout?.metadata?.userId, String(user.id));
    assert.equal(f.calls.checkout?.customer, "cus_test");
    assert.equal(f.calls.checkout?.customer_email, undefined);
    assert.equal(f.calls.checkout?.subscription_data?.metadata?.ownerId, `user:${user.id}`);
    assert.equal((await store.getUserById(user.id))?.plan, "free");
  }
  f.setRows([f.current]);
  await assert.rejects(checkoutForUser(f.stripe, store, user.id, "month", "http://localhost:5055", {}), /already exists/);
});

test("webhook reconciliation handles renewal, cancellation, retries and late events", async () => {
  const store = new MemoryStorage();
  const user = await store.createUser("events@example.com", "hash");
  const f = fixture(`user:${user.id}`);
  await store.upsertEntitlement(`user:${user.id}`, { plan: "free", status: "inactive", stripeCustomerId: "cus_test", stripeSubscriptionId: null });
  const completed = event("checkout.session.completed", { mode: "subscription", subscription: "sub_test" });
  await syncPlusEvent(f.stripe, store, completed);
  await syncPlusEvent(f.stripe, store, completed);
  assert.equal((await store.getUserById(user.id))?.plan, "plus");
  f.current.cancel_at_period_end = true;
  await syncPlusEvent(f.stripe, store, event("customer.subscription.updated", f.current));
  assert.equal((await store.getUserById(user.id))?.plan, "plus");
  f.current.status = "past_due";
  await syncPlusEvent(f.stripe, store, event("customer.subscription.updated", f.current));
  assert.equal((await store.getUserById(user.id))?.plan, "free");
  f.current.status = "active";
  await syncPlusEvent(f.stripe, store, event("customer.subscription.updated", f.current));
  assert.equal((await store.getUserById(user.id))?.plan, "plus");
  f.current.status = "canceled";
  await syncPlusEvent(f.stripe, store, event("customer.subscription.deleted", f.current));
  await syncPlusEvent(f.stripe, store, completed);
  assert.equal((await store.getUserById(user.id))?.plan, "free", "old checkout must not regrant access");
  f.setRows([{ ...f.current, id: "sub_replacement", status: "active" }]);
  await syncPlusEvent(f.stripe, store, event("customer.subscription.deleted", f.current));
  assert.equal((await store.getUserById(user.id))?.plan, "plus", "old cancellation must not revoke a new subscription");
  f.setRows([{ ...f.current, status: "active", items: { data: [{ price: { id: "price_unrelated" }, current_period_end: 2000000000 }] } }]);
  await syncPlusEvent(f.stripe, store, completed);
  assert.equal((await store.getUserById(user.id))?.plan, "free");
});

test("billing HTTP routes require auth, verify raw signatures and use durable portal ownership", async () => {
  initStorage();
  const user = await storage.createUser("http-stripe@example.com", "hash");
  const f = fixture(`user:${user.id}`);
  f.setRows([]);
  const app = express();
  app.use(express.json({ verify: (req, _res, body) => { (req as express.Request).rawBody = body; } }));
  app.use((req, _res, next) => {
    if (req.get("x-test-user")) req.userId = user.id;
    req.ownerId = req.userId ? `user:${user.id}` : "guest-test";
    next();
  });
  const alerts: unknown[] = [];
  registerBillingRoutes(app, f.stripe, { alert: (error) => { alerts.push(error); } });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const headers = { "Content-Type": "application/json", "x-test-user": "1" };
  const post = (path: string, data: unknown, h = headers) => fetch(`${base}/api/billing/${path}`, { method: "POST", headers: h, body: JSON.stringify(data) });
  const sendEvent = (e: Stripe.Event) => {
    const payload = JSON.stringify(e);
    const signature = f.stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_fixture" });
    return fetch(`${base}/api/billing/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": signature }, body: payload });
  };
  try {
    assert.equal((await post("checkout", { interval: "month" }, { "Content-Type": "application/json" } as typeof headers)).status, 401);
    const unverified = await post("checkout", { plan: "plus", interval: "month" });
    assert.equal(unverified.status, 403);
    process.env.BILLING_ENABLED = "false";
    try { assert.equal((await post("checkout", { interval: "month" })).status, 403); }
    finally { process.env.BILLING_ENABLED = "true"; }
    assert.match((await unverified.json()).error, /Verify your email/);
    assert.equal(f.calls.checkout, undefined);
    assert.equal(await storage.getEntitlement(`user:${user.id}`), undefined);
    await storage.markEmailVerified(user.id);
    assert.equal((await post("checkout", { plan: "coach", interval: "month" })).status, 400);
    assert.equal((await post("checkout", { interval: "fortnight" })).status, 400);
    assert.equal((await post("checkout", { interval: "month" })).status, 400);
    assert.equal((await post("consent", { plan: "plus", interval: "month", amount: 9.99, currency: "USD", paywallHtml: "<main>Plus recurring subscription consent snapshot</main>" })).status, 200);
    assert.equal((await post("checkout", { plan: "plus", interval: "month", userId: 999 })).status, 200);
    assert.equal((await post("portal", {})).status, 200);
    assert.equal(f.calls.portal?.customer, "cus_test");
    assert.equal((await post("portal", {}, { "Content-Type": "application/json" } as typeof headers)).status, 401);
    assert.equal((await post("webhook", { type: "checkout.session.completed" })).status, 400);
    const e = event("checkout.session.completed", { id: "cs_test", mode: "subscription", subscription: "sub_test", customer: "cus_test", metadata: { ownerId: `user:${user.id}` } });
    assert.equal((await sendEvent({ ...e, livemode: true })).status, 400);
    f.setRows([f.current]);
    assert.equal((await sendEvent(e)).status, 200);
    assert.equal((await storage.getUserById(user.id))?.plan, "plus");
    f.current.status = "canceled";
    assert.equal((await sendEvent(event("customer.subscription.deleted", f.current))).status, 200);
    assert.equal((await storage.getUserById(user.id))?.plan, "free");
    await storage.deleteUser(user.id);
    assert.equal((await sendEvent(event("customer.subscription.deleted", f.current))).status, 503);
    assert.equal((await sendEvent({ ...e, id: "evt_deleted_user_checkout" })).status, 503);
    assert.equal(alerts.length, 2);
    assert.equal(await storage.getEntitlement(`user:${user.id}`), undefined, "late webhooks must not recreate deleted entitlements");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("users.plan overrides stale entitlement plan fields on billing reads", async () => {
  initStorage();
  const user = await storage.createUser("canonical@example.com", "hash");
  const ownerId = `user:${user.id}`;
  const { getEntitlement } = await import("./billingStore");
  await storage.upsertEntitlement(ownerId, { plan: "plus", status: "active", billingDetails: { plan: "plus", status: "active", renewsAt: null } });
  assert.equal((await getEntitlement(ownerId))?.plan, "free");
  await storage.setUserPlan(user.id, "plus");
  await storage.upsertEntitlement(ownerId, { plan: "free", status: "active", billingDetails: { plan: "free", status: "active", renewsAt: null } });
  assert.equal((await getEntitlement(ownerId))?.plan, "plus");
});

test("webhook bypasses write throttling but still verifies every signature; adjacent paths stay limited", async () => {
  initStorage();
  const { mountSecurity } = await import("./security");
  const app = express();
  mountSecurity(app);
  app.use(express.json({ verify: (req, _res, body) => { (req as express.Request).rawBody = body; } }));
  const sdk = new Stripe("sk_test_fixture");
  let alerts = 0;
  registerBillingRoutes(app, sdk, { alert: () => { alerts++; } });
  app.post("/api/billing/webhook-extra", (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const body = JSON.stringify(event("customer.created", { id: "cus_unrelated" }));
  const signature = sdk.webhooks.generateTestHeaderString({ payload: body, secret: "whsec_fixture" });
  try {
    for (let index = 0; index < 95; index++) {
      const response = await fetch(`${base}/api/billing/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": signature }, body });
      assert.equal(response.status, 200, `signed delivery ${index}`);
    }
    for (let index = 0; index < 95; index++) {
      const response = await fetch(`${base}/api/billing/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": "invalid" }, body });
      assert.equal(response.status, 400, `unsigned delivery ${index}`);
    }
    let limited = false;
    for (let index = 0; index < 95; index++) {
      const response = await fetch(`${base}/api/billing/webhook-extra`, { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: "{}" });
      if (response.status === 429) limited = true;
      else assert.equal(response.status, 200);
    }
    assert.equal(limited, true);
    assert.equal(alerts, 0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});


test("unverified accounts cannot create Stripe customers or Checkout sessions", async () => {
  const store = new MemoryStorage();
  const user = await store.createUser("unverified-checkout@example.com", "hash");
  const f = fixture(`user:${user.id}`);
  f.stripe.customers.create = (async () => { throw new Error("must not call Stripe"); }) as never;
  await assert.rejects(checkoutForUser(f.stripe, store, user.id, "month", "http://localhost:5055", {}), /Verify your email/);
  assert.equal(f.calls.checkout, undefined);
  assert.equal(await store.getEntitlement(`user:${user.id}`), undefined);
});

test("customer.subscription.updated with cancel_at_period_end surfaces the end date on /api/billing/entitlement", async () => {
  initStorage();
  const user = await storage.createUser("pending-cancel@example.com", "hash");
  await storage.markEmailVerified(user.id);
  const ownerId = `user:${user.id}`;
  const f = fixture(ownerId);
  await storage.upsertEntitlement(ownerId, { plan: "free", status: "inactive", stripeCustomerId: "cus_test", stripeSubscriptionId: null });
  const app = express();
  app.use(express.json({ verify: (req, _res, body) => { (req as express.Request).rawBody = body; } }));
  app.use((req, _res, next) => { req.userId = user.id; req.ownerId = ownerId; next(); });
  registerBillingRoutes(app, f.stripe, { alert: () => undefined });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const sendEvent = (e: Stripe.Event) => {
    const payload = JSON.stringify(e);
    const signature = f.stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_fixture" });
    return fetch(`${base}/api/billing/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": signature }, body: payload });
  };
  const entitlement = async () => (await fetch(`${base}/api/billing/entitlement`)).json() as Promise<{
    plan: string; status: string; cancelAtPeriodEnd: boolean; accessUntil: string | null; renewsAt: string | null;
  }>;
  const periodEnd = new Date(2000000000 * 1000).toISOString();
  try {
    assert.equal((await sendEvent(event("checkout.session.completed", { id: "cs_pending", mode: "subscription", subscription: "sub_test", customer: "cus_test" }))).status, 200);
    let body = await entitlement();
    assert.equal(body.plan, "plus");
    assert.equal(body.cancelAtPeriodEnd, false);
    assert.equal(body.accessUntil, null);

    // Cancel in the Stripe portal: access continues to the period end.
    f.current.cancel_at_period_end = true;
    assert.equal((await sendEvent(event("customer.subscription.updated", f.current))).status, 200);
    body = await entitlement();
    assert.equal(body.plan, "plus", "a pending cancellation keeps access");
    assert.equal(body.status, "active");
    assert.equal(body.cancelAtPeriodEnd, true);
    assert.equal(body.accessUntil, periodEnd);
    assert.equal(body.renewsAt, periodEnd);

    // Resuming in the portal clears it again.
    f.current.cancel_at_period_end = false;
    assert.equal((await sendEvent(event("customer.subscription.updated", f.current))).status, 200);
    body = await entitlement();
    assert.equal(body.cancelAtPeriodEnd, false);
    assert.equal(body.accessUntil, null);
  } finally {
    f.current.cancel_at_period_end = false;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
