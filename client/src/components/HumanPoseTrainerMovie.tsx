/**
 * HumanPoseTrainerMovie — Phase-synchronized studio pose guide & movement trainer.
 *
 * Uses the high-resolution pose artwork (`/poses/{slug}.png`) and renders a
 * synchronized studio teaching stage:
 *   1. Automatic figure-bounding-box framing & edge-sampled studio background
 *      extension so wide poses (Warrior II, Downward Dog, Cobra) fill the
 *      widescreen stage cleanly without letterboxed whitespace.
 *   2. Phase-synchronized postural articulation across Setup (`preparation`),
 *      Step-by-step Entry (`entry`), Breath-paced Hold (`hold` / `cycle`),
 *      and Exact Exit to neutral (`exit` / `side_change`), plus Difficulty
 *      Adaptation (`beginner` shortened stance / partial bend / wall kickstand).
 *   3. Interactive Kinematic Movement & Modification Guide card in the upper-right
 *      corner of the stage showing the trainer's live joint progression from
 *      Starting Position → Entry Steps → Hold (with selected Beginner/Intermediate/Advanced
 *      modification and props) → Return to Neutral.
 *   4. Anatomical alignment callout ring + pointer label synced to the current
 *      spoken cue, and synchronized breath pacer indicator.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { asanaBySlug } from "@/data/content";
import { poseImageAlt } from "@/data/poseImageAlts";
import { accurateImageAlt, poseImageWithheld } from "@/data/poseImageAccuracy";
import { WithheldPoseImage } from "@/components/WithheldPoseImage";
import { useMotionEnabled } from "@/components/motion";
import type { LessonPhase, VariationLevel } from "@/lib/poseLesson";
import { cn } from "@/lib/utils";
import { UserCheck, Wind } from "lucide-react";

export type TrainerCameraShot = "auto" | "front" | "side";
export type BreathMode = "inhale" | "exhale" | "steady";

export type CalloutPoint = {
  /** Normalized 0..1 coordinates within the cropped figure bounding box */
  x: number;
  y: number;
  label: string;
  detail: string;
};

export type FigureCropBox = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  bgColor: string;
};

export type HumanPoseTrainerMovieProps = {
  slug: string;
  english: string;
  sanskrit?: string;
  posterSrc: string;
  playing: boolean;
  training?: boolean;
  level?: VariationLevel;
  phase?: LessonPhase | "side_switch" | "transition";
  stepIndex?: number;
  stepCount?: number;
  stepProgress?: number;
  side?: 1 | 2;
  breathMode?: BreathMode;
  breathCue?: string | null;
  cueText?: string | null;
  coachBadge?: string | null;
  cameraView?: TrainerCameraShot;
  className?: string;
  "data-testid"?: string;
};

/**
 * Derive an accurate anatomical callout point on the instructor figure
 * (normalized 0..1 within the cropped figure bounds) from the active step cue
 * text, phase, and selected difficulty level.
 */
