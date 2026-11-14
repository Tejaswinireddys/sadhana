import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { claimPageMedia, onPageMediaClaim } from "./pageMedia.ts";

describe("page media exclusivity", () => {
  it("notifies every listener except through the claim id itself", () => {
    const seen: string[] = [];
    const stopA = onPageMediaClaim((c) => seen.push(`a:${c.id}`));
    const stopB = onPageMediaClaim((c) => seen.push(`b:${c.id}`));
    claimPageMedia("video-player:1");
    assert.deepEqual(seen, ["a:video-player:1", "b:video-player:1"]);
    stopA();
    stopB();
  });

  it("wires VideoPlayer, PoseExplanation and VoicePlayer to the bus", () => {
    const video = readFileSync(resolve("client/src/components/VideoPlayer.tsx"), "utf8");
    const lesson = readFileSync(resolve("client/src/components/PoseExplanation.tsx"), "utf8");
    const voice = readFileSync(resolve("client/src/components/VoicePlayer.tsx"), "utf8");
    assert.match(video, /claimPageMedia\(mediaOwner\)/);
    assert.match(video, /onPageMediaClaim/);
    assert.match(lesson, /claimPageMedia\(mediaOwner\)/);
    assert.match(lesson, /onPageMediaClaim/);
    assert.match(voice, /claimPageMedia\(mediaOwner\)/);
    assert.match(voice, /onPageMediaClaim/);
  });

  it("hides the static-reference disclosure on AI trainer poses", () => {
    const lesson = readFileSync(resolve("client/src/components/PoseExplanation.tsx"), "utf8");
    const stage = readFileSync(resolve("client/src/components/PoseLessonStage.tsx"), "utf8");
    assert.match(lesson, /hasAiTrainerLesson\(asana\.slug\)/);
    assert.match(stage, /hasAiTrainerLesson\(demo\.slug\)/);
  });
});
