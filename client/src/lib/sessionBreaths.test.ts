import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { breathCycleSeconds, estimateBreathCount } from "./sessionBreaths.ts";

describe("sessionBreaths", () => {
  it("defaults to a 6s cycle", () => {
    assert.equal(breathCycleSeconds(null), 6);
    assert.equal(breathCycleSeconds(undefined), 6);
  });

  it("counts whole breaths from hold seconds", () => {
    assert.equal(estimateBreathCount(0), 0);
    assert.equal(estimateBreathCount(5), 0);
    assert.equal(estimateBreathCount(6), 1);
    assert.equal(estimateBreathCount(35), 5);
  });
});
