/**
 * PoseDemoStage — the visual heart of pose explanation / guided practice.
 *
 * Primary: narration-synced 3D figurine (CSS perspective + PoseSvg mannequin)
 * driven by step pose key, focus zone, and stepMotion — the “correct moment”.
 *
 * Optional: looping Ken Burns video remains available when prefer3D is false
 * (or save-data / reduced paths). Poster PNG is a soft recognition layer under 3D.
 *
 * Never invents external CDN URLs — callers pass sources from poseMediaFor().
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { PoseSvg } from "@/components/PoseSvg";
import { PoseFigurine3D } from "@/components/PoseFigurine3D";
import type { StepMotionKey } from "@/components/StepMotion";
import type { PoseMediaSources } from "@/data/poseMedia";
import type { FocusZone } from "@/lib/poseMoments";
import { AlertCircle, Loader2 } from "lucide-react";

export type { FocusZone };

type PoseDemoStageProps = {
  slug: string;
  english: string;
  sanskrit: string;
  poseKey: string;
  media: PoseMediaSources;
  /**
   * Prefer the 3D figurine stage (default). Set false only when you explicitly
   * want the looping illustration video instead.
   */
  prefer3D?: boolean;
  /** When true and prefer3D is false, attempt video; otherwise force illustration. */
  preferVideo?: boolean;
  /**
   * Drives muted video play/pause and 3D “live” breath. Pass true for idle
   * detail preview, and mirror narration play/pause once explanation starts.
   */
  playing?: boolean;
  /**
   * Bump when narration starts (or pose instruction begins) so a video clip
   * seeks to 0; 3D resets via slug/step props.
   */
  restartToken?: number;
  focusZone?: FocusZone | null;
  /** Narration step index — advances the 3D camera / focus moment. */
  stepIndex?: number;
  stepCount?: number;
  /** Per-step PoseSvg key when the shape changes mid-cue. */
  stepPoseKey?: string;
  stepMotion?: StepMotionKey | null;
  /** Laterality for “each side” poses — mirrors the figurine on side 2. */
  side?: 1 | 2;
  className?: string;
  /** Aspect / sizing: "detail" (rounded card) or "practice" (full contain). */
  variant?: "detail" | "practice";
  onMediaModeChange?: (mode: "3d" | "video" | "illustration") => void;
  "data-testid"?: string;
};

