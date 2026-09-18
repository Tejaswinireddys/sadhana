/**
 * Injury / restriction intake for the instructor pilot.
 *
 * Never claims a practice is "adapted" until the user answers relevant
 * restriction prompts. Restriction-specific adaptations (e.g. forearm plank)
 * are distinct from difficulty "beginner".
 *
 * Answers are normalized by body area (`area:wrists`) so replacements re-apply
 * the same session restrictions without silently dropping them.
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
  /** Body areas answered as applying — carried across pose replacements. */
  activeBodyAreas: string[];
};

export const AREA_ANSWER_PREFIX = "area:";

export function areaAnswerId(bodyArea: string): string {
  return `${AREA_ANSWER_PREFIX}${bodyArea.toLowerCase()}`;
}

const AREA_LABELS: Record<string, string> = {
  wrists: "Wrists or hands",
  knees: "Knees",
  ankles: "Ankles",
  shoulders: "Shoulders",
  spine: "Spine or back",
  neck: "Neck",
  pregnancy: "Pregnancy",
  blood_pressure: "Blood pressure or dizziness",
  standing: "Standing or balance",
  digestion: "Digestion",
  general: "Other caution",
};

/** One intake prompt per body area — not one per catalog sentence. */
export type IntakePrompt = {
  id: string;
  bodyArea: string;
  title: string;
  detail: string;
  sampleConditions: string[];
};

export function intakePrompts(poses: InstructorPoseDef[]): IntakePrompt[] {
  const byArea = new Map<string, string[]>();
  for (const p of poses) {
    for (const r of p.restrictions) {
      const area = r.bodyArea.toLowerCase();
      const list = byArea.get(area) ?? [];
      if (!list.includes(r.condition)) list.push(r.condition);
      byArea.set(area, list);
    }
  }
  return [...byArea.entries()].map(([bodyArea, conditions]) => ({
    id: areaAnswerId(bodyArea),
    bodyArea,
    title: AREA_LABELS[bodyArea] ?? bodyArea.replace(/_/g, " "),
    detail:
      conditions.length === 1
        ? conditions[0]!
        : `Includes notes such as: ${conditions.slice(0, 2).join("; ")}`,
    sampleConditions: conditions,
  }));
}

/** @deprecated Prefer intakePrompts — kept for tests that list raw pose rules. */
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

/**
 * Resolve whether a body area applies from normalized area answers or legacy
 * per-pose rule ids.
 */
export function resolveBodyAreaAnswer(
  answers: RestrictionAnswer[],
  bodyArea: string,
  poseRules: InstructorRestrictionRule[] = [],
): boolean | null {
  const areaId = areaAnswerId(bodyArea);
  const direct = answers.find((a) => a.ruleId === areaId);
  if (direct && direct.applies != null) return direct.applies;

  // Legacy: any answered rule for this body area.
  const matchingRuleIds = new Set(
    poseRules.filter((r) => r.bodyArea.toLowerCase() === bodyArea.toLowerCase()).map((r) => r.id),
  );
  for (const a of answers) {
    if (a.applies == null) continue;
    if (matchingRuleIds.has(a.ruleId)) return a.applies;
    // Also accept answers from other poses that share the area id pattern in legacy maps.
    if (a.ruleId.includes(`-${bodyArea}`) || a.ruleId.startsWith(`${bodyArea}-`)) {
      return a.applies;
    }
  }

  // Broader legacy: if any rule id answer exists for a rule whose bodyArea matches
  // across the provided pose rules list only — already handled. For session-wide
  // transfer, scan answers that were stored as area: already done above.
  // Fallback: look up by matching any rule id that appears in answers against
  // known area from answer ruleId suffix (pilot-{slug}-rN won't work).
  return null;
}

/** Collect body-area answers from a mixed legacy/normalized answer list. */
export function activeBodyAreasFromAnswers(
  answers: RestrictionAnswer[],
  poses: InstructorPoseDef[],
): string[] {
  const areas = new Set<string>();
  for (const p of poses) {
    for (const r of p.restrictions) {
      if (resolveBodyAreaAnswer(answers, r.bodyArea, p.restrictions) === true) {
        areas.add(r.bodyArea.toLowerCase());
      }
    }
  }
  for (const a of answers) {
    if (a.applies === true && a.ruleId.startsWith(AREA_ANSWER_PREFIX)) {
      areas.add(a.ruleId.slice(AREA_ANSWER_PREFIX.length).toLowerCase());
    }
  }
  return [...areas];
}

