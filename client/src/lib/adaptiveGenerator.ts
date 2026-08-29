/**
 * Explainable adaptive session generator.
 * Hard safety filters always win over preference / engagement.
 */
import { asanaBySlug, type Asana } from "@/data/content";
import {
  composeTrainerSession,
  orderPosesByArc,
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
  /** 0 = stable authored order. >0 reshuffles within warm-up / peak / cool-down. */
  variant?: number;
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
  // Suggested length is the default chip, not a silent cap. Easing already
  // shortens holds via holdScale; overriding the minute button lies.
  const minutes = input.intentMinutes > 0 ? input.intentMinutes : advice.maxMinutes;
  const need = input.need || advice.preferNeed;
  // Easy/recover already shortens holds via holdScale. Mapping that onto
  // "low energy" also capped pose count, so a 20-minute chip became ~11.
  const energy =
    input.energy ||
    advice.energy ||
    (advice.intensity === "build" ? "high" : "ok");

  const soreParts = input.soreParts ?? advice.soreParts ?? [];

  const raw = composeTrainerSession(
    {
      body: input.body ?? [],
      soreParts,
      energy,
      timeMinutes: minutes,
      need,
    },
    {
      audience: input.audience ?? "All",
      preferSlugs: input.preferSlugs,
      variant: input.variant ?? 0,
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
    if (soreParts.length && isLikelyUnsafe(asana, soreParts)) {
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

  poses = orderPosesByArc(poses);
  poses = restoreRequestedMinutes(poses, minutes);

  const totalMinutes = Math.max(
    1,
    Math.round(
      poses.reduce((s, p) => s + p.holdSeconds * (p.sides === "each" ? 2 : 1), 0) / 60,
    ),
  );

  const explanations = [
    ...advice.reasons,
    ...raw.adjustments,
  ];
  if (
    input.intentMinutes > advice.maxMinutes &&
    (advice.intensity === "easy" || advice.intensity === "recover")
  ) {
    explanations.push(
      `Easing suggested ${advice.maxMinutes} min — keeping the ${minutes} you picked.`,
    );
  }
  explanations.push(
    `Hold times scaled ×${advice.holdScale.toFixed(2)} for ${advice.intensity} intensity.`,
    `Target about ${minutes} minutes (composed ~${totalMinutes} min of holds).`,
  );

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

const REST_SLUG = /savasana|viparita-karani|balasana|constructive-rest/;

/** Hold-scale eases effort; leftover seconds go to rest so the minute chip still holds. */
function restoreRequestedMinutes<T extends { slug: string; holdSeconds: number; sides: "once" | "each" }>(
  poses: T[],
  targetMinutes: number,
): T[] {
  const targetSeconds = Math.max(5, targetMinutes) * 60;
  let remaining =
    targetSeconds - poses.reduce((s, p) => s + p.holdSeconds * (p.sides === "each" ? 2 : 1), 0);
  if (remaining <= 15) return poses;
  const next = poses.map((p) => ({ ...p }));
  const order = next
    .map((_, i) => i)
    .sort((a, b) => Number(REST_SLUG.test(next[b].slug)) - Number(REST_SLUG.test(next[a].slug)));
  for (const i of order) {
    if (remaining <= 0) break;
    const sides = next[i].sides === "each" ? 2 : 1;
    const room = 300 - next[i].holdSeconds;
    if (room <= 0) continue;
    const add = Math.min(room, Math.round(remaining / sides / 5) * 5);
    if (add <= 0) continue;
    next[i].holdSeconds += add;
    remaining -= add * sides;
  }
  return next;
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
  const poses = orderPosesByArc(
    session.poses.map((p) =>
      p.slug === fromSlug
        ? {
            ...p,
            slug: toSlug,
            why: `Swapped from ${fromSlug} → ${next.english}`,
          }
        : p,
    ),
  );
  return {
    session: { ...session, poses },
    explanation: `Replaced with ${next.english} at your request.`,
  };
}
