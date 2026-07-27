import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, ownerIdForUser, readCookie, sessionExpiry } from "./auth";
import { MemoryStorage } from "./storage";

describe("password hashing", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const stored = await hashPassword("sun-salutation-8");
    assert.equal(await verifyPassword("sun-salutation-8", stored), true);
    assert.equal(await verifyPassword("sun-salutation-9", stored), false);
  });

  it("salts each hash so identical passwords differ at rest", async () => {
    assert.notEqual(await hashPassword("same-password"), await hashPassword("same-password"));
  });

  it("rejects a malformed stored hash instead of throwing", async () => {
    assert.equal(await verifyPassword("anything", "not-a-hash"), false);
  });
});

describe("cookies and session expiry", () => {
  it("reads one cookie out of a header", () => {
    const header = "sadhana_device=abc; sadhana_session=tok123; other=x";
    assert.equal(readCookie(header, "sadhana_session"), "tok123");
    assert.equal(readCookie(header, "missing"), undefined);
    assert.equal(readCookie(undefined, "sadhana_session"), undefined);
  });

  it("expires in the future", () => {
    assert.ok(new Date(sessionExpiry()).getTime() > Date.now());
  });
});

describe("account data ownership", () => {
  it("keeps guest and account data separate until merged", async () => {
    const store = new MemoryStorage();
    const device = "550e8400-e29b-41d4-a716-446655440000";
    const user = await store.createUser("maya@example.com", await hashPassword("password123"));
    const account = ownerIdForUser(user.id);

    await store.createSession(device, { date: "2026-07-01", durationMinutes: 20 } as never);
    assert.equal((await store.getSessions(account)).length, 0);

    const moved = await store.transferOwnerData(device, account);
    assert.ok(moved >= 1);
    assert.equal((await store.getSessions(account)).length, 1);
    assert.equal((await store.getSessions(device)).length, 0);
  });

  it("moves every kind of practice data, not just sessions", async () => {
    const store = new MemoryStorage();
    const device = "550e8400-e29b-41d4-a716-446655440001";
    const account = ownerIdForUser(1);

    await store.createSession(device, { date: "2026-07-02", durationMinutes: 15 } as never);
    await store.createJournal(device, { date: "2026-07-02", body: "calm" } as never);
    await store.addFavoriteAsana(device, "vrksasana");
    await store.activateProfile(device, "stress-relief");
    await store.upsertPoseNote(device, "tadasana", "ground down");
    await store.updatePreferences(device, { voiceEnabled: 0 });

    await store.transferOwnerData(device, account);

    assert.equal((await store.getJournal(account)).length, 1);
    assert.equal((await store.getFavoriteAsanas(account)).length, 1);
    assert.equal((await store.getActiveProfile(account))?.profileId, "stress-relief");
    assert.equal((await store.getPoseNote(account, "tadasana"))?.body, "ground down");
    assert.equal((await store.getPreferences(account)).voiceEnabled, 0);
    assert.equal(await store.countOwnerData(device), 0);
  });

  it("lets the incoming device win for single-row records", async () => {
    const store = new MemoryStorage();
    const device = "550e8400-e29b-41d4-a716-446655440002";
    const account = ownerIdForUser(2);

    await store.upsertPoseNote(account, "tadasana", "older account note");
    await store.upsertPoseNote(device, "tadasana", "newer device note");
    await store.activateProfile(account, "better-sleep");
    await store.activateProfile(device, "mens-strength");

    await store.transferOwnerData(device, account);

    assert.equal((await store.getPoseNote(account, "tadasana"))?.body, "newer device note");
    assert.equal((await store.getActiveProfile(account))?.profileId, "mens-strength");
  });

  it("finds a session by token and forgets it after sign out", async () => {
    const store = new MemoryStorage();
    await store.createAuthSession(7, "token-abc", sessionExpiry());
    assert.equal((await store.getAuthSession("token-abc"))?.userId, 7);
    await store.deleteAuthSession("token-abc");
    assert.equal(await store.getAuthSession("token-abc"), undefined);
  });
});