function prefersReducedData(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !!conn?.saveData;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function PoseDemoStage({
  slug,
  english,
  sanskrit,
  poseKey,
  media,
  prefer3D = true,
  preferVideo = true,
  playing = false,
  restartToken = 0,
  focusZone = null,
  stepIndex = 0,
  stepCount = 1,
  stepPoseKey,
  stepMotion = null,
  side = 1,
  className,
  variant = "detail",
  onMediaModeChange,
  "data-testid": testId,
}: PoseDemoStageProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0, offsetX: 0, offsetY: 0, wrapW: 0, wrapH: 0 });
  const [imgErrored, setImgErrored] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const saveData = useMemo(() => prefersReducedData(), []);
  const reduceMotion = useMemo(() => prefersReducedMotion(), []);
  const use3D = prefer3D;
  const useVideo = !use3D && preferVideo && !saveData && !videoFailed;

  useEffect(() => {
    setImgErrored(false);
    setVideoFailed(false);
    setVideoReady(false);
    setShowSources(false);
  }, [slug]);

  useEffect(() => {
    if (use3D) {
      onMediaModeChange?.("3d");
      return;
    }
    onMediaModeChange?.(useVideo && videoReady ? "video" : "illustration");
  }, [use3D, useVideo, videoReady, onMediaModeChange]);

  // Lazy-attach sources once the stage is in view (saves bandwidth on library).
  useEffect(() => {
    if (use3D) return;
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShowSources(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShowSources(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [slug, use3D]);

  // Explicit load() after <source> children mount — required by HTMLMediaElement.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !useVideo || !showSources) return;
    setVideoReady(false);
    v.load();
  }, [useVideo, showSources, slug, media.mp4, media.webm]);

  // Measure for focus halo (object-contain letterboxing aware for practice).
  useEffect(() => {
    if (use3D) return;
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const wrapW = el.clientWidth;
      const wrapH = el.clientHeight;
      if (variant === "practice") {
        const aspect = 887 / 1774;
        let w = wrapW;
        let h = w / aspect;
        if (h > wrapH) {
          h = wrapH;
          w = h * aspect;
        }
        setBox({
          w,
          h,
          offsetX: (wrapW - w) / 2,
          offsetY: (wrapH - h) / 2,
          wrapW,
          wrapH,
        });
      } else {
        setBox({ w: wrapW, h: wrapH, offsetX: 0, offsetY: 0, wrapW, wrapH });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [variant, slug, use3D]);

  // Restart clip with narration (seek + play) when parent bumps restartToken.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !useVideo || !videoReady || restartToken <= 0) return;
    try {
      v.currentTime = 0;
    } catch {
      /* ignore seek errors on unloaded media */
    }
  }, [restartToken, useVideo, videoReady, slug]);

  // Sync muted play/pause with parent.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !useVideo || !videoReady) return;
    v.muted = true;
    if (!reduceMotion && playing) {
      const p = v.play();
      if (p) p.catch(() => undefined);
    } else {
      v.pause();
    }
  }, [playing, useVideo, reduceMotion, slug, videoReady, restartToken]);

  useEffect(() => {
    if (!useVideo || !showSources || videoReady || videoFailed) return;
    const t = window.setTimeout(() => setVideoFailed(true), 15000);
    return () => window.clearTimeout(t);
  }, [useVideo, showSources, videoReady, videoFailed]);

  const alt = `${english} (${sanskrit}) pose demonstration`;
  const showIllustration = !use3D && (!useVideo || !videoReady || videoFailed);

  if (use3D) {
    return (
      <PoseFigurine3D
        slug={slug}
        english={english}
        poseKey={poseKey}
        stepPoseKey={stepPoseKey}
        focusZone={focusZone}
        stepMotion={stepMotion}
        stepIndex={stepIndex}
        stepCount={stepCount}
        side={side}
        playing={playing}
        variant={variant}
        posterSrc={media.poster}
        className={className}
        data-testid={testId ?? `pose-demo-stage-${slug}`}
      />
    );
  }

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative w-full overflow-hidden",
        variant === "detail" && "rounded-2xl bg-accent/30",
        variant === "practice" && "flex h-full w-full items-center justify-center",
        className,
      )}
      data-testid={testId ?? `pose-demo-stage-${slug}`}
      data-media={useVideo && videoReady ? "video" : "illustration"}
    >
      {useVideo && showSources && (
        <video
          ref={videoRef}
          className={cn(
            variant === "detail"
              ? "block aspect-[4/5] w-full object-cover"
              : "absolute inset-0 h-full w-full object-contain",
            (!videoReady || videoFailed) && "invisible absolute",
          )}
          poster={media.poster}
          playsInline
          muted
          loop
          preload={saveData ? "none" : "auto"}
          aria-label={alt}
          onLoadedData={() => setVideoReady(true)}
          onCanPlay={() => setVideoReady(true)}
          onError={() => setVideoFailed(true)}
          data-testid={`pose-demo-video-${slug}`}
        >
          <source src={media.mp4} type="video/mp4" />
          <source src={media.webm} type="video/webm" />
          {media.captions ? (
            <track kind="captions" src={media.captions} srcLang="en" label="English" />
          ) : null}
        </video>
      )}

      {useVideo && showSources && !videoReady && !videoFailed && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-accent/10",
            variant === "detail" && "aspect-[4/5]",
          )}
          aria-hidden
        >
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      )}

      {showIllustration &&
        (imgErrored ? (
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-2 text-muted-foreground",
              variant === "detail" ? "aspect-[4/5] w-full" : "h-full w-full",
            )}
          >
            <PoseSvg pose={poseKey} size={variant === "practice" ? 200 : 180} />
            <span className="text-xs">Pose guide unavailable</span>
          </div>
        ) : (
          <img
            src={media.poster}
            alt={alt}
            draggable={false}
            onError={() => setImgErrored(true)}
            className={cn(
              "block select-none",
              variant === "detail" &&
                "w-full rounded-2xl object-cover shadow-soft-lg",
              variant === "practice" && "h-full w-full object-contain",
              playing && !reduceMotion ? "photo-breath-demo photo-brightness-pulse" : "photo-breath",
            )}
            data-testid={`pose-demo-poster-${slug}`}
          />
        ))}

      {showIllustration && focusZone && box.w > 0 && box.h > 0 && (
        (() => {
          const clampedCy = Math.min(0.8, Math.max(0.2, focusZone.cy));
          const cx = box.offsetX + focusZone.cx * box.w;
          const cy = box.offsetY + clampedCy * box.h;
          const r = focusZone.r * (variant === "detail" ? 0.7 : 1) * Math.min(box.w, box.h);
          const tween = "cx 300ms ease, cy 300ms ease, r 300ms ease";
          return (
            <svg
              viewBox={`0 0 ${box.wrapW || 1} ${box.wrapH || 1}`}
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
              aria-hidden
              data-testid={`pose-demo-focus-${slug}`}
            >
              <circle
                className="focus-halo-breath"
                cx={cx}
                cy={cy}
                r={r}
                fill="hsl(var(--primary))"
                fillOpacity={0.18}
                style={{ transition: tween }}
              />
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={Math.max(2, box.w * 0.006)}
                strokeOpacity={0.85}
                style={{ transition: tween }}
              />
              <circle
                className="focus-dot-pulse"
                cx={cx}
                cy={cy}
                r={Math.max(3, box.w * 0.012)}
                fill="hsl(var(--primary))"
                style={{ transition: tween }}
              />
            </svg>
          );
        })()
      )}

      {showIllustration && focusZone?.label && (
        <span
          className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-background/85 px-3 py-1 text-xs font-medium text-primary shadow-soft backdrop-blur-sm"
          data-testid={`pose-demo-focus-label-${slug}`}
        >
          {focusZone.label}
        </span>
      )}

      {preferVideo && videoFailed && variant === "detail" && (
        <span
          className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-1 text-[10px] font-medium text-muted-foreground backdrop-blur-sm"
          title="Add clips under public/videos/poses — see docs/pose-videos.md"
        >
          <AlertCircle className="h-3 w-3" aria-hidden />
          Illustrated guide
        </span>
      )}
    </div>
  );
}
