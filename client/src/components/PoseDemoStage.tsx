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
import { PoseStageGL } from "@/components/PoseStageGL";
import { hasRigSequence } from "@/data/poseKeyframes";
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
  /** Live step caption overlaid on the demo (training clarity). */
  caption?: string | null;
  /** Narration step index — advances the 3D camera / focus moment. */
  stepIndex?: number;
  /**
   * 0–1 progress through the current narration step. Drives limb interpolation
   * on rigged poses; ignored by the CSS stage. Defaults to 1 (settled).
   */
  stepProgress?: number;
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
  /**
   * Fired when a preferred video cannot be shown (save-data, load error, or
   * timeout). Parents can swap to PoseHumanStage without breaking the lesson.
   */
  onVideoUnavailable?: () => void;
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
  caption = null,
  stepIndex = 0,
  stepProgress = 1,
  stepCount = 1,
  stepPoseKey,
  stepMotion = null,
  side = 1,
  className,
  variant = "detail",
  onMediaModeChange,
  onVideoUnavailable,
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

  // Let parents fall back to the illustrated trainer when video is blocked.
  useEffect(() => {
    if (use3D || !preferVideo) return;
    if (saveData || videoFailed) onVideoUnavailable?.();
  }, [use3D, preferVideo, saveData, videoFailed, onVideoUnavailable]);

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

  // Detail heroes load immediately so the correct pose video is ready when the
  // user opens a pose. Practice / list contexts still lazy-load on view.
  useEffect(() => {
    if (use3D) return;
    if (variant === "detail") {
      setShowSources(true);
      return;
    }
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
  }, [slug, use3D, variant]);

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

  if (use3D && hasRigSequence(slug)) {
    return (
      <PoseStageGL
        slug={slug}
        english={english}
        poseKey={poseKey}
        stepPoseKey={stepPoseKey}
        focusZone={focusZone}
        stepMotion={stepMotion}
        stepIndex={stepIndex}
        stepProgress={stepProgress}
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
        "relative w-full max-w-full overflow-hidden",
        variant === "detail" && "pose-stage-frame rounded-2xl bg-accent/30",
        variant === "practice" && "flex h-full w-full items-center justify-center",
        className,
      )}
      data-testid={testId ?? `pose-demo-stage-${slug}`}
      data-media={useVideo && videoReady ? "video" : "illustration"}
    >
      <div className={cn("absolute inset-0", caption ? "px-2 pb-14 pt-9" : "p-2")}>
        {useVideo && showSources && (
          <video
            ref={videoRef}
            className={cn(
              "h-full w-full object-contain object-center",
              (!videoReady || videoFailed) && "invisible absolute inset-0",
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
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-accent/10"
            aria-hidden
          >
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        )}

        {showIllustration &&
          (imgErrored ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
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
                "h-full w-full select-none object-contain object-center",
                variant === "detail" && "rounded-2xl shadow-soft-lg",
                // Still poster only — avoid extra bob when video isn't ready.
                !useVideo &&
                  (playing && !reduceMotion
                    ? "photo-breath-demo photo-brightness-pulse"
                    : "photo-breath"),
              )}
              data-testid={`pose-demo-poster-${slug}`}
            />
          ))}
      </div>

      {/* Focus + caption work on video and illustration */}
      {focusZone && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
          aria-hidden
          data-testid={`pose-demo-focus-${slug}`}
        >
          <circle
            className="focus-halo-breath"
            cx={focusZone.cx * 100}
            cy={Math.min(80, Math.max(12, focusZone.cy * 100))}
            r={focusZone.r * 55}
            fill="hsl(var(--primary))"
            fillOpacity={0.16}
            style={{ transition: "cx 350ms ease, cy 350ms ease, r 350ms ease" }}
          />
          <circle
            cx={focusZone.cx * 100}
            cy={Math.min(80, Math.max(12, focusZone.cy * 100))}
            r={focusZone.r * 55}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={1.2}
            strokeOpacity={0.9}
            style={{ transition: "cx 350ms ease, cy 350ms ease, r 350ms ease" }}
          />
        </svg>
      )}

      {focusZone?.label && (
        <span
          className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary shadow-soft backdrop-blur-sm"
          data-testid={`pose-demo-focus-label-${slug}`}
        >
          {focusZone.label}
        </span>
      )}

      {caption ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 via-black/35 to-transparent px-3 pb-3 pt-10"
          data-testid={`pose-demo-caption-${slug}`}
        >
          <p className="text-center text-xs font-medium leading-snug text-white sm:text-sm">
            {caption}
          </p>
        </div>
      ) : null}

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
