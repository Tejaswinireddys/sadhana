import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { initStorage, storage, MemoryStorage } from "./storage";
import { migrateBillingEntitlements } from "./billing";

describe("MemoryStorage entitlements", () => {
  it("upserts and reads one entitlement per owner", async () => {
    const store = new MemoryStorage();
    const owner = "ent-owner-a";
    assert.equal(await store.getEntitlement(owner), undefined);

    const created = await store.upsertEntitlement(owner, {
      plan: "plus",
      status: "active",
      renewsAt: null,
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
    });
    assert.equal(created.plan, "plus");
    assert.equal(created.stripeCustomerId, "cus_test");

    const updated = await store.upsertEntitlement(owner, {
      plan: "coach",
      status: "active",
      renewsAt: "2026-09-01",
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test2",
    });
    assert.equal(updated.id, created.id);
    assert.equal(updated.plan, "coach");
    assert.equal((await store.getEntitlement(owner))?.plan, "coach");
  });

  it("isolates entitlements across owners and ping succeeds", async () => {
    const store = new MemoryStorage();
    await store.upsertEntitlement("a", {
      plan: "plus",
      status: "active",
      renewsAt: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    });
    assert.equal(await store.getEntitlement("b"), undefined);
    assert.equal(await store.ping(), true);
  });
});

describe("migrateBillingEntitlements", () => {
  const legacyPath = resolve(process.cwd(), ".data", "billing-entitlements.json");
  let wroteLegacy = false;

  before(() => {
    initStorage();
    mkdirSync(resolve(process.cwd(), ".data"), { recursive: true });
    writeFileSync(
      legacyPath,
      JSON.stringify({
        "migrate-owner-1": {
          plan: "plus",
          status: "active",
          renewsAt: null,
          stripeCustomerId: "cus_legacy",
        },
      }),
    );
    wroteLegacy = true;
  });

  after(() => {
    if (wroteLegacy && existsSync(legacyPath)) {
      try {
        unlinkSync(legacyPath);
      } catch {
        /* ignore cleanup races */
      }
    }
  });

  it("imports JSON file entitlements into storage once", async () => {
    assert.ok(storage instanceof MemoryStorage);
    const first = await migrateBillingEntitlements();
    assert.ok(first >= 1, `expected at least one import, got ${first}`);
    const row = await storage.getEntitlement("migrate-owner-1");
    assert.equal(row?.plan, "plus");
    assert.equal(row?.stripeCustomerId, "cus_legacy");

    const second = await migrateBillingEntitlements();
    assert.equal(second, 0, "second run must be idempotent");
  });
});
