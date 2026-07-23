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

  const formCues = uniq([
    ...(primary.cues.length ? primary.cues : intermediate.cues),
    ...(!primary.cues.length && !intermediate.cues.length ? beginner.cues : []),
  ]).slice(0, 5);

  const alignmentTips = uniq([
    ...asana.steps
      .map((s) => s.text)
      .filter((t) => t.length > 0 && t.length < 140)
      .slice(0, 4),
    ...beginner.cues.slice(0, 2),
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
        : [asana.summary].filter(Boolean),
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
