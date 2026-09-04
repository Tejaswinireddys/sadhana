import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatSessionPoseLine } from "./sessionAsanas.ts";

describe("formatSessionPoseLine", () => {
  it("joins a serialized pose array", () => {
    assert.equal(formatSessionPoseLine('["Mountain Pose"]'), "Mountain Pose");
    assert.equal(
      formatSessionPoseLine('["Mountain Pose","Child Pose"]'),
      "Mountain Pose, Child Pose",
    );
  });

  it("keeps a legacy plain-text list", () => {
    assert.equal(formatSessionPoseLine("Mountain Pose, Child Pose"), "Mountain Pose, Child Pose");
  });

  it("treats empty and blank values as empty", () => {
    assert.equal(formatSessionPoseLine(""), "");
    assert.equal(formatSessionPoseLine("   "), "");
    assert.equal(formatSessionPoseLine("[]"), "");
    assert.equal(formatSessionPoseLine(null), "");
  });
});
