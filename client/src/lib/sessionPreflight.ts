/**
 * Everything a practitioner should be able to read before pressing Begin.
 *
 * The complaint this answers: "I'm tired" opened straight into a queue whose
 * first pose asks for a bolster and whose third asks for a chair — both
 * discovered mid-practice, lying on the floor. A preflight is not a marketing
 * screen; it is the list of things that are true about the queue you are about
 * to run, derived from that queue and nothing else.
 *
 * Every field here is computed from the catalog entries in the session. None of
 * it is authored per session, so it cannot drift from what the player does.
 */
import type { Asana } from "@/data/content";
import {
  guidedSessionSeconds,
  guidedTimeLabel,
  instructionModeDescription,
  INSTRUCTION_MODE_LABEL,
  type GuidedTimedPose,
  type InstructionMode,
} from "@/lib/guidedDuration";
import { evaluateSessionFit, type SessionFit } from "@/lib/sessionFit";
import {
  equipmentFreeSwapFor,
  equipmentNouns,
  equipmentSentence,
  sessionEquipment,
  type SessionEquipment,
} from "@/lib/sessionEquipment";
import { poseDemoAvailability } from "@/data/poseDemoAvailability";

export type PreflightPose = Asana & { sides?: "once" | "each"; holdSeconds: number };

export type SessionDifficulty = {
  /** Hardest level in the queue — the level the session actually demands. */
  level: "Beginner" | "Intermediate" | "Advanced";
  /** How many poses sit at that level. */
  atLevel: number;
  total: number;
};

export type SessionIntensity = {
  level: "Gentle" | "Moderate" | "Strong";
  /** One sentence naming why, in the practitioner's terms. */
  reason: string;
};

export type SessionModification = {
  slug: string;
  english: string;
  /** The catalog's own modification line — never rewritten here. */
  text: string;
};

export type EquipmentAlternative = {
  slug: string;
  english: string;
  swapToSlug: string;
  note: string;
};

export type SessionPreflight = {
  poseCount: number;
  totalSeconds: number;
  timeLabel: string;
  minutes: number;
  mode: InstructionMode;
  modeLabel: string;
  modeDescription: string;
  difficulty: SessionDifficulty;
  intensity: SessionIntensity;
  equipment: SessionEquipment;
  equipmentSentence: string;
  optionalEquipmentSentence: string;
  /** Swaps that remove a prop requirement, where a reviewed pair exists. */
  equipmentAlternatives: EquipmentAlternative[];
  modifications: SessionModification[];
  /** True when at least one pose has no reviewed movement demonstration. */
  usesStaticReference: boolean;
  /** Present only when a requested length could not be honoured. */
  fit: SessionFit | null;
};

const LEVEL_ORDER = { Beginner: 0, Intermediate: 1, Advanced: 2 } as const;

/** Categories that ask the body for effort rather than support it. */
const EFFORTFUL: ReadonlySet<string> = new Set([
  "Standing",
  "Core",
  "Inversions",
  "Backbends",
]);
const RESTFUL: ReadonlySet<string> = new Set(["Restorative", "Supine/Prone"]);

export function sessionDifficulty(poses: Asana[]): SessionDifficulty {
  let level: SessionDifficulty["level"] = "Beginner";
  for (const p of poses) {
    if (LEVEL_ORDER[p.difficulty] > LEVEL_ORDER[level]) level = p.difficulty;
  }
  return {
    level,
    atLevel: poses.filter((p) => p.difficulty === level).length,
    total: poses.length,
  };
}

/**
 * Intensity is about effort, not skill: a session of Beginner standing poses
 * asks more of the body than a session of Beginner restorative shapes, and the
 * difficulty badge alone cannot say so.
 */
