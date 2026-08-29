import type { Asana, Difficulty } from "@/data/content";

/**
 * Structured teaching content for the pose-explanation experience.
 * Derived from existing asana fields — no parallel content library required.
 */
export type PoseExplanationContent = {
  formCues: string[];
  breathCue: string;
  alignmentTips: string[];
  watchOuts: string[];
  feelIt: string[];
  modification: string;
};

/** Copied into ~75 later catalog entries. Form coaching must never ship this. */
export const PLACEHOLDER_FORM_CUES = ["Aligned joints", "Long spine", "Steady gaze"] as const;
export const PLACEHOLDER_BEGINNER_CUES = ["Props welcome", "Smaller range", "Soft breath"] as const;
export const PLACEHOLDER_ADVANCED_CUES = ["Honest edge", "No forcing", "Quiet face"] as const;

function cueKey(cues: readonly string[]): string {
  return cues.map((c) => c.trim().toLowerCase()).join("|");
}

export function isPlaceholderCues(cues: readonly string[]): boolean {
  const key = cueKey(cues);
  return (
    key === cueKey(PLACEHOLDER_FORM_CUES) ||
    key === cueKey(PLACEHOLDER_BEGINNER_CUES) ||
    key === cueKey(PLACEHOLDER_ADVANCED_CUES)
  );
}

function uniq(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function clipCue(text: string, max = 78): string {
  const t = text.replace(/\s+/g, " ").replace(/\.+$/, "").trim();
  if (t.length <= max) return t;
  const cut = t.lastIndexOf(" ", max);
  return (cut > 36 ? t.slice(0, cut) : t.slice(0, max)).trim();
}

function isExitOrRepeat(text: string): boolean {
  return /^(hold,? then|switch sides|unwind|repeat|return and switch|move slow)/i.test(text)
    || /\bthen (lower|sit|switch|rest|return|release)\b/i.test(text);
}

/**
 * Three real coaching cues from the pose's own steps, zones, and modifications.
 * Used when variation copy is still the shared placeholder triplet.
 */
export function coachingCuesFor(asana: Asana, level: Difficulty = "Intermediate"): string[] {
  const steps = asana.steps
    .map((s) => s.text.trim())
    .filter((t) => t.length >= 16 && !isExitOrRepeat(t))
    .map((t) => clipCue(t));

  // Middle steps are the shape; the first is often just getting there.
  const ordered =
    steps.length >= 3 ? [steps[1]!, steps[2]!, steps[0]!] : steps;

  const zone = asana.stretchZones.find((z) => z.primary);
  const zoneCue = zone ? clipCue(`${zone.region}: ${zone.sensation}`) : "";
  const extras = uniq(
    [
      zoneCue,
      clipCue(asana.breathing),
      asana.benefits[0] ? clipCue(asana.benefits[0]) : "",
    ].filter(Boolean),
  );

  let cues = uniq([...ordered, ...extras]).slice(0, 3);

  if (level === "Beginner" && asana.modifications) {
    const mod = clipCue(asana.modifications);
    if (cues.length < 3) cues.push(mod);
    else cues[2] = mod;
  } else if (level === "Advanced") {
    const edge = asana.benefits[1]
      ? clipCue(asana.benefits[1])
      : "Stay at an honest edge without forcing";
    if (cues.length < 3) cues.push(edge);
    else cues[2] = edge;
  }

  while (cues.length < 3) {
    const fallback = clipCue(asana.summary);
    if (!fallback || cues.some((c) => c.toLowerCase() === fallback.toLowerCase())) break;
    cues.push(fallback);
  }

  return cues.slice(0, 3);
}

/**
 * Build elegant teaching panels from the asana model.
 * Prefers intermediate cues; falls back across difficulty levels.
 */
export function buildPoseExplanation(
  asana: Asana,
  level: Difficulty = "Intermediate",
): PoseExplanationContent {
  const key =
    level === "Beginner"
      ? "beginner"
      : level === "Advanced"
        ? "advanced"
        : "intermediate";

  const primary = asana.variations[key];
  const beginner = asana.variations.beginner;
  const intermediate = asana.variations.intermediate;

  const rawForm = uniq([
    ...(primary.cues.length ? primary.cues : intermediate.cues),
    ...(!primary.cues.length && !intermediate.cues.length ? beginner.cues : []),
  ]);
  const formCues = isPlaceholderCues(rawForm)
    ? coachingCuesFor(asana, level)
    : rawForm.slice(0, 5);

  const alignmentTips = uniq([
    ...asana.steps
      .map((s) => s.text)
      .filter((t) => t.length > 0 && t.length < 140)
      .slice(0, 4),
    ...(isPlaceholderCues(beginner.cues) ? [] : beginner.cues.slice(0, 2)),
  ]).slice(0, 4);

  const watchOuts = uniq([
    ...asana.avoidIf
      .filter((r) => r.severity === "modify" || r.severity === "caution")
      .map((r) => r.condition),
    ...asana.contraindications.slice(0, 2),
    asana.modifications ? `Option: ${asana.modifications}` : "",
  ]).slice(0, 5);

  const feelIt = uniq(
    asana.stretchZones
      .filter((z) => z.primary)
      .map((z) => `${z.region} — ${z.sensation}`),
  ).slice(0, 4);

  return {
    formCues:
      formCues.length > 0
        ? formCues
        : coachingCuesFor(asana, level),
    breathCue: asana.breathing,
    alignmentTips:
      alignmentTips.length > 0
        ? alignmentTips
        : asana.steps.slice(0, 3).map((s) => s.text),
    watchOuts:
      watchOuts.length > 0
        ? watchOuts
        : ["Move within a comfortable range — never force the pose."],
    feelIt:
      feelIt.length > 0
        ? feelIt
        : asana.benefits.slice(0, 3),
    modification: asana.modifications,
  };
}

/** Short rotating cues suitable for the guided-session hold phase. */
export function practiceHoldCues(asana: Asana): string[] {
  const expl = buildPoseExplanation(asana);
  return uniq([
    ...expl.formCues.slice(0, 3),
    expl.breathCue,
    "Soften the face…",
    "Stay present…",
  ]).slice(0, 6);
}