export function resolveAnatomicalCallout(
  slug: string,
  cueText: string | null | undefined,
  stepIndex: number,
  phase?: string,
  level: VariationLevel = "intermediate",
): CalloutPoint {
  const cue = (cueText ?? "").toLowerCase();
  const asana = asanaBySlug(slug);
  const cat = asana?.category ?? "Standing";
  const isAllFours =
    slug.includes("marjaryasana") ||
    slug.includes("bitilasana") ||
    slug.includes("balasana") ||
    slug.includes("plank") ||
    slug.includes("kumbhakasana") ||
    /all fours|tabletop|hands and knees/i.test(cue);
  const isSupine =
    slug.includes("savasana") ||
    slug.includes("setu") ||
    slug.includes("supta") ||
    cat === "Restorative";

  if (phase === "exit" || phase === "side_change" || phase === "side_switch") {
    return {
      x: 0.5,
      y: 0.62,
      label: "Controlled Return to Neutral",
      detail: "Unwind step by step in reverse order back to your starting position",
    };
  }

  if (isAllFours) {
    if (/wrist|palm|hand|shoulder/i.test(cue)) {
      return {
        x: 0.72,
        y: 0.68,
        label: level === "beginner" ? "Hands & Padded Knees" : "Hands & Shoulders",
        detail: "Spread fingers wide; stack wrists directly under shoulders",
      };
    }
    if (/belly|inhale|tailbone|arch|cow|gaze|chest/i.test(cue)) {
      return {
        x: 0.52,
        y: 0.42,
        label: "Cow · Spinal Extension",
        detail: "Inhale: lengthen sternum forward and tilt sit-bones up",
      };
    }
    if (/round|exhale|chin|navel|cat|press/i.test(cue)) {
      return {
        x: 0.48,
        y: 0.36,
        label: "Cat · Spinal Flexion",
        detail: "Exhale: draw navel in and dome the upper back toward the ceiling",
      };
    }
    return {
      x: 0.32,
      y: 0.68,
      label: "Tabletop Foundation",
      detail: "Ground shins and tops of feet evenly into the mat",
    };
  }

  if (isSupine) {
    if (/breath|belly|chest|rib/i.test(cue)) {
      return {
        x: 0.48,
        y: 0.48,
        label: "Diaphragmatic Breath",
        detail: "Allow the ribcage and belly to rise and soften effortlessly",
      };
    }
    return {
      x: 0.5,
      y: 0.54,
      label: "Full-Body Release",
      detail: "Let shoulders, hips, and heels melt into the studio floor",
    };
  }

  if (slug === "virabhadrasana-ii" && level === "beginner" && /knee|bend|partway|stance/i.test(cue)) {
    return {
      x: 0.36,
      y: 0.66,
      label: "Beginner · Partial Knee Bend (45°–60°)",
      detail: "Shortened stance; bend front knee partway without forcing 90°",
    };
  }

  if (slug === "vrksasana" && level === "beginner") {
    return {
      x: 0.48,
      y: 0.84,
      label: "Beginner · Kickstand at Ankle + Wall",
      detail: "Keep toes on the floor against the inner ankle with one hand on a wall",
    };
  }

  // Standing / Seated / Balancing poses (within tight figure crop)
  if (/knee|thigh|hip|pelvis|sink|bend/i.test(cue)) {
    return {
      x: 0.36,
      y: 0.64,
      label: "Hip & Knee Alignment",
      detail: "Track the knee cleanly in line with the middle toes; level the pelvis",
    };
  }
  if (/foot|feet|ankle|heel|toe|stance|sole|ground|root|kickstand/i.test(cue)) {
    return {
      x: 0.5,
      y: 0.88,
      label: "Grounded Foundation",
      detail: "Press evenly through all four corners of the feet",
    };
  }
  if (/arm|shoulder|reach|hand|palm|prayer|heart|chest/i.test(cue)) {
    return {
      x: 0.5,
      y: 0.28,
      label: "Shoulder & Chest Opening",
      detail: "Broaden across the collarbones and soften the tops of the shoulders",
    };
  }
  if (/gaze|drishti|head|neck|crown|chin/i.test(cue)) {
    return {
      x: 0.5,
      y: 0.12,
      label: "Drishti · Steady Gaze",
      detail: "Lengthen the back of the neck and rest the gaze on one calm point",
    };
  }

  if (phase === "preparation" || stepIndex === 0) {
    return {
      x: 0.5,
      y: 0.84,
      label: "Starting Position & Setup",
      detail: "Establish a steady base on the mat before moving deeper",
    };
  }
  if (phase === "hold") {
    return {
      x: 0.5,
      y: 0.32,
      label: "Steady Breath & Hold",
      detail: "Breathe smoothly through the nose while maintaining active alignment",
    };
  }
  return {
    x: 0.5,
    y: 0.45,
    label: "Core & Spine Alignment",
    detail: "Lengthen through the spine and move with the rhythm of your breath",
  };
}

/**
 * Compute how far into the target posture (`0` = neutral starting position,
 * `1` = full target pose depth for the selected variation) the trainer is at
 * the current phase and step progress.
 */
export function resolvePhasePoseDepth(opts: {
  phase?: string;
  stepIndex: number;
  stepCount: number;
  stepProgress: number;
  level: VariationLevel;
  training: boolean;
}): {
  /** 0 = neutral starting stance, 1 = peak pose depth */
  poseDepth: number;
  /** Target max depth for the selected variation (beginner = gentler range) */
  variationCap: number;
  phaseLabel: string;
} {
  const { phase, stepIndex, stepCount, stepProgress, level, training } = opts;
  const variationCap = level === "beginner" ? 0.68 : level === "advanced" ? 1.0 : 0.9;
  const p = Math.max(0, Math.min(1, stepProgress));

  if (!training || !phase) {
    return {
      poseDepth: variationCap,
      variationCap,
      phaseLabel: level === "beginner" ? "Beginner modification" : "Target alignment",
    };
  }

  if (phase === "preparation" || phase === "transition") {
    // Starts in neutral starting position and steps into initial stance setup
    const d = (0.12 + 0.26 * p) * variationCap;
    return { poseDepth: d, variationCap, phaseLabel: "1 · Starting position" };
  }

  if (phase === "entry") {
    const entrySteps = Math.max(1, stepCount - 1);
    const stepIdx = Math.max(0, Math.min(entrySteps - 1, stepIndex));
    const startFrac = 0.38 + (stepIdx / entrySteps) * 0.55;
    const endFrac = 0.38 + ((stepIdx + 1) / entrySteps) * 0.58;
    const d = (startFrac + (endFrac - startFrac) * p) * variationCap;
    return {
      poseDepth: d,
      variationCap,
      phaseLabel: `2 · Step ${stepIdx + 1} movement`,
    };
  }

  if (phase === "cycle") {
    return {
      poseDepth: variationCap,
      variationCap,
      phaseLabel: "3 · Breath-paced flow",
    };
  }

  if (phase === "hold") {
    return {
      poseDepth: variationCap,
      variationCap,
      phaseLabel: level === "beginner" ? "3 · Hold (beginner option)" : "3 · Steady hold",
    };
  }

  if (phase === "side_change" || phase === "side_switch") {
    // Unwinds from hold depth back to neutral (0.15) to switch sides
    const d = variationCap * (1 - 0.85 * p);
    return { poseDepth: d, variationCap, phaseLabel: "Release to switch sides" };
  }

  // phase === "exit"
  const d = variationCap * (1 - 0.88 * p);
  return { poseDepth: d, variationCap, phaseLabel: "4 · Exact exit to neutral" };
}

