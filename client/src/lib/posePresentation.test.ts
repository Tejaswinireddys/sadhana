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

  it("keeps teaching figure during guided instruction and holds", () => {
    const guided = readFileSync(resolve("client/src/pages/GuidedSession.tsx"), "utf8");
    assert.match(
      guided,
      /guideActive=\{phase === "instruction" \|\| phase === "hold"\}/,
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
