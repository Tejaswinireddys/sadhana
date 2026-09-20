import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  INSTRUCTOR_CLIP_MANIFEST,
  availableAngles,
  clipsFor,
  coversRequiredPhases,
  isMovementDemonstration,
  manifestCoverage,
  manifestViolations,
  resolveClip,
  type InstructorClipManifest,
} from "./instructorMediaManifest";
import { INSTRUCTOR_PILOT_POSES } from "./instructorPilot";

/** A clip that satisfies every rule — the shape a produced asset must reach. */
function publishedClip(over: Partial<InstructorClipManifest> = {}): InstructorClipManifest {
  return {
    clipId: "pilot-tadasana/intermediate/both/front",
    poseId: "pilot-tadasana",
    variantId: "intermediate",
    side: "both",
    angle: "front",
    segments: [
      { phase: "preparation", startSec: 0, endSec: 6 },
      { phase: "entry", startSec: 6, endSec: 14 },
      { phase: "hold", startSec: 14, endSec: 30 },
      { phase: "exit", startSec: 30, endSec: 36 },
    ],
    durationSec: 36,
    sources: { hls: "https://cdn.example.test/tadasana-front.m3u8", mp4: null, webm: null },
    poster: "/poses/tadasana.png",
    captionsVtt: "/captions/instructor/tadasana-front.vtt",
    narration: { url: "/audio/instructor/tadasana-front.mp3", cues: [{ t: 0, text: "Stand tall." }] },
    equipment: [],
    modifies: null,
    provenance: {
      sourceKind: "filmed_instructor",
      creator: "Studio A",
      capturedOn: "2026-01-12",
      rights: "owned_original",
      rightsNote: "Full buy-out performer release on file.",
    },
    review: {
      stage: "published",
      reviewer: "A. Reviewer, RYT-500",
      reviewedOn: "2026-01-20",
      version: "1.0.0",
    },
    label: "Filmed front view.",
    missingAssetId: null,
    ...over,
  };
}

describe("instructor media manifest — honesty invariants", () => {
  it("ships with no clip claiming to be a movement demonstration", () => {
    // If this ever fails, real assets landed. Update the docs and the release
    // notes deliberately — do not relax the assertion.
    const claimed = INSTRUCTOR_CLIP_MANIFEST.filter(isMovementDemonstration);
    assert.deepEqual(
      claimed.map((c) => c.clipId),
      [],
      "a clip claims to demonstrate movement, but no reviewed assets have been produced",
    );
  });

  it("has no structural violations", () => {
    const violations = INSTRUCTOR_CLIP_MANIFEST.flatMap(manifestViolations);
    assert.deepEqual(violations, []);
  });

  it("covers every pilot pose, both sides where applicable", () => {
    for (const pose of INSTRUCTOR_PILOT_POSES) {
      const clips = INSTRUCTOR_CLIP_MANIFEST.filter((c) => c.poseId === pose.poseId);
      assert.ok(clips.length > 0, `${pose.slug} has no manifest entries`);

      if (pose.sides === "each") {
        for (const side of ["left", "right"] as const) {
          assert.ok(
            clips.some((c) => c.side === side),
            `${pose.slug} is a two-sided pose with no ${side}-side clip planned`,
          );
        }
      }

      // Front and side views for the full pose.
      for (const angle of ["front", "side"] as const) {
        assert.ok(
          clips.some((c) => c.variantId === "intermediate" && c.angle === angle),
          `${pose.slug} has no ${angle} view planned`,
        );
      }

      // An easier / supported option.
      assert.ok(
        clips.some((c) => c.modifies != null),
        `${pose.slug} has no supported variation planned`,
      );
    }
  });

  it("every unproduced clip names the asset to chase", () => {
    for (const clip of INSTRUCTOR_CLIP_MANIFEST) {
      if (isMovementDemonstration(clip)) continue;
      assert.ok(clip.missingAssetId, `${clip.clipId} is unavailable with no production id`);
    }
  });

  it("reports coverage that matches the manifest", () => {
    const coverage = manifestCoverage();
    assert.equal(coverage.total, INSTRUCTOR_CLIP_MANIFEST.length);
    assert.equal(coverage.publishedDemonstrations, 0);
    assert.equal(coverage.byStage.missing, INSTRUCTOR_CLIP_MANIFEST.length);
    assert.ok(coverage.missingAssetIds.length > 0);
  });
});

