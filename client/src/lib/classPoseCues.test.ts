import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { asanaBySlug } from "../data/content.ts";
import { poseCueAt, poseSlugAt, type ClassPoseCue } from "./classPoseCues.ts";

describe("class pose cues", () => {
  it("follows the picture, not the coarse chapter, in Gentle morning wake-up", () => {
    const chapters = [
      { startSec: 210.9, title: "Wake up the spine", poseSlug: "marjaryasana-bitilasana" },
      { startSec: 402.6, title: "Child's pose to downward dog", poseSlug: "balasana" },
    ];
    // 5:50 is still inside the Cat-Cow chapter, but the narration and the
    // illustration have moved on to Thread the Needle.
    assert.equal(poseSlugAt("gentle-morning-wake-up", chapters, 350), "parsva-balasana");
    assert.equal(poseSlugAt("gentle-morning-wake-up", chapters, 220), "marjaryasana-bitilasana");
    assert.equal(poseSlugAt("gentle-morning-wake-up", chapters, 620), "tadasana");
    assert.equal(poseSlugAt("gentle-morning-wake-up", chapters, 500), "adho-mukha-svanasana");
    assert.equal(asanaBySlug("parsva-balasana")?.english, "Thread the Needle");
  });

  it("uses the chapter pose when the class has no cue sheet", () => {
    const chapters = [
      { startSec: 0, title: "Arrive" },
      { startSec: 60, title: "Mountain", poseSlug: "tadasana" },
    ];
    assert.equal(poseSlugAt("desk-back-relief", chapters, 61), "tadasana");
    assert.equal(poseSlugAt("desk-back-relief", chapters, 10), null);
  });

  it("picks the latest cue at or before the playhead", () => {
    const cues: ClassPoseCue[] = [
      { startSec: 10, slug: "a" },
      { startSec: 20, slug: "b" },
    ];
    assert.equal(poseCueAt(cues, 9), null);
    assert.equal(poseCueAt(cues, 10)?.slug, "a");
    assert.equal(poseCueAt(cues, 19.9)?.slug, "a");
    assert.equal(poseCueAt(cues, 20)?.slug, "b");
    assert.equal(poseCueAt(cues, Number.NaN), null);
  });
});
