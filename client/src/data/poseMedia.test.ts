/**
 * Pose trainer demo media — allowlist + convention paths.
 * Every catalog asana must ship with a local demo clip.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { poseHasVideo, poseMediaFor } from "./poseMedia.ts";
import { POSE_VIDEOS_READY_LIST } from "./poseVideosReady.generated.ts";
import { ASANAS } from "./content.ts";
import { KIDS_POSES } from "./kids.ts";
import { kidsPoseHasVideo } from "./kidsMedia.ts";
import { KIDS_VIDEOS_READY_LIST } from "./kidsVideosReady.generated.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function nonEmpty(rel: string): boolean {
  const p = path.join(ROOT, rel);
  try {
    return existsSync(p) && statSync(p).size > 0;
  } catch {
    return false;
  }
}

describe("pose trainer demo media", () => {
  it("registers a demo clip for every catalog asana", () => {
    assert.equal(POSE_VIDEOS_READY_LIST.length, ASANAS.length);
    const missing = ASANAS.filter((a) => !poseHasVideo(a.slug)).map((a) => a.slug);
    assert.deepEqual(missing, [], `poses missing video registration: ${missing.join(", ")}`);
  });

  it("ships webm + mp4 files for every catalog asana", () => {
    const missing: string[] = [];
    for (const a of ASANAS) {
      if (
        !nonEmpty(`client/public/videos/poses/${a.slug}.webm`) ||
        !nonEmpty(`client/public/videos/poses/${a.slug}.mp4`)
      ) {
        missing.push(a.slug);
      }
    }
    assert.deepEqual(missing, [], `poses missing video files: ${missing.join(", ")}`);
  });

  it("resolves local convention paths (no invented CDN)", () => {
    const media = poseMediaFor("tadasana");
    assert.match(media.webm, /videos\/poses\/tadasana\.webm$/);
    assert.match(media.mp4, /videos\/poses\/tadasana\.mp4$/);
    assert.match(media.poster, /poses\/tadasana\.png$/);
    assert.equal(media.captions, undefined);
  });

  it("skips video for unknown slugs", () => {
    assert.equal(poseHasVideo("not-a-real-pose-slug-xyz"), false);
  });
});

describe("kids pose demo media", () => {
  it("registers a demo clip for every kids story pose", () => {
    assert.equal(KIDS_VIDEOS_READY_LIST.length, KIDS_POSES.length);
    const missing = KIDS_POSES.filter((p) => !kidsPoseHasVideo(p.slug)).map((p) => p.slug);
    assert.deepEqual(missing, [], `kids poses missing video: ${missing.join(", ")}`);
  });

  it("ships webm + mp4 files for every kids story pose", () => {
    const missing: string[] = [];
    for (const p of KIDS_POSES) {
      if (
        !nonEmpty(`client/public/videos/kids/${p.slug}.webm`) ||
        !nonEmpty(`client/public/videos/kids/${p.slug}.mp4`)
      ) {
        missing.push(p.slug);
      }
    }
    assert.deepEqual(missing, [], `kids poses missing video files: ${missing.join(", ")}`);
  });
});
