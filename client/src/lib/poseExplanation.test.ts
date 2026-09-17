import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("changes form cues when difficulty path changes", () => {
    const asana = asanaBySlug("kumbhakasana");
    assert.ok(asana);
    const beginner = buildPoseExplanation(asana, "Beginner");
    const advanced = buildPoseExplanation(asana, "Advanced");
    assert.ok(beginner.formCues.length > 0);
    assert.ok(advanced.formCues.length > 0);
  });
});

describe("AsanaDetail wires variation into PoseExplanation", () => {
  it("passes the selected level into the upper teaching panel", () => {
    const detail = readFileSync(resolve("client/src/pages/AsanaDetail.tsx"), "utf8");
    assert.match(detail, /<PoseExplanation slug=\{asana\.slug\} level=\{level\}/);
    const expl = readFileSync(resolve("client/src/components/PoseExplanation.tsx"), "utf8");
    assert.match(expl, /level = "intermediate"/);
    assert.match(expl, /buildPoseExplanation\(asana, difficulty\)/);
  });
});

describe("pose-specific feel + step cues", () => {
  it("authors body regions for Supported Fish and the prenatal examples", () => {
    for (const slug of ["supported-fish-block", "prenatal-side-angle", "prenatal-thread-needle"]) {
      const asana = asanaBySlug(slug);
      assert.ok(asana, slug);
      assert.equal(
        asana.stretchZones.some((z) => /primary tissues|^(breath|support)$/i.test(z.region)),
        false,
        slug,
      );
    }
  });

  it("keeps step-motion graphics decorative so they cannot contradict the step", () => {
    const detail = readFileSync(resolve("client/src/pages/AsanaDetail.tsx"), "utf8");
    assert.match(detail, /decorative/);
    assert.match(detail, /aria-hidden/);
    const motion = readFileSync(resolve("client/src/components/StepMotion.tsx"), "utf8");
    assert.match(motion, /decorative \? "presentation"/);
  });
});
