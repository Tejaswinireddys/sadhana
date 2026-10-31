import type { SessionPreflight } from "./sessionPreflight";
export function durationPhrase(p: Pick<SessionPreflight, "timeLabel" | "mode">): string {
  return p.mode === "timer" ? p.timeLabel : `${p.timeLabel}, including guidance`;
}

/** "No props" or "Needs a chair and a bolster (or a pillow)". */
export function propsPhrase(p: Pick<SessionPreflight, "equipmentSentence">): string {
  return p.equipmentSentence ? `Needs ${p.equipmentSentence}` : "No props";
}

