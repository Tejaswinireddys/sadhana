import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  INTENT_TO_NEED,
  preferredNeed,
  readPracticePreferences,
  writePracticePreferences,
} from "./practicePreferences.ts";

/** localStorage stand-in — these helpers are the only thing under test. */
function installStorage() {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
  return store;
}

describe("one store for goal, ability, time and focus", () => {
  beforeEach(() => {
    installStorage();
  });

  it("round-trips what a screen recorded", () => {
    writePracticePreferences({ intent: "sleep", experience: "new", minutes: 10, need: "calm" });
    assert.deepEqual(readPracticePreferences(), {
      intent: "sleep",
      experience: "new",
      minutes: 10,
      need: "calm",
    });
  });

  it("ignores values that are not real options", () => {
    writePracticePreferences({ minutes: 15 });
    (globalThis.localStorage as Storage).setItem("sadhana.practice.intent", "vibes");
    (globalThis.localStorage as Storage).setItem("sadhana.experience.level", "expert");
    const prefs = readPracticePreferences();
    assert.equal(prefs.intent, null);
    assert.equal(prefs.experience, null);
    assert.equal(prefs.minutes, 15);
  });

  it("falls back from a chosen focus, to the onboarding goal, to the clock", () => {
    assert.equal(preferredNeed({ intent: null, experience: null, minutes: null, need: "energy" }), "energy");
    assert.equal(
      preferredNeed({ intent: "flexibility", experience: null, minutes: null, need: null }),
      INTENT_TO_NEED.flexibility,
    );
    assert.equal(preferredNeed({ intent: null, experience: null, minutes: null, need: null }, 22), "sleep");
    assert.equal(preferredNeed({ intent: null, experience: null, minutes: null, need: null }, 9), "movement");
  });

  it("is read by every screen that asks the practitioner these questions", () => {
    // Four screens used to ask for a length and forget it. They now share one
    // answer, which is the whole point of this module existing.
    for (const page of [
      "client/src/pages/Home.tsx",
      "client/src/pages/Trainer.tsx",
      "client/src/pages/AdaptivePlan.tsx",
      "client/src/pages/StartQuiz.tsx",
    ]) {
      const src = readFileSync(resolve(page), "utf8");
      assert.match(src, /practicePreferences/, `${page} does not share practice preferences`);
    }
  });

  it("the Trainer and the Adaptive Plan write back what was chosen", () => {
    for (const page of ["client/src/pages/Trainer.tsx", "client/src/pages/AdaptivePlan.tsx"]) {
      const src = readFileSync(resolve(page), "utf8");
      assert.match(src, /writePracticePreferences\(/, `${page} never records the choice`);
    }
    // And nothing still opens on a hard-coded length.
    const adaptive = readFileSync(resolve("client/src/pages/AdaptivePlan.tsx"), "utf8");
    assert.equal(/useState\(20\)/.test(adaptive), false);
  });
});
