import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MemoryStorage } from "./storage";
import { computeStats } from "./routes";

describe("MemoryStorage owner isolation", () => {
  it("keeps sessions private per ownerId", async () => {
    const store = new MemoryStorage();
    const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    await store.createSession(a, {
      date: "2026-07-19",
      durationMinutes: 10,
      asanas: '["Mountain"]',
      kind: "asana",
    });
    await store.createSession(b, {
      date: "2026-07-19",
      durationMinutes: 5,
      asanas: '["Child"]',
      kind: "asana",
    });

    const forA = await store.getSessions(a);
    const forB = await store.getSessions(b);
    assert.equal(forA.length, 1);
    assert.equal(forB.length, 1);
    assert.equal(forA[0].durationMinutes, 10);
    assert.equal(forB[0].durationMinutes, 5);
  });

  it("scopes preferences and favorites independently", async () => {
    const store = new MemoryStorage();
    const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    await store.updatePreferences(a, { voiceEnabled: 0 });
    await store.addFavoriteAsana(a, "tadasana");
    await store.addFavoriteAsana(b, "balasana");

    const prefsA = await store.getPreferences(a);
    const prefsB = await store.getPreferences(b);
    assert.equal(prefsA.voiceEnabled, 0);
    assert.equal(prefsB.voiceEnabled, 1);

    const favA = await store.getFavoriteAsanas(a);
    const favB = await store.getFavoriteAsanas(b);
    assert.deepEqual(
      favA.map((f) => f.slug),
      ["tadasana"],
    );
    assert.deepEqual(
      favB.map((f) => f.slug),
      ["balasana"],
    );
  });
});

describe("computeStats", () => {
  it("counts streak from consecutive practiced days", () => {
    const stats = computeStats(
      [
        { date: "2026-07-17", durationMinutes: 10 },
        { date: "2026-07-18", durationMinutes: 10 },
        { date: "2026-07-19", durationMinutes: 10 },
      ],
      "2026-07-19",
    );
    assert.equal(stats.currentStreak, 3);
    assert.equal(stats.totalSessions, 3);
    assert.equal(stats.totalMinutes, 30);
  });
});
