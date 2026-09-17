import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ADAPTATIONS,
  adaptationActionFor,
  adaptPoseSlugsForRestrictions,
  substituteForRegion,
  trainerLocationSatisfied,
  trainerNeedsBodyLocation,
} from "./restrictionAdaptations.ts";

describe("restriction adaptations — wrist forearm plank", () => {
  it("maps wrist modify on Plank to wrist_forearm_plank, not prefer_beginner", () => {
    const action = adaptationActionFor({
      poseSlug: "kumbhakasana",
      bodyArea: "wrists",
      severity: "modify",
      condition: "Wrist injury — drop to the forearms",
    });
    assert.deepEqual(action, {
      type: "use_adaptation",
      adaptationId: "wrist_forearm_plank",
    });
    assert.notEqual(action.type, "prefer_beginner");
  });

  it("keeps distinct adaptation content (forearm cues, not knee-plank beginner)", () => {
    const a = ADAPTATIONS.wrist_forearm_plank;
    assert.match(a.displayName, /forearm/i);
    assert.ok(a.steps.some((s) => /forearm/i.test(s)));
    assert.ok(a.cues.some((c) => /elbow/i.test(c)));
    assert.equal(a.mediaSlug, "dolphin-plank");
    assert.ok(!/hands under the shoulders/i.test(a.steps.join(" ")));
  });

  it("substitutes Plank → dolphin-plank for Wrists after revalidation", () => {
    const next = substituteForRegion("kumbhakasana", ["Wrists"], () => false);
    assert.equal(next, "dolphin-plank");
  });

  it("rejects a substitute that is itself excluded", () => {
    const next = substituteForRegion("kumbhakasana", ["Wrists"], (slug) => slug === "dolphin-plank");
    assert.equal(next, null);
  });

  it("adapts guided pose lists without leaving full Plank", () => {
    const out = adaptPoseSlugsForRestrictions(
      ["tadasana", "kumbhakasana", "balasana"],
      ["Wrists"],
    );
    assert.ok(out.includes("dolphin-plank"));
    assert.ok(!out.includes("kumbhakasana"));
  });
});

describe("trainer injury location gate", () => {
  it("requires a location when Injured is selected", () => {
    assert.equal(trainerNeedsBodyLocation(["Injured"]), true);
    assert.equal(trainerLocationSatisfied(["Injured"], []), false);
    assert.equal(trainerLocationSatisfied(["Injured"], ["Wrists"]), true);
    assert.equal(trainerLocationSatisfied(["Injured"], ["Prefer not to say"]), true);
  });
});
