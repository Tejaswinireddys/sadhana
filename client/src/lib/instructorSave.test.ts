import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyInstructorSave,
  instructorSaveHeadline,
} from "./instructorSave.ts";
import {
  buildSessionTimeline,
  remapClockAfterPrepExtend,
} from "./instructorTimeline.ts";
import { instructorPoseBySlug } from "../data/instructorPilot.ts";

describe("instructorSave", () => {
  it("classifies too_brief under 30s regardless of completion", () => {
    assert.equal(
      classifyInstructorSave({ completedNaturally: true, practicedSec: 12 }),
      "too_brief",
    );
    assert.equal(
      classifyInstructorSave({ completedNaturally: false, practicedSec: 29.9 }),
      "too_brief",
    );
  });

  it("classifies partial vs complete when practiced long enough", () => {
    assert.equal(
      classifyInstructorSave({ completedNaturally: false, practicedSec: 45 }),
      "partial",
    );
    assert.equal(
      classifyInstructorSave({ completedNaturally: true, practicedSec: 60 }),
      "complete",
    );
  });

  it("never headlines Session saved for non-saved statuses", () => {
    for (const status of ["idle", "too_brief", "partial", "saving", "failed"] as const) {
      assert.notEqual(instructorSaveHeadline(status), "Session saved");
    }
    assert.equal(instructorSaveHeadline("saved"), "Session saved");
    assert.equal(
      instructorSaveHeadline("saved", { wasPartial: true }),
      "Partial practice saved",
    );
    assert.equal(instructorSaveHeadline("too_brief"), "Too brief to save");
  });
});

describe("prep +5s remapping", () => {
  it("keeps the clock inside the extended preparation segment", () => {
    const pose = instructorPoseBySlug("tadasana")!;
    const before = buildSessionTimeline({
      poses: [pose],
      mode: "flow",
      level: "beginner",
      prepExtraByPoseIndex: { 0: 0 },
    });
    const prep = before.flat.find((s) => s.phase === "preparation")!;
    const midPrep = prep.absStartSec + prep.durationSec / 2;
    const after = buildSessionTimeline({
      poses: [pose],
      mode: "flow",
      level: "beginner",
      prepExtraByPoseIndex: { 0: 5 },
    });
    const remapped = remapClockAfterPrepExtend({
      flatBefore: before.flat,
      flatAfter: after.flat,
      timeSec: midPrep,
      prepSegmentId: prep.id,
      addedSec: 5,
    });
    const prepAfter = after.flat.find((s) => s.id === prep.id)!;
    assert.ok(remapped >= prepAfter.absStartSec);
    assert.ok(remapped < prepAfter.absStartSec + prepAfter.durationSec);
    assert.equal(after.totalSec, before.totalSec + 5);
  });
});
