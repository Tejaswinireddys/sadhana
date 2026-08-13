/**
 * Pose trainer demo media — allowlist + convention paths.
 * Every catalog asana must ship with a local demo clip.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { poseHasVideo, poseMediaFor } from "./poseMedia.ts";
import { POSE_CAPTIONS_READY_LIST } from "./poseCaptionsReady.generated.ts";
import { POSE_VIDEOS_READY_LIST } from "./poseVideosReady.generated.ts";
import { ASANAS } from "./content.ts";
import { KIDS_POSES } from "./kids.ts";
import { kidsPoseHasVideo } from "./kidsMedia.ts";
import { KIDS_VIDEOS_READY_LIST } from "./kidsVideosReady.generated.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** Legacy SD clips were ~30–80KB; HD 1080×1920 encodes are well above this. */
const MIN_HD_MP4_BYTES = 150_000;

function nonEmpty(rel: string): boolean {
  const p = path.join(ROOT, rel);
  try {
    return existsSync(p) && statSync(p).size > 0;
  } catch {
    return false;
  }
}

function ffprobeWidth(file: string): number | null {
  try {
    const out = execFileSync(
      "ffprobe",
      ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width", "-of", "csv=p=0", file],
      { encoding: "utf8" },
    ).trim();
    const width = Number(out);
    return Number.isFinite(width) ? width : null;
  } catch {
    // CI runners often lack ffmpeg/ffprobe — size check below still enforces HD.
    return null;
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
    if (media.captions) {
      assert.match(media.captions, /captions\/poses\/tadasana\.vtt$/);
    }
  });

  it("ships HD demo video for catalog poses", () => {
    const sample = ["tadasana", "vrksasana", "adho-mukha-svanasana"];
    for (const slug of sample) {
      const rel = `client/public/videos/poses/${slug}.mp4`;
      assert.ok(nonEmpty(rel), `${slug} mp4 missing`);
      const file = path.join(ROOT, rel);
      const size = statSync(file).size;
      assert.ok(
        size >= MIN_HD_MP4_BYTES,
        `${slug} expected HD-sized mp4 (>= ${MIN_HD_MP4_BYTES} bytes), got ${size}`,
      );
      const width = ffprobeWidth(file);
      if (width != null) {
        assert.ok(width >= 900, `${slug} expected HD width >= 900, got ${width}`);
      }
    }
  });

  it("ships voice narration for every catalog asana", () => {
    const missing = ASANAS.filter((a) => !nonEmpty(`client/public/voice/pose-${a.slug}.mp3`)).map(
      (a) => a.slug,
    );
    assert.deepEqual(missing, [], `poses missing narration: ${missing.join(", ")}`);
  });

  it("ships captions for every catalog asana", () => {
    assert.equal(POSE_CAPTIONS_READY_LIST.length, ASANAS.length);
    const missing = ASANAS.filter((a) => !nonEmpty(`client/public/captions/poses/${a.slug}.vtt`)).map(
      (a) => a.slug,
    );
    assert.deepEqual(missing, [], `poses missing captions: ${missing.join(", ")}`);
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
