import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPoseLesson,
  durationLabelFor,
  mirrorCue,
  namedSideIn,
  nextStepStart,
  previousStepStart,
  phaseLabelFor,
  segmentAt,
  segmentStartAt,
  stepBoundaries,
  variationVisualMismatchFor,
  VERIFIED_FOCUS_POSES,
} from "./poseLesson";
import {
  blendedForeignShapes,
  hasMovementDemo,
  isDynamicPractice,
  missingDemoManifest,
  poseDemoAvailability,
  posesWithMisleadingGeneratedClips,
  STATIC_REFERENCE_LABEL,
} from "@/data/poseDemoAvailability";
import { asanaBySlug } from "@/data/content";

const LEVELS = ["beginner", "intermediate", "advanced"] as const;
const AUDITED = ["marjaryasana-bitilasana", "virabhadrasana-ii", "vrksasana"] as const;

describe("generated clips are not movement demonstrations", () => {
  it("knows Warrior II's clip opens on a standing figure", () => {
    // The live bug: "Bend the right knee toward 90°" showed someone standing
    // with their feet together. gen-pose-videos prepends tadasana for every
    // Standing pose, then crossfades.
    const asana = asanaBySlug("virabhadrasana-ii")!;
    assert.deepEqual(blendedForeignShapes(asana), ["tadasana"]);
  });

  it("knows Cat–Cow's clip opens on someone sitting cross-legged", () => {
    // The live bug: "Come to all fours" showed a cross-legged seat. Cat–Cow is
    // filed Restorative, and the Restorative entry shape is sukhasana.
    const asana = asanaBySlug("marjaryasana-bitilasana")!;
    assert.deepEqual(blendedForeignShapes(asana), ["sukhasana"]);
  });

  it("knows Tree's clip opens on a standing figure", () => {
    assert.deepEqual(blendedForeignShapes(asanaBySlug("vrksasana")!), ["tadasana"]);
  });

  it("is a catalog-wide problem, not three poses", () => {
    assert.ok(
      posesWithMisleadingGeneratedClips().length > 100,
      "expected the blended-shape problem to span much of the catalog",
    );
  });

  it("never reports a movement demo while none are reviewed", () => {
    for (const slug of AUDITED) {
      for (const level of LEVELS) {
        assert.equal(hasMovementDemo(slug, level), false, `${slug}/${level} claimed movement`);
      }
    }
  });
});

