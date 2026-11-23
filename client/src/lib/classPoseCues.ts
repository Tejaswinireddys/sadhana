/**
 * Finer pose timing than a class's chapter list.
 *
 * Chapters name a section ("Wake up the spine" → Cat-Cow from 3:31 to 6:42).
 * Inside that window the picture and the narration move on — Thread the Needle
 * is on screen at 5:50 while the chapter chip still says Cat-Cow. A cue sheet
 * keyed by class slug is the pose the chip and the AI-trainer stand-in follow.
 * Classes without a sheet keep the chapter pose.
 */
import type { ClassChapter } from "@shared/classLibrary";

export type ClassPoseCue = {
  startSec: number;
  slug: string;
};

/**
 * Gentle morning wake-up, read off the class's own narration (the picture
 * follows these lines). Times are seconds from the start of the published cut.
 */
const GENTLE_MORNING_WAKE_UP: ClassPoseCue[] = [
  { startSec: 46.3, slug: "sukhasana" },
  { startSec: 211.1, slug: "marjaryasana-bitilasana" },
  { startSec: 305.8, slug: "parsva-balasana" },
  { startSec: 402.8, slug: "balasana" },
  { startSec: 452.8, slug: "adho-mukha-svanasana" },
  { startSec: 544.4, slug: "uttanasana" },
  { startSec: 606.5, slug: "tadasana" },
  { startSec: 753.8, slug: "anjaneyasana" },
  { startSec: 879.0, slug: "salamba-bhujangasana" },
  { startSec: 946.8, slug: "supta-matsyendrasana" },
  { startSec: 1013.8, slug: "savasana" },
];

const CUE_SHEETS: Record<string, readonly ClassPoseCue[]> = {
  "gentle-morning-wake-up": GENTLE_MORNING_WAKE_UP,
};

export function classPoseCues(slug: string): readonly ClassPoseCue[] {
  return CUE_SHEETS[slug] ?? [];
}

/** Latest cue at `seconds`, or null before the first one. */
export function poseCueAt(cues: readonly ClassPoseCue[], seconds: number): ClassPoseCue | null {
  if (!Number.isFinite(seconds)) return null;
  let current: ClassPoseCue | null = null;
  for (const cue of cues) {
    if (cue.startSec <= seconds) current = cue;
    else break;
  }
  return current;
}

/**
 * Pose to label at this moment. A cue sheet wins over the chapter's single
 * pose, which stays put for the whole section.
 */
export function poseSlugAt(
  classSlug: string,
  chapters: readonly ClassChapter[],
  seconds: number,
): string | null {
  const cue = poseCueAt(classPoseCues(classSlug), seconds);
  if (cue) return cue.slug;
  if (!Number.isFinite(seconds)) return null;
  let slug: string | null = null;
  for (const chapter of chapters) {
    if (chapter.startSec <= seconds && chapter.poseSlug) slug = chapter.poseSlug;
  }
  return slug;
}

/**
 * Chapter markers often sit inside the previous pose's dissolve. Gentle
 * morning's "Wake up the spine" starts at 210.9s, while Cat-Cow is first on
 * screen at 211.1s — clicking 3:30 therefore labeled Easy Seat and left the
 * Cow frame up until the playhead crawled across that gap.
 *
 * Only nudge when the chapter's own pose begins within this many seconds.
 * A later pose in the same chapter (forward fold, then Mountain) must stay
 * where the chapter starts.
 */
export const CHAPTER_CUE_WINDOW_SEC = 2;
/** Crossfades at a chapter boundary are blank or still the previous pose for about a second. */
export const CHAPTER_DISSOLVE_SEC = 1;
/** A timeupdate farther than this from a requested seek is still the old playhead. */
export const SEEK_SETTLE_SEC = 1.5;

/**
 * Where a chapter row should put the playhead: on that chapter's pose, after
 * the dissolve, and still inside the chapter.
 */
export function chapterSeekSeconds(
  classSlug: string,
  chapters: readonly ClassChapter[],
  index: number,
): number {
  const chapter = chapters[index];
  if (!chapter || !Number.isFinite(chapter.startSec)) return 0;
  const nextStart = chapters[index + 1]?.startSec;
  const ceiling = Number.isFinite(nextStart) ? (nextStart as number) - 0.05 : Number.POSITIVE_INFINITY;
  let at = chapter.startSec;
  const wanted = chapter.poseSlug;
  if (wanted && poseSlugAt(classSlug, chapters, chapter.startSec) !== wanted) {
    const cue = classPoseCues(classSlug).find(
      (row) =>
        row.slug === wanted &&
        row.startSec >= chapter.startSec - 0.05 &&
        row.startSec <= chapter.startSec + CHAPTER_CUE_WINDOW_SEC &&
        row.startSec < (nextStart ?? Number.POSITIVE_INFINITY),
    );
    if (cue) {
      at = Math.min(Math.max(cue.startSec, cue.startSec + CHAPTER_DISSOLVE_SEC), ceiling);
      if (at < cue.startSec) at = cue.startSec;
    }
  }
  return Math.max(0, Math.min(at, ceiling));
}

/**
 * True when `observedSec` has reached the requested seek.
 * A time still in the previous pose's dissolve (or the pre-seek frame) is
 * false: do not move the pose chip from it.
 */
export function playheadFollowsSeek(pendingSec: number | null, observedSec: number): boolean {
  if (pendingSec == null) return true;
  if (!Number.isFinite(observedSec)) return false;
  return observedSec >= pendingSec - 0.25 && observedSec <= pendingSec + SEEK_SETTLE_SEC;
}

/**
 * What to do with a timeupdate while a chapter seek is in flight.
 * `hold` keeps the chip put and retries the seek (old frame, or a bounce to 0).
 * `follow` means the playhead moved on its own — trust it.
 */
export function seekUpdate(
  pending: { at: number; from: number } | null,
  observed: number,
): "landed" | "hold" | "follow" {
  if (!pending) return "follow";
  if (playheadFollowsSeek(pending.at, observed)) return "landed";
  const stillOld = Number.isFinite(observed) && Math.abs(observed - pending.from) <= 1;
  const bouncedToStart = observed < 0.5 && pending.at > 1;
  return stillOld || bouncedToStart ? "hold" : "follow";
}
