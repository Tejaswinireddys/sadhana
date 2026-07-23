/**
 * Derive a narration-synced 3D camera / teaching moment from pose step metadata.
 * No external assets — procedural stage driven by focusZone, stepMotion, and pose key.
 */
import type { StepMotionKey } from "@/components/StepMotion";

export type FocusZone = { cx: number; cy: number; r: number; label: string };

export type PoseMomentPhase = "enter" | "align" | "hold" | "cue";

export type PoseCamera = {
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  scale: number;
  translateY: number;
};

export type PoseMoment = {
  poseKey: string;
  focusZone: FocusZone | null;
  stepMotion: StepMotionKey | null;
  phase: PoseMomentPhase;
  camera: PoseCamera;
  side: 1 | 2;
};

const PHASE_BY_MOTION: Partial<Record<StepMotionKey, PoseMomentPhase>> = {
  ground: "enter",
  settle: "hold",
  inhale: "hold",
  exhale: "hold",
  balance: "hold",
  lift: "align",
  "arm-extend": "align",
  "leg-extend": "align",
  "hip-shift": "align",
  "limb-rotate": "cue",
  "torso-fold": "cue",
  twist: "cue",
};

/** Map step index into enter → align → hold → cue when stepMotion is absent. */
export function phaseFromStepIndex(stepIndex: number, stepCount: number): PoseMomentPhase {
  if (stepCount <= 1) return "hold";
  const t = stepIndex / Math.max(1, stepCount - 1);
  if (t < 0.25) return "enter";
  if (t < 0.55) return "align";
  if (t < 0.8) return "hold";
  return "cue";
}

export function resolvePosePhase(
  stepMotion: StepMotionKey | null | undefined,
  stepIndex: number,
  stepCount: number,
): PoseMomentPhase {
  if (stepMotion && PHASE_BY_MOTION[stepMotion]) return PHASE_BY_MOTION[stepMotion]!;
  return phaseFromStepIndex(stepIndex, stepCount);
}

/**
 * Camera aimed at the active focus region so the “correct moment” is readable.
 * Coordinates are normalized 0–1 (portrait figure).
 */
export function cameraForMoment(
  focus: FocusZone | null | undefined,
  phase: PoseMomentPhase,
  side: 1 | 2 = 1,
): PoseCamera {
  const cx = focus?.cx ?? 0.5;
  const cy = focus?.cy ?? 0.48;
  const r = focus?.r ?? 0.28;

  const sideSign = side === 2 ? -1 : 1;
  let rotateY = (0.5 - cx) * 32 * sideSign;
  let rotateX = (cy - 0.42) * 22;
  let scale = 1 + Math.max(0, 0.32 - r) * 0.55;
  let translateY = (0.5 - cy) * 8;
  let rotateZ = (0.5 - cx) * 4 * sideSign;

  switch (phase) {
    case "enter":
      rotateY *= 0.55;
      rotateX = Math.min(rotateX, 6) - 2;
      scale *= 0.92;
      translateY += 4;
      break;
    case "align":
      scale *= 1.04;
      break;
    case "hold":
      rotateY *= 0.75;
      scale *= 1.02;
      break;
    case "cue":
      scale *= 1.08;
      rotateY *= 1.15;
      rotateX *= 1.1;
      break;
  }

  return {
    rotateX: Math.max(-18, Math.min(20, rotateX)),
    rotateY: Math.max(-28, Math.min(28, rotateY)),
    rotateZ: Math.max(-8, Math.min(8, rotateZ)),
    scale: Math.max(0.86, Math.min(1.18, scale)),
    translateY: Math.max(-10, Math.min(12, translateY)),
  };
}

export function buildPoseMoment(opts: {
  poseKey: string;
  focusZone?: FocusZone | null;
  stepMotion?: StepMotionKey | null;
  stepIndex?: number;
  stepCount?: number;
  side?: 1 | 2;
}): PoseMoment {
  const stepIndex = opts.stepIndex ?? 0;
  const stepCount = Math.max(1, opts.stepCount ?? 1);
  const phase = resolvePosePhase(opts.stepMotion, stepIndex, stepCount);
  const side = opts.side ?? 1;
  const focusZone = opts.focusZone ?? null;
  return {
    poseKey: opts.poseKey,
    focusZone,
    stepMotion: opts.stepMotion ?? null,
    phase,
    camera: cameraForMoment(focusZone, phase, side),
    side,
  };
}
