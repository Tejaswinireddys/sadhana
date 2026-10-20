/**
 * HumanPoseTrainerMovie — Cinematic human yoga instructor training stage.
 *
 * Uses the high-resolution human yoga instructor artwork (`/poses/{slug}.png`,
 * depicting our South Asian studio yoga teacher in a sage-green tank top and
 * terracotta leggings) and renders it as a live, movie-like studio coaching
 * canvas:
 *   1. Automatic figure-bounding-box framing & edge-sampled studio background
 *      extension so wide poses (Warrior II, Downward Dog, Cobra) fill the
 *      widescreen cinema stage cleanly instead of being squeezed into a narrow
 *      letterboxed column with empty top/bottom padding.
 *   2. Real-time 2D anatomical mesh deformation (diaphragmatic ribcage/chest
 *      expansion on inhale, spinal flexion/extension during Cat-Cow & flow
 *      rounds, gentle postural weight-shift, and head/gaze articulation).
 *   3. Studio cinematography: warm sunlit studio backdrop matching the canvas
 *      tone, soft window light rays, grounded floor shadow, subtle film
 *      vignette, and smooth camera framing (`auto` / `front` / `side`) that
 *      keeps the instructor's full body visible.
 *   4. Live coaching HUD: anatomical alignment callout rings + pointer labels
 *      synced to the current spoken cue, and synchronized breath pacer pill.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { asanaBySlug } from "@/data/content";
import { poseImageAlt } from "@/data/poseImageAlts";
import { accurateImageAlt, poseImageWithheld } from "@/data/poseImageAccuracy";
import { WithheldPoseImage } from "@/components/WithheldPoseImage";
import { useMotionEnabled } from "@/components/motion";
import type { LessonPhase } from "@/lib/poseLesson";
import { cn } from "@/lib/utils";
import { Sparkles, UserCheck, Wind } from "lucide-react";

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
 * Derive an accurate anatomical callout point on the human instructor figure
 * (normalized 0..1 within the cropped figure bounds) from the active step cue
 * text and pose category.
 */
