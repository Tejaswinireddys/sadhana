/** Coaching decisions shared by captions and the session state machine. */
import { buildCueList, type NarrationCue } from "./narrationCues";
import { mirrorCue } from "./poseLesson";

/** Each side must be taught AND held before switching or advancing. */
export function afterGuidedHold(eachSide: boolean, side: 1 | 2): "sideSwitch" | "next" {
  return eachSide && side === 1 ? "sideSwitch" : "next";
}

/** Recorded timing belongs only to recorded instruction, never a short walkthrough. */
export function coachingCues(opts: {
  recorded: NarrationCue[];
  steps: string[];
  recordedTiming: boolean;
  duration: number;
  side: 1 | 2;
}): NarrationCue[] {
  const cues = opts.recordedTiming && opts.recorded.length
    ? opts.recorded
    : buildCueList(opts.steps, opts.duration);
  return cues.map((cue) => ({
    ...cue,
    text: opts.side === 2 ? mirrorCue(cue.text) : cue.text,
  }));
}
