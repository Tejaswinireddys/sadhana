import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { validatePoseExport } from "./poseExport";

const input = JSON.parse(readFileSync(new URL("../data/poses.json", import.meta.url), "utf8"));

test("export is complete and matches the current catalog, including image files", () => {
  assert.equal(validatePoseExport(input).length, 207);
  execFileSync(process.execPath, ["--import", "tsx", "script/export-poses.ts", "--check"]);
});

test("export rejects duplicate identities/names, missing fields and invalid links", () => {
  for (const field of ["id", "slug", "sanskrit", "english"]) {
    const poses = structuredClone(input);
    poses[1][field] = poses[0][field];
    assert.throws(() => validatePoseExport(poses), /Duplicate/);
  }
  for (const field of Object.keys(input[0])) {
    const poses = structuredClone(input);
    delete poses[0][field];
    assert.throws(() => validatePoseExport(poses), field);
  }
  for (const related of ["unknown-pose", input[0].slug]) {
    const poses = structuredClone(input);
    poses[0].relatedPoses = [related];
    assert.throws(() => validatePoseExport(poses), /Invalid related pose/);
  }
  const poses = structuredClone(input);
  poses[0].steps = [];
  assert.throws(() => validatePoseExport(poses));
  assert.throws(() => validatePoseExport(input.slice(1)));
});
