/**
 * Explainable adaptive session generator.
 * Hard safety filters always win over preference / engagement.
 */
import { asanaBySlug, type Asana } from "@/data/content";
import {
  composeTrainerSession,
  type TrainerAudience,
  type TrainerSession,
} from "./yogaTrainer";
import { adviseNextSession, scaleHoldSeconds, type AdaptiveAdvice } from "./adaptiveRecovery";

export type GeneratorInput = {
  intentMinutes: number;
  need?: string;
  body?: string[];
  soreParts?: string[];
  energy?: string;
  audience?: TrainerAudience;
  preferSlugs?: string[];
  lockSlugs?: string[];
  excludeSlugs?: string[];
  adviceOverride?: AdaptiveAdvice;
};

export type GeneratorResult = {
  session: TrainerSession;
  advice: AdaptiveAdvice;
  explanations: string[];
  safetyExclusions: { slug: string; reason: string }[];
};

const SAFE_FALLBACK = ["sukhasana", "balasana", "viparita-karani", "savasana"];

export function generateAdaptiveSession(input: GeneratorInput): GeneratorResult {
  const advice = input.adviceOverride ?? adviseNextSession();
  const minutes = Math.min(input.intentMinutes || advice.maxMinutes, advice.maxMinutes);
  const need = input.need || advice.preferNeed;
  const energy =
    input.energy ||
    (advice.intensity === "recover" || advice.intensity === "easy"
      ? "low"
      : advice.intensity === "build"
        ? "high"
        : "ok");

  const raw = composeTrainerSession(
    {
      body: input.body ?? [],
      soreParts: input.soreParts ?? [],
      energy,
      timeMinutes: minutes,
      need,
    },
    {
      audience: input.audience ?? "All",
      preferSlugs: input.preferSlugs,
    },
  );

  const exclude = new Set(input.excludeSlugs ?? []);
  const lock = input.lockSlugs ?? [];
  const safetyExclusions: { slug: string; reason: string }[] = [];

  let poses = raw.poses
    .filter((p) => {
      if (exclude.has(p.slug)) {
        safetyExclusions.push({ slug: p.slug, reason: "Excluded by you" });
        return false;
      }
      return true;
    })
    .map((p) => ({
      ...p,
      holdSeconds: scaleHoldSeconds(p.holdSeconds, advice.holdScale),
    }));

  for (const slug of lock) {
    if (poses.some((p) => p.slug === slug)) continue;
    const asana = asanaBySlug(slug);
    if (!asana) continue;
    if (input.soreParts?.length && isLikelyUnsafe(asana, input.soreParts)) {
      safetyExclusions.push({
        slug,
        reason: "Locked pose conflicted with sore areas — kept out",
      });
      continue;
    }
    poses.splice(Math.max(0, poses.length - 1), 0, {
      slug,
      holdSeconds: scaleHoldSeconds(30, advice.holdScale),
      sides: "once",
      why: "Kept because you locked this pose",
    });
  }

  if (poses.length < 3) {
    poses = SAFE_FALLBACK.map((slug) => ({
      slug,
      holdSeconds: scaleHoldSeconds(45, advice.holdScale),
      sides: "once" as const,
      why: "Restorative fallback after safety filtering",
    }));
  }

  const totalMinutes = Math.max(
    1,
    Math.round(
      poses.reduce((s, p) => s + p.holdSeconds * (p.sides === "each" ? 2 : 1), 0) / 60,
    ),
  );

  const explanations = [
    ...advice.reasons,
    ...raw.adjustments,
    `Hold times scaled ×${advice.holdScale.toFixed(2)} for ${advice.intensity} intensity.`,
    `Target about ${minutes} minutes (composed ~${totalMinutes} min of holds).`,
  ];

  return {
    advice,
    safetyExclusions,
    explanations,
    session: {
      ...raw,
      poses,
      totalMinutes,
      adjustments: [...raw.adjustments, ...advice.reasons],
      reasoning: `${advice.headline}. ${raw.reasoning}`,
    },
  };
}

function isLikelyUnsafe(asana: Asana, soreParts: string[]): boolean {
  const blob = `${asana.english} ${asana.summary} ${(asana.benefits ?? []).join(" ")}`.toLowerCase();
  return soreParts.some((p) => blob.includes(p.toLowerCase()));
}

export function swapPose(
  session: TrainerSession,
  fromSlug: string,
  toSlug: string,
): { session: TrainerSession; explanation: string } | null {
  const next = asanaBySlug(toSlug);
  if (!next) return null;
  const poses = session.poses.map((p) =>
    p.slug === fromSlug
      ? {
          ...p,
          slug: toSlug,
          why: `Swapped from ${fromSlug} → ${next.english}`,
        }
      : p,
  );
  return {
    session: { ...session, poses },
    explanation: `Replaced with ${next.english} at your request.`,
  };
}