describe("missing-media fallback", () => {
  it("falls back to THIS pose's own still, never a sibling's", () => {
    for (const slug of AUDITED) {
      const demo = poseDemoAvailability(slug, "beginner");
      assert.equal(demo.kind, "static_reference");
      assert.ok(demo.poster, `${slug} has no poster`);
      assert.ok(
        demo.poster!.includes(slug),
        `${slug} fell back to a different pose's image: ${demo.poster}`,
      );
    }
  });

  it("labels the still honestly", () => {
    assert.equal(poseDemoAvailability("vrksasana").label, STATIC_REFERENCE_LABEL);
  });

  it("names the asset to produce and why the existing clip fails", () => {
    const manifest = missingDemoManifest();
    assert.equal(manifest.length, AUDITED.length * LEVELS.length);
    for (const entry of manifest) {
      assert.match(entry.id, /^movement-demo\//);
      assert.ok(entry.need.length > 20);
      assert.match(entry.whyExistingClipFails, /crossfades|still/);
    }
  });
});

describe("dynamic cycles versus static holds", () => {
  it("treats Cat–Cow as a flowing practice, not a hold", () => {
    const asana = asanaBySlug("marjaryasana-bitilasana")!;
    assert.equal(isDynamicPractice(asana), true);

    const lesson = buildPoseLesson({ slug: "marjaryasana-bitilasana", level: "beginner" })!;
    assert.equal(lesson.kind, "dynamic");
    // The page used to say "Hold ~45s" for a pose whose own instructions say
    // to keep moving, one movement per breath.
    assert.doesNotMatch(lesson.durationLabel, /hold/i);
    assert.match(lesson.durationLabel, /rounds/);
    assert.ok(lesson.rounds && lesson.rounds >= 4);
  });

  it("teaches tabletop, then Cow and Cat, then repeats, then returns to neutral", () => {
    const lesson = buildPoseLesson({ slug: "marjaryasana-bitilasana" })!;
    const phases = lesson.segments.map((s) => s.phase);

    assert.equal(phases[0], "preparation", "did not start from a neutral setup");
    assert.match(lesson.segments[0]!.cue, /all fours|tabletop/i);

    const cycles = lesson.segments.filter((s) => s.phase === "cycle");
    assert.ok(cycles.length >= 8, `expected repeated cycles, got ${cycles.length} segments`);

    // Cow and Cat alternate, one movement per breath.
    const movements = cycles.map((s) => s.cycle!.movement);
    for (let i = 1; i < movements.length; i++) {
      assert.notEqual(movements[i], movements[i - 1], "two identical movements in a row");
    }
    assert.equal(movements[0], "inhale", "the first movement of a round should be the inhale");

    // Breath cues match the movement they belong to.
    for (const seg of cycles) {
      assert.equal(seg.breathCue, seg.cycle!.movement === "inhale" ? "Inhale" : "Exhale");
    }

    assert.equal(phases[phases.length - 1], "exit");
    assert.match(lesson.segments[lesson.segments.length - 1]!.cue, /neutral/i);
  });

  it("gives static poses a hold label and a real hold segment", () => {
    for (const slug of ["virabhadrasana-ii", "vrksasana"] as const) {
      const lesson = buildPoseLesson({ slug })!;
      assert.equal(lesson.kind, "static");
      assert.match(lesson.durationLabel, /^Hold about \d+s/);
      assert.equal(lesson.rounds, null);
      assert.ok(lesson.segments.some((s) => s.phase === "hold"));
      assert.equal(lesson.segments.filter((s) => s.phase === "cycle").length, 0);
    }
  });

  it("starts each hold only after that side's entry has finished", () => {
    const lesson = buildPoseLesson({ slug: "virabhadrasana-ii" })!;
    const holds = lesson.segments
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.phase === "hold");
    assert.equal(holds.length, 2, "expected one hold per side");

    for (const { s: hold, i } of holds) {
      const entryBefore = lesson.segments
        .slice(0, i)
        .reverse()
        .find((p) => p.phase === "entry" && p.side === hold.side);
      assert.ok(entryBefore, `${hold.id} has no entry before it on the same side`);
      assert.ok(
        hold.startSec >= entryBefore!.startSec + entryBefore!.durationSec,
        `${hold.id} began before its own entry finished`,
      );
    }
  });
});

describe("phase ordering and step mapping", () => {
  it("runs prepare → enter → hold/flow → exit for every audited pose", () => {
    for (const slug of AUDITED) {
      const lesson = buildPoseLesson({ slug })!;
      const phases = lesson.segments.map((s) => s.phase);
      assert.equal(phases[0], "preparation", `${slug} did not prepare first`);
      assert.ok(phases.includes("exit"), `${slug} never exits`);
      const work = phases.indexOf("hold") >= 0 ? phases.indexOf("hold") : phases.indexOf("cycle");
      assert.ok(work > 0, `${slug} has no hold or cycle`);
      assert.ok(phases.indexOf("entry") < work, `${slug} works before it enters`);
    }
  });

  it("tiles the lesson with no gaps and a matching total", () => {
    for (const slug of AUDITED) {
      const lesson = buildPoseLesson({ slug })!;
      let cursor = 0;
      for (const seg of lesson.segments) {
        assert.equal(Math.round(seg.startSec), Math.round(cursor), `gap before ${seg.id}`);
        cursor += seg.durationSec;
      }
      assert.equal(Math.round(cursor), Math.round(lesson.totalSec));
    }
  });

  it("maps every step number to a segment that actually teaches it", () => {
    for (const slug of AUDITED) {
      const lesson = buildPoseLesson({ slug })!;
      const taught = new Set(
        lesson.segments.map((s) => s.stepNumber).filter((n): n is number => n != null),
      );
      for (const step of lesson.steps) {
        assert.ok(taught.has(step.number), `${slug} step ${step.number} is never on screen`);
      }
    }
  });

  it("labels every phase it can emit", () => {
    for (const slug of AUDITED) {
      for (const seg of buildPoseLesson({ slug })!.segments) {
        assert.notEqual(phaseLabelFor(seg.phase), "");
      }
    }
  });
});

