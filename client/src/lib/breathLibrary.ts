/**
 * Which recorded breath tracks still match the timer on the page.
 *
 * Files live in `client/public/voice/`. Nadi Shodhana and Kapalabhati were
 * re-timed (no retention; shorter bursts), so the older recordings are not
 * offered as the guide for those patterns.
 */
import type { BreathTechnique } from "@/data/content";
import type { ExperienceLevel } from "@/lib/localPrefs";

const ALIGNED_RECORDINGS = new Set([
  "box-breathing",
  "four-seven-eight",
  "ujjayi",
  "bhramari",
]);

export function breathHasAlignedRecording(slug: string): boolean {
  return ALIGNED_RECORDINGS.has(slug);
}

/**
 * Forceful breaths stay closed until the practitioner has said they already
 * practice. "new" and an unset level both stay closed.
 */
export function breathIsLocked(
  technique: Pick<BreathTechnique, "level">,
  experience: ExperienceLevel | null,
): boolean {
  if (technique.level !== "experienced") return false;
  return experience !== "some" && experience !== "regular";
}