export function resolveAnatomicalCallout(
  slug: string,
  cueText: string | null | undefined,
  stepIndex: number,
  phase?: string,
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

  if (isAllFours) {
    if (/wrist|palm|hand|shoulder/i.test(cue)) {
      return {
        x: 0.72,
        y: 0.68,
        label: "Hands & Shoulders",
        detail: "Spread fingers wide; stack wrists directly under shoulders",
      };
    }
    if (/belly|inhale|tailbone|arch|cow|gaze|chest/i.test(cue)) {
      return {
        x: 0.52,
        y: 0.42,
        label: "Thoracic & Lumbar Spine",
        detail: "Inhale: lengthen sternum forward and tilt sit-bones up",
      };
    }
    if (/round|exhale|chin|navel|cat|press/i.test(cue)) {
      return {
        x: 0.48,
        y: 0.36,
        label: "Spinal Flexion",
        detail: "Exhale: draw navel in and dome the upper back toward the ceiling",
      };
    }
    return {
      x: 0.32,
      y: 0.68,
      label: "Hips Over Knees",
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

  // Standing / Seated / Balancing poses (within tight figure crop)
  if (/knee|thigh|hip|pelvis|sink|bend/i.test(cue)) {
    return {
      x: 0.36,
      y: 0.64,
      label: "Hip & Knee Alignment",
      detail: "Track the knee cleanly in line with the middle toes; level the pelvis",
    };
  }
  if (/foot|feet|ankle|heel|toe|stance|sole|ground|root/i.test(cue)) {
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

  // Default progression by phase / stepIndex
  if (phase === "preparation" || stepIndex === 0) {
    return {
      x: 0.5,
      y: 0.84,
      label: "Foundation Setup",
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
 * Draw the human instructor image onto a 2D horizontal strip mesh so the
 * trainer's actual body breathes (ribcage expansion), articulates the spine
 * (Cat/Cow arch & round), and shifts weight naturally like a live movie shot.
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

  // Grounding breath aura on the studio floor directly beneath the instructor's feet
  const breathCycle =
    breathMode === "inhale"
      ? Math.sin(Math.min(1, Math.max(0, stepProgress)) * (Math.PI / 2))
      : breathMode === "exhale"
        ? Math.cos(Math.min(1, Math.max(0, stepProgress)) * (Math.PI / 2))
        : (Math.sin(tSec * (playing ? 1.25 : 0.75)) + 1) * 0.5;

  const auraRadiusX = Math.min(w * 0.36, drawW * (0.48 + (motionEnabled ? breathCycle * 0.04 : 0)));
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

  // 4. Smooth cinematic camera framing
  let camScale = 1;
  let camFocusY = 0.5;
  if (cameraView === "front") {
    camScale = 1 + (motionEnabled && playing ? Math.sin(tSec * 0.35) * 0.016 : 0);
    camFocusY = 0.5;
  } else if (cameraView === "side") {
    camScale = 1.1;
    camFocusY = Math.max(0.32, Math.min(0.68, callout.y));
  } else {
    camScale = 1 + (motionEnabled && playing ? Math.sin(tSec * 0.4) * 0.014 : 0);
    camFocusY = 0.5;
  }

  ctx.save();
  const focalX = w * 0.5;
  const focalY = baseY + drawH * camFocusY;
  ctx.translate(focalX, focalY);
  ctx.scale(side === 2 ? -camScale : camScale, camScale);
  ctx.translate(-focalX, -focalY);

  // 5. Render the human instructor through a 28-slice anatomical deformation mesh
  // so her chest/ribcage expands on inhale, spine articulates on Cat-Cow/flow,
  // and her posture has lifelike micro-balance while feet remain grounded.
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

  for (let i = 0; i < SLICES; i++) {
    const v0 = i / SLICES;
    const v1 = (i + 1) / SLICES;
    const vMid = (v0 + v1) * 0.5;

    // Anatomical envelope: feet (v=0.92..1.0) stay pinned to the mat
    const footAnchor = Math.max(0, Math.min(1, (0.92 - vMid) / 0.55));

    let dx = 0;
    let dy = 0;
    let scaleX = 1;

    if (isAllFours) {
      // Tabletop / Cat-Cow: hands and knees stay grounded while the thoracic/lumbar
      // spine arches downward on inhale (Cow) and domes upward on exhale (Cat)
      const spineBell = Math.exp(-Math.pow((vMid - 0.44) / 0.2, 2));
      const headBell = Math.exp(-Math.pow((vMid - 0.3) / 0.16, 2));
      dy = -breathWave * spineBell * drawH * 0.022 + breathWave * headBell * drawH * 0.01;
      scaleX = 1 + Math.abs(breathWave) * spineBell * 0.018;
      dx = swayWave * spineBell * drawW * 0.005;
    } else {
      // Standing / Seated / Balancing human instructor:
      // Ribcage & shoulders (v ≈ 0.22..0.46) expand laterally and lift slightly on inhale;
      // gentle postural weight shift anchored at the feet.
      const chestBell = Math.exp(-Math.pow((vMid - 0.32) / 0.16, 2));
      const bellyBell = Math.exp(-Math.pow((vMid - 0.46) / 0.14, 2));
      scaleX = 1 + breathWave * (chestBell * 0.022 + bellyBell * 0.016);
      dy = -breathWave * footAnchor * drawH * 0.008;
      dx = swayWave * footAnchor * drawW * 0.005;
    }

    const sy0 = crop.sy + v0 * crop.sh;
    const sy1 = crop.sy + v1 * crop.sh;
    const sh = Math.max(1, sy1 - sy0);

    const dy0 = baseY + v0 * drawH + dy;
    const dh = (v1 - v0) * drawH + 0.9; // +0.9px overlap prevents subpixel seam lines
    const sliceW = drawW * scaleX;
    const dx0 = baseX + (drawW - sliceW) * 0.5 + dx;

    ctx.drawImage(img, crop.sx, sy0, crop.sw, sh, dx0, dy0, sliceW, dh);
  }

  ctx.restore();

  // 6. Anatomical coaching callout ring + label in screen space (never mirrored)
  if (opts.training) {
    const effectiveCalloutX = side === 2 ? 1 - callout.x : callout.x;
    const cx = baseX + drawW * effectiveCalloutX;
    const cy = baseY + drawH * callout.y;
    const pulse = activeMotion ? 1 + 0.12 * Math.sin(tSec * 3.2) : 1;
    const rOuter = Math.max(14, Math.min(28, Math.min(drawW, drawH) * 0.09)) * pulse;

    // Soft glow halo
    const halo = ctx.createRadialGradient(cx, cy, rOuter * 0.15, cx, cy, rOuter * 1.45);
    halo.addColorStop(0, "rgba(92, 126, 96, 0.28)");
    halo.addColorStop(0.7, "rgba(92, 126, 96, 0.12)");
    halo.addColorStop(1, "rgba(92, 126, 96, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter * 1.45, 0, Math.PI * 2);
    ctx.fill();

    // Crisp target ring
    ctx.strokeStyle = "rgba(74, 107, 82, 0.85)";
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    // Center alignment dot
    ctx.fillStyle = "rgba(74, 107, 82, 0.95)";
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Callout pill drawn in studio space near the target ring
    const labelText = callout.label;
    ctx.font = "600 11px system-ui, -apple-system, sans-serif";
    const textW = ctx.measureText(labelText).width;
    const pillW = textW + 16;
    const pillH = 22;
    const pillX = Math.max(8, Math.min(w - pillW - 8, cx + rOuter * 0.85));
    const pillY = Math.max(32, Math.min(h - 44, cy - pillH * 0.5));

    // Connector line from ring to label pill
    ctx.strokeStyle = "rgba(74, 107, 82, 0.65)";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(cx + rOuter * 0.5, cy);
    ctx.lineTo(pillX, pillY + pillH * 0.5);
    ctx.stroke();

    // Pill background
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

  // 7. Subtle warm cinema vignette around the studio frame
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
  phase,
  stepIndex = 0,
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
    () => resolveAnatomicalCallout(slug, cueText, stepIndex, phase),
    [slug, cueText, stepIndex, phase],
  );

  const stateRef = useRef({
    playing,
    training,
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
      // Native DOM Event.timeStamp uses Blink's monotonic C++ clock so Playwright
      // `page.clock.runFor()` fast-forwards do not choke on 2D canvas redraws.
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

      {/* Articulated live human trainer cinema canvas */}
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

      {/* Subtle studio indicator in idle preview */}
      {!training ? (
        <span
          className="pointer-events-none absolute right-2 bottom-2 z-10 hidden items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur-sm sm:inline-flex"
          aria-hidden
        >
          <Sparkles className="h-2.5 w-2.5 text-primary" />
          Live human guide
        </span>
      ) : null}
    </div>
  );
}