export function sessionIntensity(poses: Asana[]): SessionIntensity {
  if (poses.length === 0) {
    return { level: "Gentle", reason: "Nothing queued yet." };
  }
  const effortful = poses.filter((p) => EFFORTFUL.has(p.category)).length;
  const restful = poses.filter((p) => RESTFUL.has(p.category)).length;
  const strongStretch = poses.filter((p) =>
    p.stretchZones.some((z) => z.intensity === "strong"),
  ).length;
  const effortShare = effortful / poses.length;
  const restShare = restful / poses.length;

  if (effortShare >= 0.5 || strongStretch >= Math.ceil(poses.length / 2)) {
    return {
      level: "Strong",
      reason: `${effortful} of ${poses.length} poses are standing, core, backbend or inversion work.`,
    };
  }
  if (effortShare <= 0.2 && restShare >= 0.5) {
    return {
      level: "Gentle",
      reason: `${restful} of ${poses.length} poses are restorative or lying down.`,
    };
  }
  return {
    level: "Moderate",
    reason: `A mix of ${effortful} active and ${restful} restful shapes.`,
  };
}

/** Catalog modification lines for the poses in this queue, deduplicated. */
export function sessionModifications(poses: Asana[]): SessionModification[] {
  const seen = new Set<string>();
  const out: SessionModification[] = [];
  for (const p of poses) {
    const text = p.modifications?.trim();
    if (!text || seen.has(p.slug)) continue;
    seen.add(p.slug);
    out.push({ slug: p.slug, english: p.english, text });
  }
  return out;
}

export function toTimedPoses(poses: PreflightPose[]): GuidedTimedPose[] {
  return poses.map((p) => ({
    holdSeconds: p.holdSeconds,
    sides: p.sides,
    slug: p.slug,
    stepCount: p.steps?.length ?? 0,
  }));
}

export function buildSessionPreflight(opts: {
  poses: PreflightPose[];
  mode?: InstructionMode;
  /** The length the practitioner asked for, when a screen asked. */
  requestedMinutes?: number | null;
}): SessionPreflight {
  const mode = opts.mode ?? "guided";
  const poses = opts.poses;
  const timed = toTimedPoses(poses);
  const totalSeconds = Math.round(guidedSessionSeconds(timed, mode));
  const equipment = sessionEquipment(poses);

  const equipmentAlternatives: EquipmentAlternative[] = [];
  for (const row of equipment.requiredBy) {
    const swap = equipmentFreeSwapFor(row.slug);
    if (!swap) continue;
    equipmentAlternatives.push({
      slug: row.slug,
      english: row.english,
      swapToSlug: swap.slug,
      note: swap.note,
    });
  }

  return {
    poseCount: poses.length,
    totalSeconds,
    timeLabel: guidedTimeLabel(totalSeconds),
    minutes: Math.max(1, Math.round(totalSeconds / 60)),
    mode,
    modeLabel: INSTRUCTION_MODE_LABEL[mode],
    modeDescription: instructionModeDescription(mode),
    difficulty: sessionDifficulty(poses),
    intensity: sessionIntensity(poses),
    equipment,
    equipmentSentence: equipmentSentence(equipment.required),
    optionalEquipmentSentence: equipmentNouns(equipment.optional),
    equipmentAlternatives,
    modifications: sessionModifications(poses),
    usesStaticReference: poses.some(
      (p) => poseDemoAvailability(p.slug).kind !== "movement",
    ),
    fit:
      opts.requestedMinutes != null
        ? evaluateSessionFit({
            requestedMinutes: opts.requestedMinutes,
            poses: timed,
            mode,
          })
        : null,
  };
}

/** "10 min · Beginner · Gentle" — the one-line spec used on cards. */
export function preflightSpecLine(p: SessionPreflight): string {
  return `${p.timeLabel} · ${p.difficulty.level} · ${p.intensity.level}`;
}

/** "You'll need a chair and a bolster (or a pillow)." Empty when nothing is needed. */
export function equipmentDisclosure(p: SessionPreflight): string {
  if (!p.equipmentSentence) return "";
  return `You'll need ${p.equipmentSentence}.`;
}
