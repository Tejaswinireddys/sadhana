/**
 * Injury / restriction intake for the instructor pilot.
 *
 * Never claims a practice is "adapted" until the user answers relevant
 * restriction prompts. Rules come from catalog_editor-reviewed avoidIf rows —
 * not invented medical clearance.
 */
import type {
  InstructorPoseDef,
  InstructorRestrictionRule,
  VariationLevel,
} from "@/data/instructorPilot";

export type RestrictionAnswer = {
  ruleId: string;
  /** null = unanswered */
  applies: boolean | null;
};

export type SafetyPlan = {
  ready: boolean;
  missingRuleIds: string[];
  excludedPoseIds: string[];
  forcedLevel: VariationLevel | null;
  warnings: string[];
  substitutions: Array<{ fromSlug: string; toSlug: string; reason: string }>;
  /** Only true when intake is complete and rules were applied. */
  claimsAdapted: boolean;
};

export function relevantRules(poses: InstructorPoseDef[]): InstructorRestrictionRule[] {
  const map = new Map<string, InstructorRestrictionRule>();
  for (const p of poses) {
    for (const r of p.restrictions) {
      const key = `${r.bodyArea}|${r.severity}|${r.action}|${r.condition}`;
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
      forcedLevel: null,
      warnings: [],
      substitutions: [],
      claimsAdapted: false,
    };
  }

  const excludedPoseIds: string[] = [];
  const warnings: string[] = [];
  const substitutions: SafetyPlan["substitutions"] = [];
  let forcedLevel: VariationLevel | null = null;

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
      } else if (rule.action === "prefer_beginner") {
        forcedLevel = "beginner";
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
    forcedLevel,
    warnings,
    substitutions,
    claimsAdapted: true,
  };
}

export function effectiveLevel(
  requested: VariationLevel,
  plan: SafetyPlan,
): VariationLevel {
  if (plan.forcedLevel === "beginner") return "beginner";
  return requested;
}