describe("isMovementDemonstration", () => {
  it("accepts a fully reviewed, published, phase-segmented clip", () => {
    assert.equal(isMovementDemonstration(publishedClip()), true);
  });

  it("rejects anything short of published", () => {
    for (const stage of ["missing", "draft", "content_review", "playback_qa"] as const) {
      const clip = publishedClip({ review: { ...publishedClip().review, stage } });
      assert.equal(isMovementDemonstration(clip), false, `${stage} passed as a demonstration`);
    }
  });

  it("rejects a published clip with no named reviewer or date", () => {
    assert.equal(
      isMovementDemonstration(publishedClip({ review: { ...publishedClip().review, reviewer: null } })),
      false,
    );
    assert.equal(
      isMovementDemonstration(
        publishedClip({ review: { ...publishedClip().review, reviewedOn: null } }),
      ),
      false,
    );
  });

  it("never lets an illustration or a still pass as instruction", () => {
    for (const sourceKind of ["presentation_animation", "static_reference"] as const) {
      const clip = publishedClip({
        provenance: { ...publishedClip().provenance, sourceKind },
      });
      assert.equal(isMovementDemonstration(clip), false, `${sourceKind} passed as a demonstration`);
      assert.ok(manifestViolations(clip).some((v) => /cannot be published/.test(v)));
    }
  });

  it("rejects a clip with no phase segments — a loop is not a lesson", () => {
    const clip = publishedClip({ segments: [] });
    assert.equal(isMovementDemonstration(clip), false);
    assert.equal(coversRequiredPhases(clip), false);
  });

  it("rejects a published clip with no media source", () => {
    const clip = publishedClip({ sources: { hls: null, mp4: null, webm: null } });
    assert.equal(isMovementDemonstration(clip), false);
    assert.ok(manifestViolations(clip).some((v) => /no media source/.test(v)));
  });
});

describe("manifestViolations", () => {
  it("requires prepare, enter, hold and exit before publishing", () => {
    const clip = publishedClip({
      segments: [
        { phase: "preparation", startSec: 0, endSec: 6 },
        { phase: "hold", startSec: 6, endSec: 20 },
      ],
    });
    assert.ok(manifestViolations(clip).some((v) => /prepare\/enter\/hold\/exit/.test(v)));
  });

  it("requires AI-generated movement to record what generated it", () => {
    const clip = publishedClip({
      provenance: { ...publishedClip().provenance, sourceKind: "ai_generated" },
    });
    assert.ok(manifestViolations(clip).some((v) => /does not record what generated it/.test(v)));
  });

  it("requires licence terms on licensed footage", () => {
    const clip = publishedClip({
      provenance: { ...publishedClip().provenance, rights: "licensed", rightsNote: "  " },
    });
    assert.ok(manifestViolations(clip).some((v) => /licence terms/.test(v)));
  });

  it("catches a segment that runs past the end of its clip", () => {
    const clip = publishedClip({ durationSec: 20 });
    assert.ok(manifestViolations(clip).some((v) => /past the end/.test(v)));
  });

  it("catches a clip marked missing that still carries a source", () => {
    const clip = publishedClip({
      review: { ...publishedClip().review, stage: "missing" },
    });
    assert.ok(manifestViolations(clip).some((v) => /marked missing but carries a media source/.test(v)));
  });
});

describe("angle resolution", () => {
  it("offers no alternate camera view while nothing is published", () => {
    for (const pose of INSTRUCTOR_PILOT_POSES) {
      assert.deepEqual(
        availableAngles({ poseId: pose.poseId, variantId: "intermediate" }),
        [],
        `${pose.slug} offered a camera toggle with no published clips`,
      );
    }
  });

  it("falls back to the front entry when the requested angle is absent", () => {
    const clip = resolveClip({
      poseId: "pilot-tadasana",
      variantId: "intermediate",
      angle: "side",
    });
    assert.equal(clip?.angle, "side", "the side row exists in the production plan");

    const onlyFront = clipsFor({ poseId: "pilot-tadasana", variantId: "beginner" });
    assert.ok(onlyFront.every((c) => c.angle === "front"));
    assert.equal(
      resolveClip({ poseId: "pilot-tadasana", variantId: "beginner", angle: "side" })?.angle,
      "front",
    );
  });
});
