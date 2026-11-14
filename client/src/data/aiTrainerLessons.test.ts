import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  AI_TRAINER_ASSET_VERSION,
  AI_TRAINER_LESSONS,
  AI_TRAINER_LESSON_SLUGS,
  AI_TRAINER_PREVIEW_LABEL,
  aiTrainerLessonFor,
  hasAiTrainerLesson,
} from "./aiTrainerLessons.ts";
import { asanaBySlug } from "./content.ts";
import { hasMovementDemo } from "./poseDemoAvailability.ts";

describe("AI trainer lesson catalog", () => {
  it("ships exactly the three pilot poses", () => {
    assert.deepEqual([...AI_TRAINER_LESSON_SLUGS].sort(), [
      "adho-mukha-svanasana",
      "tadasana",
      "virabhadrasana-ii",
    ]);
  });

  it(`maps each lesson to cache-busted ${AI_TRAINER_ASSET_VERSION} portrait assets`, () => {
    assert.equal(AI_TRAINER_ASSET_VERSION, "v3");
    for (const slug of AI_TRAINER_LESSON_SLUGS) {
      const lesson = aiTrainerLessonFor(slug)!;
      assert.ok(asanaBySlug(slug), `${slug} missing from catalog`);
      assert.equal(lesson.label, AI_TRAINER_PREVIEW_LABEL);
      assert.equal(lesson.width, 720);
      assert.equal(lesson.height, 1280);
      assert.match(
        lesson.mp4,
        new RegExp(`/videos/ai-trainer/${slug}-${AI_TRAINER_ASSET_VERSION}\\.mp4$`),
      );
      assert.match(
        lesson.captionsVtt,
        new RegExp(`/captions/ai-trainer/${slug}-${AI_TRAINER_ASSET_VERSION}\\.vtt$`),
      );
      assert.match(
        lesson.poster,
        new RegExp(`/videos/ai-trainer/${slug}-${AI_TRAINER_ASSET_VERSION}-poster\\.jpg$`),
      );
      assert.ok(existsSync(resolve(`client/public${lesson.mp4}`)), lesson.mp4);
      assert.ok(existsSync(resolve(`client/public${lesson.captionsVtt}`)), lesson.captionsVtt);
      assert.ok(existsSync(resolve(`client/public${lesson.poster}`)), lesson.poster);
      const vtt = readFileSync(resolve(`client/public${lesson.captionsVtt}`), "utf8");
      assert.match(vtt, /^WEBVTT/m);
      assert.doesNotMatch(vtt, /\d{2}:\d{2}:\d{2},\d{3}/, "WebVTT must use '.' not ',' in cues");
      // Pilot lessons must not silently become "reviewed movement demos".
      assert.equal(hasMovementDemo(slug), false);
    }
  });

  it("exposes lookup helpers without inventing lessons", () => {
    assert.equal(hasAiTrainerLesson("tadasana"), true);
    assert.equal(hasAiTrainerLesson("balasana"), false);
    assert.equal(aiTrainerLessonFor("balasana"), undefined);
    assert.equal(Object.keys(AI_TRAINER_LESSONS).length, 3);
  });
});

describe("AI trainer portrait player layout", () => {
  const player = readFileSync(resolve("client/src/components/AiTrainerLesson.tsx"), "utf8");
  const videoPlayer = readFileSync(resolve("client/src/components/VideoPlayer.tsx"), "utf8");

  it("uses a 9:16 contain box and never object-cover", () => {
    assert.match(player, /const PORTRAIT_VIDEO =\n {2}"aspect-\[9\/16\] max-h-\[80vh\] w-full rounded-xl bg-card object-contain"/);
    assert.match(player, /videoClassName=\{PORTRAIT_VIDEO\}/);
    assert.doesNotMatch(player, /object-cover/);
    assert.doesNotMatch(player, /aspect-video/);
    assert.match(videoPlayer, /videoClassName\?:/);
    assert.match(videoPlayer, /DEFAULT_VIDEO_CLASS = "aspect-video/);
  });
});

describe("service worker leaves progressive video on the network", () => {
  const sw = readFileSync(resolve("client/public/sw.js"), "utf8");

  it("bumps the cache version and skips Range / media streams", () => {
    assert.match(sw, /const VERSION = "v7"/);
    assert.match(sw, /isMediaStream/);
    assert.match(sw, /request\.headers\.has\("Range"\) \|\| isMediaStream\(url\)/);
    assert.match(sw, /url\.pathname\.startsWith\("\/videos\/"\)/);
    // Must not treat mp4/webm as cache-first assets anymore.
    assert.doesNotMatch(
      sw,
      /isAsset[\s\S]*\/\\\.\([^)]*mp4[^)]*\)\$\//,
      "mp4 must not remain in the cache-first extension list",
    );
  });
});
