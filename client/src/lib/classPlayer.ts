/**
 * Class player rules, kept pure so they are unit-tested: playback speed,
 * time actually practised, what a finished class logs to Progress, and the
 * page-level keyboard shortcuts.
 */
import type { ClassChapter } from "@shared/classLibrary";
import type { LogSessionInput } from "@/lib/logPracticeSession";
import { KEYS, readString, writeString } from "@/lib/localPrefs";

export const CLASS_SPEEDS = [0.75, 1, 1.25] as const;
export type ClassSpeed = (typeof CLASS_SPEEDS)[number];

export function parseClassSpeed(value: string | null | undefined): ClassSpeed {
  const n = Number(value);
  return (CLASS_SPEEDS as readonly number[]).includes(n) ? (n as ClassSpeed) : 1;
}
export function readClassSpeed(): ClassSpeed { return parseClassSpeed(readString(KEYS.classSpeed)); }
export function writeClassSpeed(speed: ClassSpeed): void { writeString(KEYS.classSpeed, String(speed)); }

/**
 * Seconds of the class actually played. Each `timeupdate` adds the step since
 * the last one when it looks like playback (forward, ≤ 2.5s — `timeupdate`
 * fires every ~250ms, faster at 1.25x); a seek or scrub adds nothing.
 */
export const MAX_PLAYBACK_STEP_SEC = 2.5;
export function watchedAfter(state: { watched: number; last: number | null }, currentTime: number): { watched: number; last: number } {
  if (!Number.isFinite(currentTime)) return { watched: state.watched, last: state.last ?? 0 };
  const step = state.last === null ? 0 : currentTime - state.last;
  return { watched: state.watched + (step > 0 && step <= MAX_PLAYBACK_STEP_SEC ? step : 0), last: currentTime };
}

/** Below this, skipping through a class does not count as practice. */
export const CLASS_MIN_COUNTED_SECONDS = 60;

/**
 * The Progress/streak entry for a finished class — the same session + journal
 * write a guided practice makes (`logPracticeSession`) — or null when too
 * little was watched to count. Minutes are time practised, not class length.
 */
export function classCompletionLog(input: {
  title: string;
  instructorName: string;
  durationMinutes: number;
  watchedSeconds: number;
  chapters: readonly ClassChapter[];
  poseName: (slug: string) => string | undefined;
}): LogSessionInput | null {
  if (!(input.watchedSeconds >= CLASS_MIN_COUNTED_SECONDS)) return null;
  const minutes = Math.max(1, Math.round(input.watchedSeconds / 60));
  const poses = [...new Set(input.chapters.map((c) => (c.poseSlug ? input.poseName(c.poseSlug) : undefined)).filter((n): n is string => !!n))];
  return {
    minutes,
    plannedMinutes: input.durationMinutes,
    poseNames: poses,
    label: input.title,
    pathwaySlug: null,
    preMood: null,
    postMood: null,
    kind: "asana",
    journalTags: [input.title, "class"],
    journalBody: `${input.title} — video class with ${input.instructorName}. ${minutes} min practised${
      poses.length ? `: ${poses.join(", ")}` : ""}.`,
  };
}

export type ClassKeyAction = "toggle" | "back" | "forward" | "fullscreen" | "captions";

/**
 * Page-level shortcuts. Ignored with modifier keys, while typing, on buttons
 * and links (Space/Enter belong to them), and inside the player itself, which
 * already handles the same keys when focused.
 */
export function classKeyAction(event: {
  key: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean;
  target: { tagName?: string; isContentEditable?: boolean; closest?: (selector: string) => unknown } | null;
}): ClassKeyAction | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  const target = event.target;
  const tag = target?.tagName?.toUpperCase();
  if (target?.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return null;
  if (target?.closest?.("mux-player")) return null;
  const onControl = tag === "BUTTON" || tag === "A" || !!target?.closest?.("button, a, [role='button']");
  switch (event.key) {
    case " ": case "Spacebar": return onControl ? null : "toggle";
    case "ArrowLeft": return "back";
    case "ArrowRight": return "forward";
    case "f": case "F": return "fullscreen";
    case "c": case "C": return "captions";
    default: return null;
  }
}

export const CLASS_SEEK_SECONDS = 10;
export const NEXT_CLASS_COUNTDOWN_SECONDS = 10;
