import test from "node:test";
import assert from "node:assert/strict";
import {
  estimateStepTimings,
  resolveStepAt,
  scaleTimings,
  stepIndexAt,
  stepWeight,
} from "./narrationTiming.ts";

test("estimateStepTimings", async (t) => {
  await t.test("spans exactly the full duration", () => {
    const timings = estimateStepTimings(["one two three", "four", "five six"], 30);
    assert.equal(timings[0].start, 0);
    assert.equal(timings[timings.length - 1].end, 30);
    for (let i = 1; i < timings.length; i += 1) {
      assert.equal(timings[i].start, timings[i - 1].end);
    }
  });

  await t.test("gives a long step more time than a short one", () => {
    // This is the whole point: the old code split these 50/50.
    const [long, short] = estimateStepTimings(
      [
        "Stand at the top of your mat, feet together or hip-width apart, weight even across both feet.",
        "Breathe.",
      ],
      20,
    );
    const longSpan = long.end - long.start;
    const shortSpan = short.end - short.start;
    assert.ok(longSpan > shortSpan * 5, `expected a big gap, got ${longSpan} vs ${shortSpan}`);
  });

  await t.test("handles zero / unknown duration without NaN", () => {
    for (const d of [0, NaN, -3]) {
      const timings = estimateStepTimings(["a", "b"], d);
      assert.ok(timings.every((s) => Number.isFinite(s.start) && Number.isFinite(s.end)));
    }
  });

  await t.test("empty step list yields no timings", () => {
    assert.deepEqual(estimateStepTimings([], 10), []);
  });
});

test("stepWeight is never zero", () => {
  for (const text of ["", "   ", "...", "a"]) {
    assert.ok(stepWeight(text) >= 1, `weight for ${JSON.stringify(text)}`);
  }
});

test("stepIndexAt", async (t) => {
  const timings = [
    { start: 0, end: 4 },
    { start: 4, end: 9 },
    { start: 9, end: 12 },
  ];

  await t.test("maps time into the right window", () => {
    assert.equal(stepIndexAt(timings, 0), 0);
    assert.equal(stepIndexAt(timings, 3.99), 0);
    assert.equal(stepIndexAt(timings, 4), 1);
    assert.equal(stepIndexAt(timings, 8.9), 1);
    assert.equal(stepIndexAt(timings, 9), 2);
  });

  await t.test("clamps past the end instead of overflowing", () => {
    assert.equal(stepIndexAt(timings, 99), 2);
  });
});

test("resolveStepAt reports progress inside the step", () => {
  const timings = [
    { start: 0, end: 4 },
    { start: 4, end: 8 },
  ];
  assert.deepEqual(resolveStepAt(timings, 0), { index: 0, progress: 0 });
  assert.deepEqual(resolveStepAt(timings, 2), { index: 0, progress: 0.5 });
  assert.deepEqual(resolveStepAt(timings, 6), { index: 1, progress: 0.5 });
  const end = resolveStepAt(timings, 8);
  assert.equal(end.index, 1);
  assert.equal(end.progress, 1);
});

test("scaleTimings stretches generated boundaries onto the real mp3 length", () => {
  const scaled = scaleTimings(
    [
      { start: 0, end: 5 },
      { start: 5, end: 10 },
    ],
    10,
    20,
  );
  assert.deepEqual(scaled, [
    { start: 0, end: 10 },
    { start: 10, end: 20 },
  ]);
});
