import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCueList,
  cueIndexAt,
  cuesToStepTimings,
  resolveCueList,
} from "./narrationCues.ts";
import { breathAt } from "./breathCycle.ts";
import { resolveNarrationPlayback } from "./narrationPlayback.ts";

describe("narration cues", () => {
  it("builds ordered cues with increasing t", () => {
    const cues = buildCueList(
      [
        "Come to standing, feet together",
        "Inhale, lengthen the spine",
        "Exhale, root down through the feet",
      ],
      12,
    );
    assert.equal(cues.length, 3);
    assert.equal(cues[0]!.t, 0);
    assert.ok(cues[1]!.t > cues[0]!.t);
    assert.ok(cues[2]!.t > cues[1]!.t);
    assert.match(cues[0]!.text, /standing/i);
  });

  it("resolves cue index from playback time", () => {
    const cues = [
      { t: 0, text: "a" },
      { t: 4, text: "b" },
      { t: 8, text: "c" },
    ];
    assert.equal(cueIndexAt(cues, 0), 0);
    assert.equal(cueIndexAt(cues, 3.9), 0);
    assert.equal(cueIndexAt(cues, 4), 1);
    assert.equal(cueIndexAt(cues, 10), 2);
  });

  it("converts cues to step timings for sync", () => {
    const timings = cuesToStepTimings(
      [
        { t: 0, text: "a" },
        { t: 4, text: "b" },
      ],
      10,
    );
    assert.equal(timings[0]!.start, 0);
    assert.equal(timings[0]!.end, 4);
    assert.equal(timings[1]!.end, 10);
  });

  it("prefers manifest cues when present", () => {
    const cues = resolveCueList({
      stepTexts: ["fallback"],
      manifestCues: [{ t: 0, text: "From manifest" }],
    });
    assert.equal(cues[0]!.text, "From manifest");
  });
});

describe("breath cycle", () => {
  it("alternates inhale and exhale", () => {
    assert.equal(breathAt(0).name, "inhale");
    assert.equal(breathAt(3).name, "inhale");
    assert.equal(breathAt(4).name, "exhale");
    assert.equal(breathAt(7.5).name, "exhale");
    assert.equal(breathAt(8).name, "inhale");
  });
});

describe("narration playback priority", () => {
  const steps = ["Step one", "Step two"];

  it("uses human MP3 first", () => {
    const p = resolveNarrationPlayback({
      manifest: {
        video: null,
        audio: { url: "/audio/human/pose-x.mp3", source: "human", cues: null },
      },
      stepTexts: steps,
      voiceEnabled: true,
      allowRobotVoice: false,
    });
    assert.equal(p.kind, "human");
    assert.equal(p.url, "/audio/human/pose-x.mp3");
  });

  it("uses neural MP3 before speech", () => {
    const p = resolveNarrationPlayback({
      manifest: {
        video: null,
        audio: { url: "/audio/pose-x.mp3", source: "neural", cues: null },
      },
      stepTexts: steps,
      voiceEnabled: true,
      allowRobotVoice: true,
    });
    assert.equal(p.kind, "neural");
  });

  it("falls back to speech only when allowRobotVoice", () => {
    const speech = resolveNarrationPlayback({
      manifest: { video: null, audio: null },
      stepTexts: steps,
      voiceEnabled: true,
      allowRobotVoice: true,
    });
    assert.equal(speech.kind, "speech");
    assert.ok(speech.cues.length >= 1);

    const silent = resolveNarrationPlayback({
      manifest: { video: null, audio: null },
      stepTexts: steps,
      voiceEnabled: true,
      allowRobotVoice: false,
    });
    assert.equal(silent.kind, "silent");
  });

  it("stays silent when voice is disabled", () => {
    const p = resolveNarrationPlayback({
      manifest: {
        video: null,
        audio: { url: "/audio/pose-x.mp3", source: "neural", cues: null },
      },
      stepTexts: steps,
      voiceEnabled: false,
      allowRobotVoice: true,
    });
    assert.equal(p.kind, "silent");
  });
});
