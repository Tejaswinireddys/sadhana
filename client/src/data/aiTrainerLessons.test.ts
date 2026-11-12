import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
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

  it("maps each lesson to a real catalog pose with honest labeling", () => {
    for (const slug of AI_TRAINER_LESSON_SLUGS) {
      const lesson = aiTrainerLessonFor(slug)!;
      assert.ok(asanaBySlug(slug), `${slug} missing from catalog`);
      assert.equal(lesson.label, AI_TRAINER_PREVIEW_LABEL);
      assert.match(lesson.mp4, new RegExp(`/videos/ai-trainer/${slug}\\.mp4$`));
      assert.match(lesson.captionsVtt, new RegExp(`/captions/ai-trainer/${slug}\\.vtt$`));
      assert.ok(existsSync(resolve(`client/public${lesson.mp4}`)), lesson.mp4);
      assert.ok(existsSync(resolve(`client/public${lesson.captionsVtt}`)), lesson.captionsVtt);
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

describe("service worker leaves progressive video on the network", () => {
  const sw = readFileSync(resolve("client/public/sw.js"), "utf8");

  it("bumps the cache version and skips Range / media streams", () => {
    assert.match(sw, /const VERSION = "v6"/);
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
