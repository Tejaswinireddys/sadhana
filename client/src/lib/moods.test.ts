import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MOODS } from "../data/content.ts";
import { QUICK_SESSIONS, quickSessionMeta } from "../data/quickSessions.ts";
import {
  isLowEnergyMood,
  moodFromHomeChoice,
  resolvePreMood,
  shouldAskPreMood,
} from "./moods.ts";

describe("moodFromHomeChoice — one persisted vocabulary", () => {
  it("maps every Home mood session onto the Mood enum", () => {
    const expected: Record<string, (typeof MOODS)[number]> = {
      tense: "Stressed",
      tired: "Tired",
      "low-energy": "Tired",
      anxious: "Stressed",
      "feel-good": "Grounded",
      "before-bed": "Calm",
    };
    assert.equal(QUICK_SESSIONS.length, Object.keys(expected).length);
    for (const q of QUICK_SESSIONS) {
      assert.equal(q.mood, expected[q.id], `${q.id} (${q.label})`);
      assert.ok((MOODS as readonly string[]).includes(q.mood));
      assert.equal(moodFromHomeChoice(q.id), q.mood);
      assert.equal(moodFromHomeChoice(q.label), q.mood);
    }
  });

  it("passes through an already-canonical mood", () => {
    assert.equal(moodFromHomeChoice("Tired"), "Tired");
    assert.equal(moodFromHomeChoice("Calm"), "Calm");
  });

  it("returns null for an unknown value rather than guessing", () => {
    assert.equal(moodFromHomeChoice(""), null);
    assert.equal(moodFromHomeChoice("sleepy"), null);
    assert.equal(moodFromHomeChoice(null), null);
  });
});

describe("shouldAskPreMood — skip when known", () => {
  it("asks only when mood is missing", () => {
    assert.equal(shouldAskPreMood(null), true);
    assert.equal(shouldAskPreMood(undefined), true);
    assert.equal(shouldAskPreMood("Tired"), false);
    assert.equal(shouldAskPreMood("Stressed"), false);
  });

  it("resolves a Home tap into a skippable known mood", () => {
    const known = resolvePreMood(null, "I'm tired");
    assert.equal(known, "Tired");
    assert.equal(shouldAskPreMood(known), false);
  });

  it("prefers an explicit preMood over the session label", () => {
    assert.equal(resolvePreMood("Calm", "I'm tired"), "Calm");
  });

  it("puts the mapped mood on session meta so GuidedSession can skip", () => {
    const tired = QUICK_SESSIONS.find((q) => q.id === "tired")!;
    const meta = quickSessionMeta(tired);
    assert.equal(meta.preMood, "Tired");
    assert.equal(meta.label, "I'm tired");
    assert.equal(shouldAskPreMood(resolvePreMood(meta.preMood, meta.label)), false);
  });
});

describe("isLowEnergyMood — adaptive plan can read Home taps", () => {
  it("treats Tired and Stressed, plus Home aliases, as low energy", () => {
    assert.equal(isLowEnergyMood("Tired"), true);
    assert.equal(isLowEnergyMood("Stressed"), true);
    assert.equal(isLowEnergyMood("I'm tired"), true);
    assert.equal(isLowEnergyMood("tense"), true);
    assert.equal(isLowEnergyMood("I'm anxious"), true);
    assert.equal(isLowEnergyMood("low-energy"), true);
    assert.equal(isLowEnergyMood("Calm"), false);
    assert.equal(isLowEnergyMood("Grounded"), false);
    assert.equal(isLowEnergyMood("I need a reset"), false);
    assert.equal(isLowEnergyMood("Before bed"), false);
  });
});
