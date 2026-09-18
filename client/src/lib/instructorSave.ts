/**
 * Instructor session save outcomes — never claim "saved" before persistence.
 */
export type InstructorSaveStatus =
  | "idle"
  | "too_brief"
  | "partial"
  | "saving"
  | "saved"
  | "failed";

export function classifyInstructorSave(opts: {
  completedNaturally: boolean;
  practicedSec: number;
  minCreditSec?: number;
}): "too_brief" | "partial" | "complete" {
  const min = opts.minCreditSec ?? 30;
  if (opts.practicedSec < min) return "too_brief";
  if (!opts.completedNaturally) return "partial";
  return "complete";
}

export function instructorSaveHeadline(
  status: InstructorSaveStatus,
  opts?: { wasPartial?: boolean },
): string {
  switch (status) {
    case "too_brief":
      return "Too brief to save";
    case "partial":
      return "Partial practice";
    case "saving":
      return "Saving…";
    case "saved":
      return opts?.wasPartial ? "Partial practice saved" : "Session saved";
    case "failed":
      return "Could not save";
    default:
      return "Session ended";
  }
}

/**
 * Format active practiced time for completion copy.
 * Uses the same active seconds that drive save eligibility — never the skipped clock.
 */
export function formatPracticedSummary(
  practicedSec: number,
  opts?: { plannedSec?: number },
): string {
  const sec = Math.max(0, practicedSec);
  let timePart: string;
  if (sec < 30) {
    timePart = "less than a minute";
  } else if (sec < 90) {
    timePart = "about 1 minute";
  } else {
    const mins = Math.round(sec / 60);
    timePart = `about ${mins} minute${mins === 1 ? "" : "s"}`;
  }
  const planned = opts?.plannedSec ?? 0;
  const skippedNote =
    planned > sec + 15
      ? " — time you skipped or paused is not counted toward your journal."
      : ".";
  return `You practiced ${timePart}${skippedNote}`;
}
