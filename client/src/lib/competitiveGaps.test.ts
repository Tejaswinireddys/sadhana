/**
 * Competitive-analysis remaining gaps — unit coverage.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTcx, buildWorkoutCsv } from "./healthExport.ts";
import { pairBuddy, clearBuddyPair, readBuddy, writeBuddy } from "./practiceBuddy.ts";
import { buddyPairingError } from "./buddyPairing.ts";
import { upcomingLive, INSTRUCTORS } from "../data/instructors.ts";
import { isHabitDay, readHabitPlan } from "./habitPlan.ts";
import { QUICK_SESSIONS } from "../data/quickSessions.ts";
import { PLANS } from "./plans.ts";

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
      assert.match(buddyPairingError("", "SB-AAAAAA") ?? "", /SB-/);
    } finally {
      globalThis.localStorage = original;
    }
  });
});

describe("teachers preview (no fabricated trust)", () => {
  it("makes no unverified 'live class' or 'verified teacher' claims", () => {
    // The product audit flagged hard-coded 'verified' teachers and fabricated
    // live classes (relative Date.now() dates + generic YouTube links) as a
    // trust/safety issue. Until a real credential + scheduling pipeline exists,
    // there must be no scheduled live classes and no verified badges.
    assert.equal(upcomingLive().length, 0);
    for (const i of INSTRUCTORS) {
      assert.equal(i.verified, false);
      assert.equal(i.live.length, 0);
    }
  });
});

describe("habit plan", () => {
  it("exposes habit-day helpers used by Home recovery copy", () => {
    const plan = { ...readHabitPlan(), days: [0, 1, 2, 3, 4, 5, 6], compassionateRecovery: true };
    assert.equal(isHabitDay(plan, new Date("2026-07-31T12:00:00Z")), true);
  });
});

describe("mood session intros", () => {
  it("gives every mood session an intro pose slug and a canonical mood", () => {
    assert.equal(QUICK_SESSIONS.length, 6);
    for (const q of QUICK_SESSIONS) {
      assert.ok(q.introPoseSlug);
      assert.equal(q.introPoseSlug, q.poses[0]?.slug);
      assert.ok(q.mood);
    }
  });
});

describe("plans copy", () => {
  it("does not advertise coming-soon stubs on paid tiers", () => {
    const text = PLANS.flatMap((p) => p.bullets).join(" ");
    assert.equal(/coming soon|future\)/i.test(text), false);
  });
});
