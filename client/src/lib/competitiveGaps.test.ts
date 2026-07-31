/**
 * Competitive-analysis gap fixes — unit coverage for new helpers.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTcx, buildWorkoutCsv } from "./healthExport.ts";
import { pairBuddy, clearBuddyPair, readBuddy, writeBuddy } from "./practiceBuddy.ts";
import { upcomingLive } from "../data/instructors.ts";
import { isHabitDay, readHabitPlan } from "./habitPlan.ts";

describe("health export", () => {
  it("builds importable TCX and CSV", () => {
    const w = { date: "2026-07-31", minutes: 20, label: "Calm flow", notes: "private" };
    const tcx = buildTcx(w);
    assert.match(tcx, /TrainingCenterDatabase/);
    assert.match(tcx, /Calm flow/);
    const csv = buildWorkoutCsv(w);
    assert.match(csv, /2026-07-31,20/);
  });
});

describe("practice buddy", () => {
  it("pairs and clears without using your own code", () => {
    // Isolate storage for the test
    const original = globalThis.localStorage;
    const store = new Map<string, string>();
    // @ts-expect-error test stub
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    };
    try {
      writeBuddy({
        code: "SB-AAAAAA",
        displayName: "Maya",
        pairedWithCode: null,
        pairedName: null,
        lastNudgeAt: null,
        encouragement: "Showing up is enough — glad you're here.",
      });
      const self = pairBuddy("SB-AAAAAA");
      assert.equal(self.pairedWithCode, null);
      const paired = pairBuddy("SB-ZZZZZZ", "Jon");
      assert.equal(paired.pairedWithCode, "SB-ZZZZZZ");
      assert.equal(paired.pairedName, "Jon");
      const cleared = clearBuddyPair();
      assert.equal(cleared.pairedWithCode, null);
      assert.ok(readBuddy().code);
    } finally {
      globalThis.localStorage = original;
    }
  });
});

describe("live class pilot", () => {
  it("exposes real join URLs for upcoming sessions", () => {
    const live = upcomingLive();
    assert.ok(live.length >= 1);
    for (const c of live) {
      assert.match(c.joinUrl, /^https:\/\//);
    }
  });
});

describe("habit plan", () => {
  it("exposes habit-day helpers used by Home recovery copy", () => {
    const plan = { ...readHabitPlan(), days: [0, 1, 2, 3, 4, 5, 6], compassionateRecovery: true };
    assert.equal(isHabitDay(plan, new Date("2026-07-31T12:00:00Z")), true);
  });
});
