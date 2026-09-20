import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSessionTimeline,
  holdKeyFor,
  phaseLabel,
  remapClockAfterSegmentExtend,
  segmentAtTime,
  type FlatSegment,
} from "./instructorTimeline";
import { INSTRUCTOR_PILOT_POSES, instructorPoseBySlug } from "@/data/instructorPilot";
import type { InstructorMode } from "@/data/instructorPilot";

const MODES: InstructorMode[] = ["learn", "flow"];

function build(opts: {
  slugs?: string[];
  mode?: InstructorMode;
  holdExtraByKey?: Record<string, number>;
}) {
  const poses = (opts.slugs ?? INSTRUCTOR_PILOT_POSES.map((p) => p.slug)).map((s) => {
    const pose = instructorPoseBySlug(s);
    assert.ok(pose, `unknown pilot pose ${s}`);
    return pose!;
  });
  return buildSessionTimeline({
    poses,
    mode: opts.mode ?? "learn",
    level: "beginner",
    holdExtraByKey: opts.holdExtraByKey,
  });
}

describe("instructor timeline — phase ordering", () => {
  it("teaches every pose as prepare, enter, hold, exit", () => {
    for (const mode of MODES) {
      for (const pose of INSTRUCTOR_PILOT_POSES) {
        const t = build({ slugs: [pose.slug], mode });
        const phases = t.flat.map((s) => s.phase);
        const firstHold = phases.indexOf("hold");
        assert.ok(firstHold > 0, `${pose.slug}/${mode} has no hold`);
        assert.equal(phases[0], "preparation", `${pose.slug}/${mode} does not prepare first`);
        assert.ok(
          phases.indexOf("entry") < firstHold,
          `${pose.slug}/${mode} holds before it enters`,
        );
        assert.ok(
          phases.lastIndexOf("exit") > firstHold,
          `${pose.slug}/${mode} exits before it holds`,
        );
      }
    }
  });

  it("starts the hold clock only after entry has finished", () => {
    const t = build({ slugs: ["tadasana"], mode: "learn" });
    const entry = t.flat.find((s) => s.phase === "entry")!;
    const hold = t.flat.find((s) => s.phase === "hold")!;
    assert.ok(
      hold.absStartSec >= entry.absStartSec + entry.durationSec,
      "the hold began before the entry was over",
    );
  });

  it("segments tile the session with no gaps or overlaps", () => {
    for (const mode of MODES) {
      const t = build({ mode });
      let cursor = 0;
      for (const seg of t.flat) {
        assert.equal(
          Math.round(seg.absStartSec),
          Math.round(cursor),
          `gap or overlap before ${seg.id} in ${mode}`,
        );
        cursor += seg.durationSec;
      }
      assert.equal(Math.round(cursor), Math.round(t.totalSec));
    }
  });

  it("labels every phase it can emit", () => {
    for (const seg of build({}).flat) {
      assert.notEqual(phaseLabel(seg.phase), "", `${seg.phase} has no label`);
    }
  });
});

describe("instructor timeline — left and right", () => {
  it("teaches Warrior II on both sides, with a switch between them", () => {
    const t = build({ slugs: ["virabhadrasana-ii"] });
    const sides = t.flat.map((s) => s.side);
    const firstLeft = sides.indexOf("left");
    const firstRight = sides.indexOf("right");
    const switchAt = t.flat.findIndex((s) => s.phase === "side_switch");

    assert.ok(firstLeft >= 0, "no left side");
    assert.ok(firstRight >= 0, "no right side");
    assert.ok(firstLeft < switchAt, "the switch came before the first side");
    assert.ok(switchAt < firstRight, "the second side came before the switch");
  });

  it("gives each side its own prepare, enter, hold and exit", () => {
    const t = build({ slugs: ["virabhadrasana-ii"] });
    for (const side of ["left", "right"] as const) {
      const phases = t.flat.filter((s) => s.side === side).map((s) => s.phase);
      for (const required of ["preparation", "entry", "hold", "exit"] as const) {
        assert.ok(phases.includes(required), `${side} side has no ${required}`);
      }
    }
  });

  it("names the side on every segment that belongs to one", () => {
    const t = build({ slugs: ["virabhadrasana-ii"] });
    const oneSided = t.flat.filter((s) => s.side !== "both");
    assert.ok(oneSided.length > 0);
    // A one-sided pose never gets a "both" hold, which would leave the
    // practitioner with no idea which leg is forward.
    const holds = t.flat.filter((s) => s.phase === "hold");
    assert.ok(holds.every((h) => h.side !== "both"), "a two-sided pose had an unlabelled hold");
  });
});

