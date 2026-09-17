/**
 * Injury / restriction intake for the instructor pilot.
 *
 * Never claims a practice is "adapted" until the user answers relevant
 * restriction prompts. Restriction-specific adaptations (e.g. forearm plank)
 * are distinct from difficulty "beginner".
 */
import type {
  InstructorPoseDef,
  InstructorRestrictionRule,
  VariationLevel,
} from "@/data/instructorPilot";
import type { AdaptationId } from "@/lib/restrictionAdaptations";

export type RestrictionAnswer = {
  ruleId: string;
  /** null = unanswered */
  applies: boolean | null;
};

export type SafetyPlan = {
  ready: boolean;
  missingRuleIds: string[];
  excludedPoseIds: string[];
  /** Per-pose restriction adaptations — not a blanket beginner force. */
  forcedAdaptations: Record<string, AdaptationId>;
  /** Per-pose beginner force when no specific adaptation exists. */
  forcedBeginnerPoseIds: string[];
  warnings: string[];
  substitutions: Array<{ fromSlug: string; toSlug: string; reason: string }>;
  /** Only true when intake is complete and rules were applied. */
  claimsAdapted: boolean;
};

export function relevantRules(poses: InstructorPoseDef[]): InstructorRestrictionRule[] {
  const map = new Map<string, InstructorRestrictionRule>();
  for (const p of poses) {
    for (const r of p.restrictions) {
      const key = `${r.bodyArea}|${r.severity}|${r.action}|${r.adaptationId ?? ""}|${r.condition}`;
      if (!map.has(key)) map.set(key, r);
    }
  }
  return [...map.values()];
}

export function evaluateSafetyPlan(opts: {
  poses: InstructorPoseDef[];
  answers: RestrictionAnswer[];
  requestedLevel: VariationLevel;
}): SafetyPlan {
  const rules = relevantRules(opts.poses);
  const answerById = new Map(opts.answers.map((a) => [a.ruleId, a.applies]));
  const missingRuleIds = rules.filter((r) => answerById.get(r.id) == null).map((r) => r.id);

  if (missingRuleIds.length > 0) {
    return {
      ready: false,
      missingRuleIds,
      excludedPoseIds: [],
      forcedAdaptations: {},
      forcedBeginnerPoseIds: [],
      warnings: [],
      substitutions: [],
      claimsAdapted: false,
    };
  }

  const excludedPoseIds: string[] = [];
  const warnings: string[] = [];
  const substitutions: SafetyPlan["substitutions"] = [];
  const forcedAdaptations: Record<string, AdaptationId> = {};
  const forcedBeginnerPoseIds: string[] = [];

  for (const pose of opts.poses) {
    for (const rule of pose.restrictions) {
      const applies = answerById.get(rule.id);
      if (!applies) continue;
      if (rule.action === "exclude") {
        excludedPoseIds.push(pose.poseId);
        if (rule.alternativeSlug) {
          substitutions.push({
            fromSlug: pose.slug,
            toSlug: rule.alternativeSlug,
            reason: rule.condition,
          });
        }
      } else if (rule.action === "use_adaptation" && rule.adaptationId) {
        forcedAdaptations[pose.poseId] = rule.adaptationId;
        const name = pose.adaptations[rule.adaptationId]?.displayName ?? rule.adaptationId;
        warnings.push(`${pose.english}: ${rule.condition} — using ${name}.`);
      } else if (rule.action === "prefer_beginner") {
        forcedBeginnerPoseIds.push(pose.poseId);
        warnings.push(`${pose.english}: ${rule.condition} — using the beginner variation.`);
      } else {
        warnings.push(`${pose.english}: ${rule.condition}`);
      }
    }
  }

  return {
    ready: true,
    missingRuleIds: [],
    excludedPoseIds,
    forcedAdaptations,
    forcedBeginnerPoseIds,
    warnings,
    substitutions,
    claimsAdapted: true,
  };
}

export function effectiveLevelForPose(
  poseId: string,
  requested: VariationLevel,
  plan: SafetyPlan,
): VariationLevel {
  if (plan.forcedAdaptations[poseId]) return requested;
  if (plan.forcedBeginnerPoseIds.includes(poseId)) return "beginner";
  return requested;
}

/** @deprecated Prefer effectiveLevelForPose — kept for older call sites. */
export function effectiveLevel(
  requested: VariationLevel,
  plan: SafetyPlan,
): VariationLevel {
  if (plan.forcedBeginnerPoseIds.length > 0 && Object.keys(plan.forcedAdaptations).length === 0) {
    return "beginner";
  }
  return requested;
}
