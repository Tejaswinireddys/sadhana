import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { accountPlan, canAccessContent } from "../shared/entitlement";
import { ASANAS, PATHWAYS } from "../client/src/data/content";
import { MemoryStorage } from "./storage";
import { requireContentAccess, registerContentAccess } from "./contentAccess";

test("plans fail closed and existing catalogs default to free", () => {
  for (const user of [undefined, null, {}, { plan: "coach" }, { plan: "PLUS" }]) {
    assert.equal(accountPlan(user), "free");
  }
  assert.equal(accountPlan({ plan: "plus" }), "plus");
  assert.equal(canAccessContent("free", { isPlus: true }), false);
  assert.equal(canAccessContent("plus", { isPlus: true }), true);
  assert.equal(canAccessContent("free", { isPlus: false }), true);
  assert.ok([...ASANAS, ...PATHWAYS].every((row) => row.isPlus === false));
});

test("server uses stored plan and revokes access immediately after downgrade", async () => {
  const store = new MemoryStorage();
  const user = await store.createUser("plan@example.com", "hash");
  assert.equal(user.plan, "free");
  const app = express();
  app.use((req, _res, next) => {
    // Simulates identity already resolved by ownerMiddleware, not a plan header.
    if (req.get("x-test-user")) req.userId = user.id;
    next();
  });
  app.get("/locked", requireContentAccess({ isPlus: true }, store), (_req, res) => res.json({ ok: true }));
  app.get("/free", requireContentAccess({ isPlus: false }, store), (_req, res) => res.json({ ok: true }));
  registerContentAccess(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const guest = await fetch(`${base}/locked`, { headers: { "x-plan": "plus" } });
    assert.equal(guest.status, 403);
    assert.equal((await guest.json()).code, "PLUS_REQUIRED");
    const headers = { "x-test-user": "1" };
    assert.equal((await fetch(`${base}/locked`, { headers })).status, 403);
    await store.setUserPlan(user.id, "plus");
    assert.equal((await fetch(`${base}/locked`, { headers })).status, 200);
    await store.setUserPlan(user.id, "free");
    assert.equal((await fetch(`${base}/locked`, { headers })).status, 403);
    assert.equal((await fetch(`${base}/free`)).status, 200);
    assert.equal((await fetch(`${base}/api/content/poses/tadasana`)).status, 200);
    assert.equal((await fetch(`${base}/api/content/programs/front-splits`)).status, 200);
    ASANAS[0].isPlus = true;
    assert.equal((await fetch(`${base}/api/content/poses/${ASANAS[0].slug}`)).status, 403);
    assert.equal((await fetch(`${base}/api/poses/${ASANAS[0].slug}/media`)).status, 403);
    PATHWAYS[0].isPlus = true;
    assert.equal((await fetch(`${base}/api/content/classes/${PATHWAYS[0].slug}`)).status, 403);
    assert.equal((await fetch(`${base}/api/poses/class-${PATHWAYS[0].slug}/media`)).status, 403);
    assert.equal((await fetch(`${base}/api/content/programs/${PATHWAYS[0].slug}`)).status, 403);
  } finally {
    ASANAS[0].isPlus = false;
    PATHWAYS[0].isPlus = false;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
