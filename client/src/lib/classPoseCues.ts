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
