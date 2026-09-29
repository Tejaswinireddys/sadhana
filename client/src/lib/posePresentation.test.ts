/**
 * Guards BetterMe-style per-pose presentation videos across teaching surfaces.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("pose presentation videos", () => {
  it("shows looping demo video on PoseTrainerStage when idle", () => {
    const src = readFileSync(resolve("client/src/components/PoseTrainerStage.tsx"), "utf8");
    assert.match(src, /usePoseMedia/);
    assert.match(src, /manifestToVideoSources/);
    assert.match(src, /wantPresentation/);
    assert.match(src, /preferVideo/);
    assert.match(src, /prefer3D=\{false\}/);
    assert.match(src, /onVideoUnavailable/);
  });

  it("scrubs how-to video to the spoken cue during teaching", () => {
    const src = readFileSync(resolve("client/src/components/PoseTrainerStage.tsx"), "utf8");
    assert.match(src, /wantSyncedHowTo/);
    assert.match(src, /syncToVoice=\{wantSyncedHowTo\}/);
    const demo = readFileSync(resolve("client/src/components/PoseDemoStage.tsx"), "utf8");
    assert.match(demo, /videoTimeForNarration/);
    assert.match(demo, /syncToVoice/);
    const guided = readFileSync(resolve("client/src/pages/GuidedSession.tsx"), "utf8");
    assert.match(guided, /narrationTime=\{live \? narrationTime : 0\}/);
    assert.match(guided, /syncVideoToVoice/);
    assert.match(guided, /guided-stage-crossfade/);
    assert.match(
      guided,
      /guideActive=\{\s*(?:live\s*&&\s*)?\(?\s*phase === "instruction" \|\| phase === "hold"\s*\)?\s*\}/,
    );
    assert.match(guided, /guided-stage-crossfade/);
    assert.match(
      guided,
      /guideActive=\{\s*(?:live\s*&&\s*)?\(?\s*phase === "instruction" \|\| phase === "hold"\s*\)?\s*\}/,
    );
  });

  it("wires kids, trainer, and search surfaces to pose videos", () => {
    const kids = readFileSync(resolve("client/src/pages/KidsPose.tsx"), "utf8");
    assert.match(kids, /KidsPoseVideo/);
    const trainer = readFileSync(resolve("client/src/pages/Trainer.tsx"), "utf8");
    assert.match(trainer, /PoseCardVideo/);
    const search = readFileSync(resolve("client/src/pages/Search.tsx"), "utf8");
    assert.match(search, /PoseCardVideo/);
  });
});

describe("pose library card visual polish", () => {
  it("fills cards with a fixed 3:4 cover crop and cream frame", () => {
    const card = readFileSync(resolve("client/src/components/PoseCardVideo.tsx"), "utf8");
    assert.match(card, /aspect-\[3\/4\]/);
    assert.match(card, /object-cover/);
    assert.match(card, /bg-background/);
    assert.match(card, /fit="cover"/);
    // Blank lazy frames: cream placeholder + eager poster decode.
    assert.match(card, /pose-card-placeholder/);
    assert.match(card, /loading="eager"/);
  });

  it("keeps teaching PoseImage on contain by default", () => {
    const img = readFileSync(resolve("client/src/components/PoseImage.tsx"), "utf8");
    assert.match(img, /fit = "contain"/);
  });
});

describe("Today pose thumbnails", () => {
  it("shows pose thumbs on the plan card and Or something else alternatives", () => {
    const today = readFileSync(resolve("client/src/components/home/TodayPracticeCard.tsx"), "utf8");
    assert.match(today, /data-testid="today-practice-pose-thumbs"/);
    assert.match(today, /fit="cover"/);
    const home = readFileSync(resolve("client/src/pages/Home.tsx"), "utf8");
    assert.match(home, /home-alt-thumbs-/);
    assert.match(home, /PoseImage/);
  });
});