describe("extending a hold", () => {
  const key = holdKeyFor("tadasana", "both");

  it("lengthens the hold and nothing else", () => {
    const before = build({ slugs: ["tadasana"] });
    const after = build({ slugs: ["tadasana"], holdExtraByKey: { [key]: 15 } });

    assert.equal(Math.round(after.totalSec - before.totalSec), 15);

    const holdSec = (t: { flat: FlatSegment[] }) =>
      t.flat.filter((s) => s.phase === "hold").reduce((a, s) => a + s.durationSec, 0);
    assert.equal(Math.round(holdSec(after) - holdSec(before)), 15);

    // Entry and exit are untouched — extending a hold must not re-teach
    // getting into the pose.
    for (const phase of ["preparation", "entry", "exit"] as const) {
      const sec = (t: { flat: FlatSegment[] }) =>
        t.flat.filter((s) => s.phase === phase).reduce((a, s) => a + s.durationSec, 0);
      assert.equal(sec(after), sec(before), `${phase} changed when the hold was extended`);
    }
  });

  it("does not replay entry — the clock stays inside the hold", () => {
    const before = build({ slugs: ["tadasana"] });
    const hold = [...before.flat].reverse().find((s) => s.phase === "hold")!;
    // Three seconds into the hold.
    const at = hold.absStartSec + 3;

    const after = build({ slugs: ["tadasana"], holdExtraByKey: { [key]: 15 } });
    const remapped = remapClockAfterSegmentExtend({
      flatBefore: before.flat,
      flatAfter: after.flat,
      timeSec: at,
      segmentId: hold.id,
      addedSec: 15,
    });

    const nowAt = segmentAtTime(after.flat, remapped)!;
    assert.equal(nowAt.phase, "hold", "extending the hold threw us out of the hold");
    assert.equal(nowAt.id, hold.id);
    assert.equal(Math.round(remapped - nowAt.absStartSec), 3, "lost our place in the hold");
  });

  it("only extends the side that was asked for", () => {
    const leftKey = holdKeyFor("virabhadrasana-ii", "left");
    const before = build({ slugs: ["virabhadrasana-ii"] });
    const after = build({ slugs: ["virabhadrasana-ii"], holdExtraByKey: { [leftKey]: 15 } });

    const holdSec = (t: { flat: FlatSegment[] }, side: "left" | "right") =>
      t.flat
        .filter((s) => s.phase === "hold" && s.side === side)
        .reduce((a, s) => a + s.durationSec, 0);

    assert.equal(Math.round(holdSec(after, "left") - holdSec(before, "left")), 15);
    assert.equal(holdSec(after, "right"), holdSec(before, "right"), "the right side changed too");
  });

  it("accumulates repeated extensions", () => {
    const once = build({ slugs: ["tadasana"], holdExtraByKey: { [key]: 15 } });
    const twice = build({ slugs: ["tadasana"], holdExtraByKey: { [key]: 30 } });
    assert.equal(Math.round(twice.totalSec - once.totalSec), 15);
  });

  it("tags hold segments with a key that survives a queue edit", () => {
    const withOthers = build({ slugs: ["balasana", "tadasana"] });
    const alone = build({ slugs: ["tadasana"] });
    const keyOf = (t: { flat: FlatSegment[] }) =>
      t.flat.find((s) => s.phase === "hold" && s.id.startsWith("tadasana"))!.holdKey;
    assert.equal(keyOf(withOthers), keyOf(alone));
  });
});

describe("changing the variation", () => {
  const poses = [instructorPoseBySlug("kumbhakasana")!];

  it("rebuilds demonstration, cues and timing together", () => {
    const easier = buildSessionTimeline({ poses, mode: "learn", level: "beginner" });
    const harder = buildSessionTimeline({ poses, mode: "learn", level: "advanced" });

    // A different variation is a different practice: its own media, its own
    // cues, its own length. Leaving any one of them behind is the bug.
    assert.notEqual(easier.totalSec, harder.totalSec, "variation change did not retime");
    assert.notDeepEqual(
      easier.flat.map((s) => s.cue),
      harder.flat.map((s) => s.cue),
      "variation change did not recue",
    );
    // The phase spine is the same shape either way.
    assert.deepEqual(
      easier.flat.map((s) => s.phase),
      harder.flat.map((s) => s.phase),
    );
  });

  it("keeps the remaining sequence coherent after the switch", () => {
    const t = buildSessionTimeline({
      poses: [instructorPoseBySlug("tadasana")!, instructorPoseBySlug("kumbhakasana")!],
      mode: "learn",
      level: "advanced",
    });
    // Poses stay in order and segments still tile without a gap.
    let cursor = 0;
    for (const seg of t.flat) {
      assert.equal(Math.round(seg.absStartSec), Math.round(cursor));
      cursor += seg.durationSec;
    }
    assert.deepEqual(
      t.flat.map((s) => s.poseIndex),
      [...t.flat.map((s) => s.poseIndex)].sort((a, b) => a - b),
      "poses came out of order",
    );
  });

  it("applies a restriction adaptation instead of the difficulty variant", () => {
    const plain = buildSessionTimeline({ poses, mode: "learn", level: "beginner" });
    const adapted = buildSessionTimeline({
      poses,
      mode: "learn",
      level: "beginner",
      adaptations: { "pilot-kumbhakasana": "wrist_forearm_plank" },
    });
    assert.equal(adapted.poses[0].displayName, "Forearm plank");
    assert.notEqual(adapted.poses[0].displayName, plain.poses[0].displayName);
  });
});

describe("session totals", () => {
  it("Learn takes longer than Flow for the same poses", () => {
    assert.ok(build({ mode: "learn" }).totalSec > build({ mode: "flow" }).totalSec);
  });

  it("the whole-session total is the sum of its poses", () => {
    for (const mode of MODES) {
      const t = build({ mode });
      const summed = t.poses.reduce((a, p) => a + p.totalSec, 0);
      assert.equal(Math.round(t.totalSec), Math.round(summed));
    }
  });

  it("reports the extension it applied", () => {
    const t = build({ slugs: ["tadasana"], holdExtraByKey: { [holdKeyFor("tadasana", "both")]: 15 } });
    assert.equal(t.poses[0].holdExtraSec, 15);
  });
});
