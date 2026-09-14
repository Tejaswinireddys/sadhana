/**
 * Shared instructor session clock — one timeline drives media, captions,
 * timers, and breath cues so they pause/resume/seek together.
 */
export type InstructorClockState = {
  /** Elapsed session seconds (not wall clock). */
  timeSec: number;
  playing: boolean;
  rate: number;
};

export function advanceClock(
  state: InstructorClockState,
  deltaWallSec: number,
): InstructorClockState {
  if (!state.playing) return state;
  const rate = Number.isFinite(state.rate) && state.rate > 0 ? state.rate : 1;
  const delta = Math.max(0, deltaWallSec) * rate;
  return { ...state, timeSec: Math.max(0, state.timeSec + delta) };
}

export function pauseClock(state: InstructorClockState): InstructorClockState {
  return { ...state, playing: false };
}

export function resumeClock(state: InstructorClockState): InstructorClockState {
  return { ...state, playing: true };
}

export function seekClock(state: InstructorClockState, timeSec: number): InstructorClockState {
  return { ...state, timeSec: Math.max(0, timeSec) };
}

/** Seek to a segment start and optionally resume. */
export function seekToSegment(
  state: InstructorClockState,
  absStartSec: number,
  play = true,
): InstructorClockState {
  return { ...state, timeSec: Math.max(0, absStartSec), playing: play };
}

export function clampToSession(timeSec: number, totalSec: number): number {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return 0;
  return Math.max(0, Math.min(totalSec, timeSec));
}
