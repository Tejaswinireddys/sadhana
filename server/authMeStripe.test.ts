import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer, type Server } from "node:http";
import type Stripe from "stripe";

/**
 * The sidebar sat on "Account (loading)" for 6–20s.
 *
 * `/api/auth/me` never calls Stripe, but the on-read entitlement resync holds
 * a database transaction (two pooled connections and the user's row lock)
 * while it waits on Stripe. Enough of those at once took the whole pool
 * (pg's default is 10), and `/api/auth/me` — which also fanned out 13 queries
 * per call — queued behind Stripe. Measured on Postgres before the fix: with
 * ten stale Plus accounts loading Today, auth/me timed out at 8s.
 *
 * The first test runs everywhere (memory store). The second needs Postgres,
 * because the memory store serialises every read behind any open transaction
 * and so cannot model a pool: `BILLING_TEST_DATABASE_URL=… npm test`.
 */
const pgUrl = process.env.BILLING_TEST_DATABASE_URL;
if (pgUrl) process.env.DATABASE_URL = pgUrl; else delete process.env.DATABASE_URL;
process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
process.env.BILLING_ENABLED = "true";
const storageModule = await import("./storage");
storageModule.initStorage();
const { storage, pool } = storageModule;
if (pool) {
  const { readFile } = await import("node:fs/promises");
  await pool.query(await readFile(new URL("../drizzle/schema.sql", import.meta.url), "utf8"));
}
const { registerRoutes } = await import("./routes");
const { registerBillingRoutes, ENTITLEMENT_RESYNC_LIMITS } = await import("./billing");

/** A Stripe that takes `delayMs` to answer anything, then errors (a timeout). */
function slowStripe(delayMs: number) {
  const calls = { count: 0 };
  const slow = () => {
    calls.count += 1;
    return new Promise((_resolve, reject) => setTimeout(() => reject(new Error("Stripe timed out")), delayMs));
  };
  const stripe = { subscriptions: { retrieve: slow, list: slow }, customers: { retrieve: slow, create: slow } } as unknown as Stripe;
  return { stripe, calls };
}

async function harness(stripe: Stripe, accounts: number) {
  const app = express();
  app.use(express.json());
  const server: Server = createServer(app);
  await registerRoutes(server, app);
  registerBillingRoutes(app, stripe);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  // Plus accounts whose entitlements were never synced, so every read is stale.
  const cookies: string[] = [];
  const run = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  for (let i = 0; i < accounts; i++) {
    const user = await storage.createUser(`stale-${run}-${i}@example.test`, "hash");
    await storage.setUserPlan(user.id, "plus");
    await storage.upsertEntitlement(`user:${user.id}`, {
      plan: "plus", status: "active", stripeCustomerId: `cus_${run}_${i}`, stripeSubscriptionId: `sub_${run}_${i}`,
    });
    const token = `stale-session-${run}-${i}`;
    await storage.createAuthSession(user.id, token, new Date(Date.now() + 3_600_000).toISOString());
    cookies.push(`sadhana_session=${token}`);
  }
  const timed = async (path: string, cookie: string) => {
    const started = performance.now();
    const res = await fetch(`${base}${path}`, { headers: { cookie }, signal: AbortSignal.timeout(6_000) });
    return { ms: performance.now() - started, status: res.status, body: await res.json() };
  };
  const close = () => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
  return { cookies, timed, close };
}

test("/api/auth/me answers from the database and never calls Stripe, even for stale Plus entitlements", async () => {
  // If auth/me waited on Stripe at all, this one would take 30s.
  const { stripe, calls } = slowStripe(30_000);
  const h = await harness(stripe, 3);
  try {
    for (const cookie of h.cookies) {
      const me = await h.timed("/api/auth/me", cookie);
      assert.equal(me.status, 200);
      assert.equal(me.body.user.plan, "plus", "the plan comes from the users table");
      assert.ok(me.ms < 1_000, `auth/me took ${Math.round(me.ms)}ms`);
    }
    assert.equal(calls.count, 0, "auth/me made a Stripe call");
  } finally { await h.close(); }
});

test("Postgres: slow Stripe resyncs cannot starve /api/auth/me, and entitlement reads stop waiting", { skip: !pgUrl }, async () => {
  ENTITLEMENT_RESYNC_LIMITS.waitMs = 300;
  const { stripe, calls } = slowStripe(4_000);
  const h = await harness(stripe, 10);
  try {
    // Ten stale accounts open Today: Home and the cancel banner each read the entitlement.
    const reads = h.cookies.flatMap((cookie) => [h.timed("/api/billing/entitlement", cookie), h.timed("/api/billing/entitlement", cookie)]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const me = await Promise.all(h.cookies.map((cookie) => h.timed("/api/auth/me", cookie)));
    for (const result of me) {
      assert.equal(result.status, 200);
      assert.ok(result.ms < 1_000, `auth/me took ${Math.round(result.ms)}ms while Stripe was slow`);
    }
    for (const read of await Promise.all(reads)) {
      assert.equal(read.status, 200);
      assert.equal(read.body.plan, "plus", "stored state is served");
      assert.ok(read.ms < 1_500, `an entitlement read waited ${Math.round(read.ms)}ms on Stripe`);
    }
    assert.ok(calls.count <= ENTITLEMENT_RESYNC_LIMITS.maxConcurrent, `${calls.count} resyncs reached Stripe at once`);
    // Let the slow resyncs finish (and roll back) so the pool can close.
    await new Promise((resolve) => setTimeout(resolve, 4_500));
  } finally {
    await h.close();
  }
});

test.after(async () => { await pool?.end(); });