/**
 * Draw an articulated kinematic human trainer guide card in the upper-right of
 * the canvas showing the exact body movement from Starting Position -> Entry ->
 * Hold (with selected Beginner/Intermediate/Advanced modification & props) ->
 * Return to Neutral.
 */
function drawKinematicTrainerInset(opts: {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  slug: string;
  level: VariationLevel;
  poseDepth: number;
  phaseLabel: string;
  breathWave: number;
  side: 1 | 2;
}) {
  const { ctx, w, h, slug, level, poseDepth, phaseLabel, breathWave, side } = opts;
  if (w < 240 || h < 150) return;

  const cardW = Math.min(138, Math.max(108, w * 0.27));
  const cardH = Math.min(116, Math.max(92, h * 0.34));
  const cardX = w - cardW - 8;
  const cardY = 8;

  ctx.save();
  // Card backdrop
  ctx.fillStyle = "rgba(251, 247, 240, 0.93)";
  ctx.strokeStyle = "rgba(74, 107, 82, 0.42)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 10);
  ctx.fill();
  ctx.stroke();

  // Header label
  ctx.fillStyle = "#2c3e2e";
  ctx.font = "600 9.5px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(phaseLabel, cardX + 7, cardY + 5);

  // Modification sub-badge
  const modText =
    level === "beginner"
      ? slug === "vrksasana"
        ? "Kickstand + wall"
        : slug === "virabhadrasana-ii"
          ? "Short stance · ~50° knee"
          : slug === "marjaryasana-bitilasana"
            ? "Gentle arc + blanket"
            : "Beginner modification"
      : level === "advanced"
        ? "Full expression"
        : "Standard alignment";
  ctx.fillStyle = "#5c6f5e";
  ctx.font = "500 8.5px system-ui, -apple-system, sans-serif";
  ctx.fillText(modText, cardX + 7, cardY + 17);

  // Floor mat line inside the inset
  const matY = cardY + cardH - 16;
  const centerX = cardX + cardW * 0.5;
  ctx.strokeStyle = "rgba(122, 92, 67, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cardX + 12, matY);
  ctx.lineTo(cardX + cardW - 12, matY);
  ctx.stroke();

  // Draw articulated stick-figure trainer inside the inset
  const dir = side === 2 ? -1 : 1;
  const scale = Math.min(cardW, cardH) * 0.0068;

  ctx.save();
  ctx.translate(centerX, matY);
  ctx.scale(dir, 1);

  const isCatCow = slug.includes("marjaryasana") || slug.includes("bitilasana");
  const isTree = slug === "vrksasana";
  const isFold = slug === "uttanasana" || slug === "ardha-uttanasana" || slug === "paschimottanasana";
  const isChild = slug.includes("balasana");

  ctx.strokeStyle = "#3b5d43";
  ctx.fillStyle = "#3b5d43";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (isCatCow) {
    // All-fours tabletop with dynamic spinal arch (Cow) and dome (Cat)
    const kneeX = -22 * scale;
    const wristX = 22 * scale;
    const hipY = -28 * scale;
    const shoulderY = -30 * scale;
    const archOffset = breathWave * 11 * scale * Math.max(0.35, poseDepth);

    // Optional folded blanket under knees in beginner mode
    if (level === "beginner") {
      ctx.fillStyle = "rgba(196, 109, 78, 0.45)";
      ctx.fillRect(kneeX - 8 * scale, -4 * scale, 16 * scale, 4 * scale);
      ctx.fillStyle = "#3b5d43";
    }

    // Knees/shins and arms
    ctx.beginPath();
    ctx.moveTo(kneeX - 10 * scale, 0);
    ctx.lineTo(kneeX, 0);
    ctx.lineTo(kneeX, hipY);
    ctx.moveTo(wristX, 0);
    ctx.lineTo(wristX, shoulderY);
    ctx.stroke();

    // Articulated spine curve
    ctx.beginPath();
    ctx.moveTo(kneeX, hipY);
    ctx.quadraticCurveTo(0, (hipY + shoulderY) * 0.5 + archOffset, wristX, shoulderY);
    ctx.stroke();

    // Head
    const headY = shoulderY - 4 * scale - archOffset * 0.45;
    ctx.beginPath();
    ctx.arc(wristX + 9 * scale, headY, 5.5 * scale, 0, Math.PI * 2);
    ctx.fill();
  } else if (isTree) {
    // Standing on left leg, lifted foot either at ankle kickstand (beginner) or inner thigh
    const hipY = -38 * scale;
    const shoulderY = -66 * scale;
    const liftT = poseDepth;

    // Wall prop on left side for beginner
    if (level === "beginner") {
      ctx.strokeStyle = "rgba(196, 109, 78, 0.65)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-36 * scale, 0);
      ctx.lineTo(-36 * scale, -84 * scale);
      ctx.stroke();
      ctx.strokeStyle = "#3b5d43";
      ctx.lineWidth = 2.2;
    }

    // Standing leg
    ctx.beginPath();
    ctx.moveTo(-4 * scale, 0);
    ctx.lineTo(-4 * scale, hipY);
    ctx.lineTo(-4 * scale, shoulderY);
    ctx.stroke();

    // Lifted leg: beginner keeps toes on floor at ankle; intermediate/advanced lifts to calf/thigh
    const footY = level === "beginner" ? -2 * scale * liftT : -24 * scale * liftT;
    const kneeOutX = (-4 + (level === "beginner" ? 13 : 20) * liftT) * scale;
    const kneeOutY = (level === "beginner" ? -16 : -26) * scale * liftT + (1 - liftT) * (-18 * scale);
    ctx.beginPath();
    ctx.moveTo(-4 * scale, hipY);
    ctx.lineTo(kneeOutX, kneeOutY);
    ctx.lineTo(-1 * scale, footY);
    ctx.stroke();

    // Arms: beginner reaches one hand to wall & one to heart; others prayer/overhead
    ctx.beginPath();
    if (level === "beginner") {
      ctx.moveTo(-4 * scale, shoulderY + 4 * scale);
      ctx.lineTo(-35 * scale, shoulderY + 8 * scale);
      ctx.moveTo(-4 * scale, shoulderY + 4 * scale);
      ctx.lineTo(6 * scale, shoulderY + 14 * scale);
    } else {
      const armRaise = Math.max(0, (liftT - 0.4) / 0.6);
      ctx.moveTo(-4 * scale, shoulderY + 4 * scale);
      ctx.lineTo((-4 - 10) * scale, shoulderY + (12 - 26 * armRaise) * scale);
      ctx.moveTo(-4 * scale, shoulderY + 4 * scale);
      ctx.lineTo((-4 + 10) * scale, shoulderY + (12 - 26 * armRaise) * scale);
    }
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.arc(-4 * scale, shoulderY - 9 * scale, 6 * scale, 0, Math.PI * 2);
    ctx.fill();
  } else if (isFold || isChild) {
    // Standing -> Hip hinge forward fold (with generous knee bend in beginner)
    const foldT = poseDepth;
    const hipX = -6 * scale * foldT;
    const hipY = -38 * scale + 4 * scale * foldT;
    const kneeBend = (level === "beginner" ? 8 : 3) * scale * foldT;
    const torsoAngle = -Math.PI * 0.5 + foldT * (level === "beginner" ? 1.85 : 2.25);
    const shoulderX = hipX + Math.cos(torsoAngle) * 28 * scale;
    const shoulderY = hipY + Math.sin(torsoAngle) * 28 * scale;

    // Legs with soft knee bend
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(kneeBend, -19 * scale);
    ctx.lineTo(hipX, hipY);
    ctx.lineTo(shoulderX, shoulderY);
    ctx.stroke();

    // Arms hanging toward shins/blocks/floor
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(shoulderX + 4 * scale, Math.min(-2 * scale, shoulderY + 22 * scale * foldT));
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.arc(
      shoulderX + Math.cos(torsoAngle) * 8 * scale,
      shoulderY + Math.sin(torsoAngle) * 8 * scale,
      5.5 * scale,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  } else {
    // Standing / Lunge family (Warrior II, Warrior I, Triangle, Mountain, etc.)
    // Transitions smoothly from Mountain Pose (poseDepth=0) -> Wide stance -> Front knee bend -> Arms extended
    const stanceT = Math.min(1, poseDepth * 1.35);
    const bendT = Math.max(0, (poseDepth - 0.2) / 0.8);
    const armT = Math.max(0, (poseDepth - 0.35) / 0.65);

    const maxSpread = level === "beginner" ? 21 : 30;
    const spread = (4 + (maxSpread - 4) * stanceT) * scale;
    const hipDrop = (level === "beginner" ? 7 : 13) * bendT * scale;
    const hipY = -40 * scale + hipDrop;
    const shoulderY = hipY - 27 * scale - breathWave * 1.5 * scale;

    const backFootX = -spread;
    const frontFootX = spread;
    // Front knee stacks over front ankle as bendT increases
    const frontKneeX = frontFootX * (0.45 + 0.52 * bendT);
    const frontKneeY = hipY * 0.52;

    // Back leg + Front bending leg + Torso
    ctx.beginPath();
    ctx.moveTo(backFootX, 0);
    ctx.lineTo(0, hipY);
    ctx.lineTo(frontKneeX, frontKneeY);
    ctx.lineTo(frontFootX, 0);
    ctx.moveTo(0, hipY);
    ctx.lineTo(0, shoulderY);
    ctx.stroke();

    // Arms: rise from sides/hips to T-shape (or hands-on-hips option indicator)
    const armSpan = (6 + 24 * armT) * scale;
    const armY = shoulderY + (16 * (1 - armT) + 2) * scale;
    ctx.beginPath();
    ctx.moveTo(-armSpan, armY);
    ctx.lineTo(0, shoulderY + 3 * scale);
    ctx.lineTo(armSpan, armY);
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.arc(0, shoulderY - 8 * scale, 6 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Phase progress bar along the bottom of the inset card
  const barX = cardX + 8;
  const barY = cardY + cardH - 8;
  const barW = cardW - 16;
  ctx.fillStyle = "rgba(74, 107, 82, 0.16)";
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, 3.5, 2);
  ctx.fill();

  ctx.fillStyle = "#4a6b52";
  ctx.beginPath();
  ctx.roundRect(barX, barY, Math.max(6, barW * Math.min(1, poseDepth / (level === "beginner" ? 0.68 : 0.9))), 3.5, 2);
  ctx.fill();

  ctx.restore();
}

const cropCache = new Map<string, FigureCropBox>();

/**
 * Compute the non-whitespace bounding box and corner paper color of the pose
 * illustration so 600×1200 canvases with wide horizontal poses (e.g. Warrior II)
 * are framed around the actual human body with zero wasted vertical whitespace.
 */
function measureFigureCropBox(img: HTMLImageElement, srcKey: string): FigureCropBox {
  const cached = cropCache.get(srcKey);
  if (cached) return cached;

  const w = img.naturalWidth || 600;
  const h = img.naturalHeight || 1200;

  try {
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const octx = off.getContext("2d");
    if (!octx) throw new Error("no 2d context");
    octx.drawImage(img, 0, 0);
    const data = octx.getImageData(0, 0, w, h).data;
    const bgR = data[0] ?? 248;
    const bgG = data[1] ?? 234;
    const bgB = data[2] ?? 208;
    const bgColor = `rgb(${bgR}, ${bgG}, ${bgB})`;

    let minX = w;
    let maxX = 0;
    let minY = h;
    let maxY = 0;

    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        const idx = (y * w + x) * 4;
        const d = Math.max(
          Math.abs(data[idx]! - bgR),
          Math.abs(data[idx + 1]! - bgG),
          Math.abs(data[idx + 2]! - bgB),
        );
        if (d > 20) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX <= minX || maxY <= minY) {
      const fallback = { sx: 0, sy: 0, sw: w, sh: h, bgColor };
      cropCache.set(srcKey, fallback);
      return fallback;
    }

    // Add 6% breathing room around the detected human figure
    const padX = Math.round((maxX - minX) * 0.06);
    const padY = Math.round((maxY - minY) * 0.06);
    const sx = Math.max(0, minX - padX);
    const sy = Math.max(0, minY - padY);
    const ex = Math.min(w, maxX + padX);
    const ey = Math.min(h, maxY + padY);
    const box: FigureCropBox = {
      sx,
      sy,
      sw: Math.max(1, ex - sx),
      sh: Math.max(1, ey - sy),
      bgColor,
    };
    cropCache.set(srcKey, box);
    return box;
  } catch {
    return { sx: 0, sy: 0, sw: w, sh: h, bgColor: "rgb(247, 233, 207)" };
  }
}

/**
 * Draw the human instructor image onto a 28-slice horizontal mesh driven by
 * `poseDepth` (setup -> entry -> hold -> exit) and `level` (`beginner` vs
 * `intermediate`/`advanced`), plus the synchronized kinematic movement inset.
 */
function renderArticulatedHumanFrame(opts: {
  ctx: CanvasRenderingContext2D;
  img: HTMLImageElement;
  crop: FigureCropBox;
  w: number;
  h: number;
  tSec: number;
  playing: boolean;
  training: boolean;
  level: VariationLevel;
  phase?: string;
  stepIndex: number;
  stepCount: number;
  breathMode: BreathMode;
  stepProgress: number;
  side: 1 | 2;
  cameraView: TrainerCameraShot;
  slug: string;
  callout: CalloutPoint;
  motionEnabled: boolean;
}) {
  const {
    ctx,
    img,
    crop,
    w,
    h,
    tSec,
    playing,
    training,
    level,
    phase,
    stepIndex,
    stepCount,
    breathMode,
    stepProgress,
    side,
    cameraView,
    slug,
    callout,
    motionEnabled,
  } = opts;

  ctx.clearRect(0, 0, w, h);

  // 1. Seamless studio backdrop using the exact corner color of the artwork
  ctx.fillStyle = crop.bgColor;
  ctx.fillRect(0, 0, w, h);

  // 2. Subtle warm studio sunbeam wash from upper-right window
  ctx.save();
  const beamPhase = motionEnabled && playing ? Math.sin(tSec * 0.45) * 0.015 : 0;
  const beamGrad = ctx.createLinearGradient(w * (0.85 + beamPhase), 0, w * 0.18, h * 0.88);
  beamGrad.addColorStop(0, "rgba(255, 251, 242, 0.36)");
  beamGrad.addColorStop(0.5, "rgba(255, 247, 232, 0.12)");
  beamGrad.addColorStop(1, "rgba(255, 247, 232, 0)");
  ctx.fillStyle = beamGrad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // 3. Compute aspect-preserving placement for the cropped human instructor figure
  const figAspect = crop.sw / crop.sh;
  const padTop = h * 0.04;
  const padBottom = h * 0.07;
  const availH = Math.max(1, h - padTop - padBottom);
  const availW = w * 0.92;

  let drawH = availH;
  let drawW = drawH * figAspect;
  if (drawW > availW) {
    drawW = availW;
    drawH = drawW / figAspect;
  }

  const baseX = (w - drawW) / 2;
  const baseY = padTop + (availH - drawH) / 2;

  const { poseDepth, phaseLabel } = resolvePhasePoseDepth({
    phase,
    stepIndex,
    stepCount,
    stepProgress,
    level,
    training,
  });

  // Grounding breath aura on the studio floor directly beneath the instructor's feet
  const breathCycle =
    breathMode === "inhale"
      ? Math.sin(Math.min(1, Math.max(0, stepProgress)) * (Math.PI / 2))
      : breathMode === "exhale"
        ? Math.cos(Math.min(1, Math.max(0, stepProgress)) * (Math.PI / 2))
        : (Math.sin(tSec * (playing ? 1.25 : 0.75)) + 1) * 0.5;

  const auraRadiusX = Math.min(
    w * 0.36,
    drawW * (0.36 + 0.14 * poseDepth + (motionEnabled ? breathCycle * 0.04 : 0)),
  );
  const auraRadiusY = Math.max(4, h * 0.026);
  const feetY = baseY + drawH * 0.965;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(w * 0.5, feetY, auraRadiusX, auraRadiusY, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(122, 92, 67, 0.09)";
  ctx.fill();
  ctx.lineWidth = 1.25;
  ctx.strokeStyle =
    breathMode === "inhale"
      ? "rgba(88, 129, 87, 0.38)"
      : breathMode === "exhale"
        ? "rgba(196, 109, 78, 0.38)"
        : "rgba(122, 92, 67, 0.22)";
  ctx.stroke();
  ctx.restore();

  // 4. Smooth camera framing
  let camScale = 1;
  let camFocusY = 0.5;
  if (cameraView === "front") {
    camScale = 1 + (motionEnabled && playing ? Math.sin(tSec * 0.35) * 0.014 : 0);
    camFocusY = 0.5;
  } else if (cameraView === "side") {
    camScale = 1.08;
    camFocusY = Math.max(0.32, Math.min(0.68, callout.y));
  } else {
    camScale = 1 + (motionEnabled && playing ? Math.sin(tSec * 0.4) * 0.012 : 0);
    camFocusY = 0.5;
  }

  ctx.save();
  const focalX = w * 0.5;
  const focalY = baseY + drawH * camFocusY;
  ctx.translate(focalX, focalY);
  ctx.scale(side === 2 ? -camScale : camScale, camScale);
  ctx.translate(-focalX, -focalY);

  // 5. Render the human instructor through a 28-slice phase-aware anatomical mesh:
  //    - During `preparation` and `exit`, wide stances (Warrior II, Triangle, Lunges)
  //      narrow toward neutral standing alignment and lift slightly taller (`poseDepth`).
  //    - In `beginner` mode, stances stay visibly more compact (~82% width) and higher
  //      so the figure reflects the shortened stance / partial knee bend modification.
  const SLICES = 28;
  const isAllFours =
    slug.includes("marjaryasana") ||
    slug.includes("bitilasana") ||
    slug.includes("balasana");

  const activeMotion = motionEnabled && playing;
  const breathWave = activeMotion
    ? breathMode === "inhale"
      ? Math.sin(Math.min(1, Math.max(0, stepProgress)) * (Math.PI / 2))
      : breathMode === "exhale"
        ? -0.75 * Math.sin(Math.min(1, Math.max(0, stepProgress)) * (Math.PI / 2))
        : Math.sin(tSec * 1.35)
    : 0;

  const swayWave = activeMotion ? Math.sin(tSec * 0.72) : 0;
  // How much the figure is currently upright/narrowed toward neutral vs settled in full pose
  const neutralBlend = 1 - poseDepth;

  for (let i = 0; i < SLICES; i++) {
    const v0 = i / SLICES;
    const v1 = (i + 1) / SLICES;
    const vMid = (v0 + v1) * 0.5;

    // Anatomical envelope: feet (v=0.92..1.0) stay pinned to the mat
    const footAnchor = Math.max(0, Math.min(1, (0.94 - vMid) / 0.55));
    // Lower body stance envelope (hips, knees, ankles: v=0.48..0.98)
    const lowerStanceEnv = Math.max(0, Math.min(1, (vMid - 0.42) / 0.45));
    // Arm span envelope (shoulders & outstretched arms: v=0.18..0.44)
    const armSpanEnv = Math.exp(-Math.pow((vMid - 0.28) / 0.14, 2));

    let dx = 0;
    let dy = 0;
    let scaleX = 1;

    if (isAllFours) {
      const spineBell = Math.exp(-Math.pow((vMid - 0.44) / 0.2, 2));
      const headBell = Math.exp(-Math.pow((vMid - 0.3) / 0.16, 2));
      const phaseAmp = 0.4 + 0.6 * poseDepth;
      dy = (-breathWave * spineBell * drawH * 0.03 + breathWave * headBell * drawH * 0.014) * phaseAmp;
      scaleX = 1 + Math.abs(breathWave) * spineBell * 0.022 * phaseAmp;
      dx = swayWave * spineBell * drawW * 0.005;
    } else {
      const chestBell = Math.exp(-Math.pow((vMid - 0.32) / 0.16, 2));
      const bellyBell = Math.exp(-Math.pow((vMid - 0.46) / 0.14, 2));
      // Phase-driven stance & arm progression:
      // At setup/exit (`neutralBlend` high), lower stance narrows by up to 22% and
      // torso stands taller by up to 3.5% of height, then widens/sinks into the pose
      // across entry steps (`poseDepth` 0.15 -> 1.0).
      const stanceScale = 1 - neutralBlend * (lowerStanceEnv * 0.22 + armSpanEnv * 0.18);
      scaleX =
        stanceScale *
        (1 + breathWave * (chestBell * 0.022 + bellyBell * 0.016));
      dy =
        -neutralBlend * footAnchor * drawH * 0.034 -
        breathWave * footAnchor * drawH * 0.008;
      dx = swayWave * footAnchor * drawW * 0.005;
    }

    const sy0 = crop.sy + v0 * crop.sh;
    const sy1 = crop.sy + v1 * crop.sh;
    const sh = Math.max(1, sy1 - sy0);

    const dy0 = baseY + v0 * drawH + dy;
    const dh = (v1 - v0) * drawH + 0.9;
    const sliceW = drawW * scaleX;
    const dx0 = baseX + (drawW - sliceW) * 0.5 + dx;

    ctx.drawImage(img, crop.sx, sy0, crop.sw, sh, dx0, dy0, sliceW, dh);
  }

  ctx.restore();

  // 6. Draw synchronized Kinematic Trainer & Modification Guide Card in upper-right
  if (training || level !== "intermediate") {
    drawKinematicTrainerInset({
      ctx,
      w,
      h,
      slug,
      level,
      poseDepth,
      phaseLabel,
      breathWave,
      side,
    });
  }

  // 7. Anatomical coaching callout ring + label in screen space (never mirrored)
  if (training) {
    const effectiveCalloutX = side === 2 ? 1 - callout.x : callout.x;
    const cx = baseX + drawW * effectiveCalloutX;
    const cy = baseY + drawH * callout.y;
    const pulse = activeMotion ? 1 + 0.12 * Math.sin(tSec * 3.2) : 1;
    const rOuter = Math.max(14, Math.min(28, Math.min(drawW, drawH) * 0.09)) * pulse;

    const halo = ctx.createRadialGradient(cx, cy, rOuter * 0.15, cx, cy, rOuter * 1.45);
    halo.addColorStop(0, "rgba(92, 126, 96, 0.28)");
    halo.addColorStop(0.7, "rgba(92, 126, 96, 0.12)");
    halo.addColorStop(1, "rgba(92, 126, 96, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter * 1.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(74, 107, 82, 0.85)";
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(74, 107, 82, 0.95)";
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();

    const labelText = callout.label;
    ctx.font = "600 11px system-ui, -apple-system, sans-serif";
    const textW = ctx.measureText(labelText).width;
    const pillW = textW + 16;
    const pillH = 22;
    const pillX = Math.max(8, Math.min(w - pillW - 8, cx + rOuter * 0.85));
    const pillY = Math.max(32, Math.min(h - 44, cy - pillH * 0.5));

    ctx.strokeStyle = "rgba(74, 107, 82, 0.65)";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(cx + rOuter * 0.5, cy);
    ctx.lineTo(pillX, pillY + pillH * 0.5);
    ctx.stroke();

    ctx.fillStyle = "rgba(251, 247, 240, 0.94)";
    ctx.strokeStyle = "rgba(74, 107, 82, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 11);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#2c3e2e";
    ctx.textBaseline = "middle";
    ctx.fillText(labelText, pillX + 8, pillY + pillH * 0.5);
  }

  // 8. Subtle warm cinema vignette around the studio frame
  const vig = ctx.createRadialGradient(
    w * 0.5,
    h * 0.48,
    Math.min(w, h) * 0.42,
    w * 0.5,
    h * 0.5,
    Math.max(w, h) * 0.75,
  );
  vig.addColorStop(0, "rgba(62, 46, 32, 0)");
  vig.addColorStop(1, "rgba(62, 46, 32, 0.08)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

export function HumanPoseTrainerMovie({
  slug,
  english,
  posterSrc,
  playing,
  training = false,
  level = "intermediate",
  phase,
  stepIndex = 0,
  stepCount = 4,
  stepProgress = 1,
  side = 1,
  breathMode = "steady",
  breathCue = null,
  cueText = null,
  coachBadge = null,
  cameraView = "auto",
  className,
  "data-testid": testId,
}: HumanPoseTrainerMovieProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const cropRef = useRef<FigureCropBox | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const motionOn = useMotionEnabled();

  const callout = useMemo(
    () => resolveAnatomicalCallout(slug, cueText, stepIndex, phase, level),
    [slug, cueText, stepIndex, phase, level],
  );

  const depthInfo = useMemo(
    () =>
      resolvePhasePoseDepth({
        phase,
        stepIndex,
        stepCount,
        stepProgress,
        level,
        training,
      }),
    [phase, stepIndex, stepCount, stepProgress, level, training],
  );

  const stateRef = useRef({
    playing,
    training,
    level,
    phase,
    stepIndex,
    stepCount,
    breathMode,
    stepProgress,
    side,
    cameraView,
    slug,
    callout,
    motionOn,
  });
  stateRef.current = {
    playing,
    training,
    level,
    phase,
    stepIndex,
    stepCount,
    breathMode,
    stepProgress,
    side,
    cameraView,
    slug,
    callout,
    motionOn,
  };

  useEffect(() => {
    setImgLoaded(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      cropRef.current = measureFigureCropBox(img, posterSrc);
      setImgLoaded(true);
    };
    img.src = posterSrc;
    return () => {
      img.onload = null;
    };
  }, [posterSrc]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const crop = cropRef.current;
    if (!canvas || !img || !crop || !imgLoaded) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, parent.clientWidth);
      const h = Math.max(1, parent.clientHeight);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (ro && canvas.parentElement) ro.observe(canvas.parentElement);

    let raf = 0;
    const start = performance.now();
    let lastRealPaint = -Infinity;

    const paint = (now: number) => {
      raf = requestAnimationFrame(paint);
      const realNow = typeof Event !== "undefined" ? new Event("").timeStamp : now;
      if (realNow - lastRealPaint < 30) return;
      lastRealPaint = realNow;

      const parent = canvas.parentElement;
      if (!parent) return;
      const w = Math.max(1, parent.clientWidth);
      const h = Math.max(1, parent.clientHeight);
      const s = stateRef.current;

      renderArticulatedHumanFrame({
        ctx,
        img,
        crop,
        w,
        h,
        tSec: (now - start) / 1000,
        playing: s.playing,
        training: s.training,
        level: s.level,
        phase: s.phase,
        stepIndex: s.stepIndex,
        stepCount: s.stepCount,
        breathMode: s.breathMode,
        stepProgress: s.stepProgress,
        side: s.side,
        cameraView: s.cameraView,
        slug: s.slug,
        callout: s.callout,
        motionEnabled: s.motionOn,
      });
    };

    raf = requestAnimationFrame(paint);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [imgLoaded, posterSrc]);

  if (poseImageWithheld(slug)) {
    return <WithheldPoseImage slug={slug} className={cn("rounded-2xl", className)} />;
  }

  const altText = accurateImageAlt(slug, poseImageAlt(slug) || english);
  const badgeText = coachBadge || `${callout.label} · ${callout.detail}`;

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden select-none bg-[#f6e8d0]",
        className,
      )}
      data-testid={testId ?? `human-trainer-movie-${slug}`}
      data-trainer-callout={callout.label}
      data-trainer-breath={breathMode}
      data-trainer-level={level}
      data-trainer-depth={depthInfo.poseDepth.toFixed(2)}
    >
      {/* Underlying accessible reference image for instant paint & screen readers */}
      <img
        src={posterSrc}
        alt={altText}
        width={600}
        height={1200}
        draggable={false}
        className={cn(
          "h-full w-full object-contain object-center transition-opacity duration-300",
          imgLoaded ? "opacity-0" : "opacity-100",
        )}
        style={{ transform: side === 2 ? "scaleX(-1)" : undefined }}
      />

      {/* Articulated phase-synchronized pose guide canvas */}
      <canvas
        ref={canvasRef}
        className={cn(
          "pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-300",
          imgLoaded ? "opacity-100" : "opacity-0",
        )}
        aria-hidden
      />

      {/* Live Breath Pacer Pill during active training */}
      {training && (breathCue || breathMode !== "steady") ? (
        <div
          className="pointer-events-none absolute right-2.5 bottom-11 z-10 hidden items-center gap-1.5 rounded-full border border-border/70 bg-background/90 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur-md sm:inline-flex"
          data-testid="pose-trainer-breath-indicator"
        >
          <Wind
            className={cn(
              "h-3 w-3 text-primary",
              playing && motionOn && "animate-pulse",
            )}
            aria-hidden
          />
          <span className="capitalize">
            {breathMode === "inhale"
              ? "Inhale · Expand ribs"
              : breathMode === "exhale"
                ? "Exhale · Ground & soften"
                : breathCue || "Steady nasal breath"}
          </span>
        </div>
      ) : null}

      {/* Studio Trainer Focus Callout Pill (optional when parent does not render its own badge) */}
      {coachBadge ? (
        <div
          className="pointer-events-none absolute left-2 bottom-10 z-10 inline-flex max-w-[82%] items-center gap-1.5 rounded-full border border-border/70 bg-background/92 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur-md"
          data-testid="pose-trainer-movie-callout"
        >
          <UserCheck className="h-3 w-3 shrink-0 text-primary" aria-hidden />
          <span className="truncate">{badgeText}</span>
        </div>
      ) : null}
    </div>
  );
}