export function evaluateSafetyPlan(opts: {
  poses: InstructorPoseDef[];
  answers: RestrictionAnswer[];
  requestedLevel: VariationLevel;
}): SafetyPlan {
  const prompts = intakePrompts(opts.poses);
  const missingRuleIds = prompts
    .filter((p) => resolveBodyAreaAnswer(opts.answers, p.bodyArea, []) == null)
    .map((p) => p.id);

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
      activeBodyAreas: [],
    };
  }

  const excludedPoseIds: string[] = [];
  const warnings: string[] = [];
  const substitutions: SafetyPlan["substitutions"] = [];
  const forcedAdaptations: Record<string, AdaptationId> = {};
  const forcedBeginnerPoseIds: string[] = [];
  const activeBodyAreas = activeBodyAreasFromAnswers(opts.answers, opts.poses);

  for (const pose of opts.poses) {
    for (const rule of pose.restrictions) {
      const applies = resolveBodyAreaAnswer(opts.answers, rule.bodyArea, pose.restrictions);
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
        // Prefer the first (usually most specific) adaptation for a pose.
        if (!forcedAdaptations[pose.poseId]) {
          forcedAdaptations[pose.poseId] = rule.adaptationId;
          const name = pose.adaptations[rule.adaptationId]?.displayName ?? rule.adaptationId;
          warnings.push(`${pose.english}: ${rule.condition} — using ${name}.`);
        }
      } else if (rule.action === "prefer_beginner") {
        if (!forcedAdaptations[pose.poseId]) {
          forcedBeginnerPoseIds.push(pose.poseId);
          warnings.push(`${pose.english}: ${rule.condition} — using the beginner variation.`);
        }
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
    forcedBeginnerPoseIds: [...new Set(forcedBeginnerPoseIds)],
    warnings,
    substitutions,
    claimsAdapted: true,
    activeBodyAreas,
  };
}

/**
 * Revalidate a replacement pose against the session's existing area answers.
 * Returns missing area prompt ids if the candidate introduces unanswered areas.
 */
export function revalidateReplacement(opts: {
  currentPoses: InstructorPoseDef[];
  replacement: InstructorPoseDef;
  replaceSlug: string;
  answers: RestrictionAnswer[];
  requestedLevel: VariationLevel;
}): {
  plan: SafetyPlan;
  nextSelected: string[];
  missingPrompts: IntakePrompt[];
  blockedReason: string | null;
} {
  const nextSelected = opts.currentPoses.map((p) =>
    p.slug === opts.replaceSlug ? opts.replacement.slug : p.slug,
  );
  // Build pose list with replacement swapped in.
  const nextPoses = opts.currentPoses.map((p) =>
    p.slug === opts.replaceSlug ? opts.replacement : p,
  );
  // Ensure replacement is present even if slug wasn't in list (single-pose edge).
  const poses =
    nextPoses.some((p) => p.slug === opts.replacement.slug)
      ? nextPoses
      : [...nextPoses.filter((p) => p.slug !== opts.replaceSlug), opts.replacement];

  const plan = evaluateSafetyPlan({
    poses,
    answers: opts.answers,
    requestedLevel: opts.requestedLevel,
  });

  const missingPrompts = intakePrompts(poses).filter((p) =>
    plan.missingRuleIds.includes(p.id),
  );

  let blockedReason: string | null = null;
  if (plan.excludedPoseIds.includes(opts.replacement.poseId) && !plan.substitutions.some((s) => s.fromSlug === opts.replacement.slug)) {
    blockedReason = `${opts.replacement.english} is not available with your current restrictions.`;
  }

  return {
    plan,
    nextSelected: [...new Set(nextSelected.length ? nextSelected : [opts.replacement.slug])],
    missingPrompts,
    blockedReason,
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