describe("left and right sequencing", () => {
  it("teaches both sides with a release in between", () => {
    for (const slug of ["virabhadrasana-ii", "vrksasana"] as const) {
      const lesson = buildPoseLesson({ slug })!;
      assert.equal(lesson.sides, "each");
      const sides = lesson.segments.map((s) => s.side);
      const switchAt = lesson.segments.findIndex((s) => s.phase === "side_change");
      assert.ok(switchAt > 0, `${slug} never switches sides`);
      // "Switch sides" needs an actual release, not just a label.
      assert.match(lesson.segments[switchAt]!.cue, /release/i);

      const first = sides[0]!;
      const second = first === "right" ? "left" : "right";
      assert.ok(sides.slice(0, switchAt).every((s) => s === first || s === "both"));
      assert.ok(sides.slice(switchAt + 1).every((s) => s === second || s === "both"));
    }
  });

  it("mirrors the cue on the second side instead of repeating it verbatim", () => {
    // Replaying "turn the right foot out" on the second side tells you to set
    // up the side you have just finished.
    const lesson = buildPoseLesson({ slug: "virabhadrasana-ii" })!;
    const switchAt = lesson.segments.findIndex((s) => s.phase === "side_change");
    const firstKnee = lesson.segments.slice(0, switchAt).find((s) => /bend the \w+ knee/i.test(s.cue))!;
    const secondKnee = lesson.segments.slice(switchAt).find((s) => /bend the \w+ knee/i.test(s.cue))!;
    assert.match(firstKnee.cue, /bend the right knee/i);
    assert.match(secondKnee.cue, /bend the left knee/i);
  });

  it("mirrorCue swaps sides without mangling other words", () => {
    assert.equal(mirrorCue("Bend the right knee over the right ankle."), "Bend the left knee over the left ankle.");
    assert.equal(mirrorCue("Left foot forward"), "Right foot forward");
    // "upright" contains "right" but is not a side.
    assert.equal(mirrorCue("Stand upright and bright"), "Stand upright and bright");
  });

  it("teaches the side the catalog text is written for first", () => {
    assert.equal(namedSideIn([{ text: "turn the right foot out, left foot in" }, { text: "bend the right knee" }]), "right");
    assert.equal(namedSideIn([{ text: "shift into the left foot" }, { text: "lift the left leg" }]), "left");
  });
});

describe("variation consistency", () => {
  it("changes timing and props across levels", () => {
    for (const slug of AUDITED) {
      const seen = new Set<string>();
      for (const level of LEVELS) {
        const lesson = buildPoseLesson({ slug, level })!;
        seen.add(`${lesson.totalSec}|${lesson.durationLabel}`);
      }
      assert.ok(seen.size > 1, `${slug} timing never changed across variations`);
    }
  });

  it("leads the setup with the selected variation's own description", () => {
    const beginner = buildPoseLesson({ slug: "vrksasana", level: "beginner" })!;
    // Tree's beginner setup is toes-down with a hand on a wall.
    assert.match(beginner.segments[0]!.cue, /kickstand|toes of the lifted foot/i);
    assert.match(beginner.segments[0]!.cue, /wall/i);

    const advanced = buildPoseLesson({ slug: "vrksasana", level: "advanced" })!;
    assert.notEqual(advanced.segments[0]!.cue, beginner.segments[0]!.cue);
  });

  it("surfaces the props a variation needs", () => {
    assert.deepEqual(buildPoseLesson({ slug: "vrksasana", level: "beginner" })!.props, ["wall"]);
    assert.deepEqual(
      buildPoseLesson({ slug: "marjaryasana-bitilasana", level: "beginner" })!.props,
      ["blanket"],
    );
  });

  it("discloses that the picture is not the selected variation", () => {
    // There is one illustration per pose, so the supported beginner Tree is
    // not what the image shows. Say so rather than implying otherwise.
    const lesson = buildPoseLesson({ slug: "vrksasana", level: "beginner" })!;
    assert.ok(lesson.variationVisualMismatch, "beginner Tree did not disclose the mismatch");
    assert.match(lesson.variationVisualMismatch!, /not the beginner variation/i);
    assert.match(lesson.variationVisualMismatch!, /wall/);
  });

  it("does not cry mismatch for a variation that looks like the standard shape", () => {
    assert.equal(
      variationVisualMismatchFor(asanaBySlug("virabhadrasana-ii")!, "intermediate"),
      null,
    );
  });
});

