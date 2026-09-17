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
