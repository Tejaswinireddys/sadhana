import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { asanaBySlug } from "../data/content.ts";
import { buildPoseExplanation } from "./poseExplanation.ts";

describe("pose explanation watch-outs", () => {
  it("lists Thunderbolt's modification once", () => {
    const asana = asanaBySlug("vajrasana");
    assert.ok(asana);
    const expl = buildPoseExplanation(asana, "Beginner");
    const blanket = /folded blanket behind the knees/i;
    const hits = expl.watchOuts.filter((line) => blanket.test(line));
    assert.equal(hits.length, 1, `duplicated modification: ${expl.watchOuts.join(" | ")}`);
    assert.match(hits[0]!, /^Option:/);
    assert.match(expl.modification, blanket);
  });
});
