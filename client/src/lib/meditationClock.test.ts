import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MEDITATIONS } from "@/data/meditations";
import { cueAt, shouldRingBell } from "./meditationClock.ts";

describe("meditation clock", () => {
  it("shows the latest cue that has already arrived", () => {
    const cues = [
      { t: 0, text: "Begin" },
      { t: 30, text: "Middle" },
      { t: 60, text: "End" },
    ];
    assert.equal(cueAt(cues, 0)?.text, "Begin");
    assert.equal(cueAt(cues, 29)?.text, "Begin");
    assert.equal(cueAt(cues, 30)?.text, "Middle");
    assert.equal(cueAt(cues, 90)?.text, "End");
  });

  it("rings at the start, on the interval, and at the end, and not twice for the same step", () => {
    const base = { duration: 120, everySeconds: 60 };
    assert.equal(shouldRingBell({ ...base, previousElapsed: 0, elapsed: 0.2 }), true);
    assert.equal(shouldRingBell({ ...base, previousElapsed: 0.2, elapsed: 1 }), false);
    assert.equal(shouldRingBell({ ...base, previousElapsed: 59, elapsed: 60 }), true);
    assert.equal(shouldRingBell({ ...base, previousElapsed: 60, elapsed: 61 }), false);
    assert.equal(shouldRingBell({ ...base, previousElapsed: 119, elapsed: 120 }), true);
  });

  it("rings only at the ends when the interval is off", () => {
    const base = { duration: 30, everySeconds: 0 };
    assert.equal(shouldRingBell({ ...base, previousElapsed: 0, elapsed: 0.1 }), true);
    assert.equal(shouldRingBell({ ...base, previousElapsed: 10, elapsed: 20 }), false);
    assert.equal(shouldRingBell({ ...base, previousElapsed: 29, elapsed: 30 }), true);
  });
});

describe("meditation library", () => {
  it("has the sits, captions through the last second, and an AI-written script", () => {
    const slugs = ["body-scan", "breath-awareness", "loving-kindness", "nidra-short", "nidra-long"];
    for (const slug of slugs) {
      const practice = MEDITATIONS.find((item) => item.slug === slug);
      assert.ok(practice, slug);
      assert.equal(practice.script, "ai-written");
      assert.ok(practice.safety.length > 20, slug);
      assert.equal(practice.cues[0]?.t, 0, slug);
      assert.equal(practice.cues.at(-1)?.t, practice.minutes * 60, slug);
      for (let i = 1; i < practice.cues.length; i++) {
        assert.ok(practice.cues[i]!.t >= practice.cues[i - 1]!.t, slug);
      }
      assert.doesNotMatch(practice.summary + practice.cues.map((c) => c.text).join(" "), /cure|treat|diagnos/i);
    }
  });
});
