/**
 * Guided-session clocks that must freeze together: pose countdown,
 * narration audio, and the pose-advance scheduler.
 *
 * Opening "Leave the session?" used to leave the 1s tick and MP3 running, so
 * the countdown and the "does this count?" copy moved while the practitioner
 * was still reading the dialog.
 */

export type GuidedClockSnapshot = {
  phaseRemaining: number;
  elapsedTotal: number;
  holdElapsed: number;
  narrationTime: number;
  audioCurrentTime: number;
};

export function guidedClockFrozen(paused: boolean, leaveDialogOpen: boolean): boolean {
  return paused || leaveDialogOpen;
}

/**
 * One scheduler second. A frozen snapshot is returned as-is so the countdown
 * string stays byte-identical for as long as the leave dialog is open.
 */
export function tickGuidedClock(
  snap: GuidedClockSnapshot,
  frozen: boolean,
): GuidedClockSnapshot {
  if (frozen) return snap;
  return {
    phaseRemaining: snap.phaseRemaining - 1,
    elapsedTotal: snap.elapsedTotal + 1,
    holdElapsed: snap.holdElapsed + 1,
    narrationTime: snap.narrationTime + 1,
    audioCurrentTime: snap.audioCurrentTime + 1,
  };
}
