import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { asanaBySlug } from "../data/content.ts";
import {
  chapterSeekSeconds,
  playheadFollowsSeek,
  poseCueAt,
  seekUpdate,
  poseSlugAt,
  type ClassPoseCue,
} from "./classPoseCues.ts";

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

  it("seeks Wake up the spine onto Cat-Cow, not the Easy Seat dissolve", () => {
    const chapters = [
      { startSec: 0, title: "Arrive and breathe", poseSlug: "sukhasana" },
      { startSec: 210.9, title: "Wake up the spine", poseSlug: "marjaryasana-bitilasana" },
      { startSec: 402.6, title: "Child's pose to downward dog", poseSlug: "balasana" },
    ];
    // The chapter marker is 0.2s before Cat-Cow. Labelling that instant is
    // what flashed Easy Seat while Thread the Needle was still on screen.
    assert.equal(poseSlugAt("gentle-morning-wake-up", chapters, 210.9), "sukhasana");
    const at = chapterSeekSeconds("gentle-morning-wake-up", chapters, 1);
    assert.ok(at > 211.1 && at < 220, `seek landed at ${at}`);
    assert.equal(poseSlugAt("gentle-morning-wake-up", chapters, at), "marjaryasana-bitilasana");
    assert.equal(chapterSeekSeconds("gentle-morning-wake-up", chapters, 0), 0);
  });

  it("does not jump ahead to a pose that starts later in the same chapter", () => {
    const chapters = [
      { startSec: 555.5, title: "Standing wake-up", poseSlug: "tadasana" },
      { startSec: 745, title: "Low lunge hip opener", poseSlug: "anjaneyasana" },
    ];
    // Mountain is narrated ~50s into this chapter. The click stays at the marker.
    assert.equal(chapterSeekSeconds("gentle-morning-wake-up", chapters, 0), 555.5);
  });

  it("keeps a class without a cue sheet on the chapter marker", () => {
    const chapters = [
      { startSec: 0, title: "Arrive" },
      { startSec: 120, title: "Downward dog", poseSlug: "adho-mukha-svanasana" },
    ];
    assert.equal(chapterSeekSeconds("desk-back-relief", chapters, 1), 120);
  });

  it("ignores a timeupdate that is still the pre-seek frame", () => {
    assert.equal(playheadFollowsSeek(212.1, 350), false);
    assert.equal(playheadFollowsSeek(212.1, 210.9), false, "Easy Seat dissolve is not Cat-Cow yet");
    assert.equal(playheadFollowsSeek(212.1, 212.4), true);
    assert.equal(playheadFollowsSeek(null, 350), true);
    assert.equal(playheadFollowsSeek(212.1, Number.NaN), false);
    const pending = { at: 212.1, from: 350 };
    assert.equal(seekUpdate(pending, 350), "hold");
    assert.equal(seekUpdate(pending, 0), "hold", "a seek that bounces to the start is not Easy Seat");
    assert.equal(seekUpdate(pending, 212.4), "landed");
    assert.equal(seekUpdate({ at: 120, from: 0 }, 61), "follow", "later playback is not the pre-seek frame");
    assert.equal(seekUpdate(null, 61), "follow");
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