describe("highlights", () => {
  it("draws no halo for a pose whose zones have not been verified", () => {
    // Warrior II authors "Arms extended" at {cy: 0.30, r: 0.26} — a circle
    // reaching from the crown to the waist, which is the reported bug where
    // the arms cue highlighted the head. Until the zones are checked against
    // the illustration at its rendered framing, none are drawn.
    assert.equal(VERIFIED_FOCUS_POSES.size, 0, "a pose was marked verified without review");
    for (const slug of AUDITED) {
      for (const seg of buildPoseLesson({ slug })!.segments) {
        assert.equal(seg.focus, null, `${seg.id} drew an unverified highlight`);
      }
    }
  });

  it("only ever surfaces zones the catalog actually authored", () => {
    // The old path inferred a zone from a regex over the cue, returning fixed
    // standing-figure coordinates for every pose and camera angle.
    for (const slug of AUDITED) {
      const authored = new Set(
        asanaBySlug(slug)!.steps.map((s) => s.focusZone?.label).filter(Boolean),
      );
      for (const seg of buildPoseLesson({ slug })!.segments) {
        if (!seg.focus) continue;
        assert.ok(
          authored.has(seg.focus.label),
          `${seg.id} shows "${seg.focus.label}", which the catalog never authored`,
        );
      }
    }
  });

  it("omits the highlight on transitions that point at nothing", () => {
    const lesson = buildPoseLesson({ slug: "virabhadrasana-ii" })!;
    for (const seg of lesson.segments.filter((s) => s.phase === "exit" || s.phase === "side_change")) {
      assert.equal(seg.focus, null, `${seg.id} highlighted a body part while releasing the pose`);
    }
  });
});

describe("replay, back and next", () => {
  const lesson = buildPoseLesson({ slug: "virabhadrasana-ii" })!;

  it("replay returns to the start of the current segment", () => {
    const hold = lesson.segments.find((s) => s.phase === "hold")!;
    const midway = hold.startSec + hold.durationSec / 2;
    assert.equal(segmentStartAt(lesson, midway), hold.startSec);
    assert.equal(segmentAt(lesson, segmentStartAt(lesson, midway))!.id, hold.id);
  });

  it("next moves forward one teaching step and back returns to it", () => {
    const bounds = stepBoundaries(lesson);
    assert.ok(bounds.length > 4);
    const from = bounds[2]!;
    const forward = nextStepStart(lesson, from);
    assert.equal(forward, bounds[3]);
    assert.equal(previousStepStart(lesson, forward), from);
  });

  it("next from mid-flow lands on the exit, not the next breath", () => {
    const flow = buildPoseLesson({ slug: "marjaryasana-bitilasana" })!;
    const firstCycle = flow.segments.find((s) => s.phase === "cycle")!;
    const after = nextStepStart(flow, firstCycle.startSec + 1);
    assert.equal(segmentAt(flow, after)!.phase, "exit");
  });

  it("clamps at both ends", () => {
    assert.equal(previousStepStart(lesson, 0), 0);
    assert.equal(nextStepStart(lesson, lesson.totalSec), lesson.totalSec);
  });
});

describe("duration consistency", () => {
  it("the label agrees with the timeline it describes", () => {
    const flow = buildPoseLesson({ slug: "marjaryasana-bitilasana" })!;
    assert.match(flow.durationLabel, new RegExp(`^${flow.rounds} rounds`));

    for (const slug of ["virabhadrasana-ii", "vrksasana"] as const) {
      for (const level of LEVELS) {
        const lesson = buildPoseLesson({ slug, level })!;
        const hold = lesson.segments.find((s) => s.phase === "hold")!;
        assert.match(lesson.durationLabel, new RegExp(`Hold about ${Math.round(hold.durationSec)}s`));
        assert.match(lesson.durationLabel, /each side/);
      }
    }
  });

  it("a two-sided lesson is longer than one side of it", () => {
    const lesson = buildPoseLesson({ slug: "vrksasana" })!;
    const switchAt = lesson.segments.find((s) => s.phase === "side_change")!;
    assert.ok(lesson.totalSec > switchAt.startSec * 1.8);
  });

  it("formats labels without contradicting themselves", () => {
    assert.equal(
      durationLabelFor({ dynamic: true, rounds: 8, totalSec: 90, holdSec: 45, sides: "once" }),
      "8 rounds · about 1:30",
    );
    assert.equal(
      durationLabelFor({ dynamic: false, rounds: null, totalSec: 90, holdSec: 40, sides: "each" }),
      "Hold about 40s each side",
    );
  });
});
