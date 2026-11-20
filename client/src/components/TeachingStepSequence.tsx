/**
 * Subtle step-by-step sequencing for teaching without a movement demo or AI
 * preview. Uses this pose's own illustration + cues — never generated montage
 * clips, never another pose's body.
 */
import { useEffect, useMemo, useState } from "react";
import { PoseReferenceImage } from "@/components/PoseReferenceImage";
import { StepMotion } from "@/components/StepMotion";
import { asanaBySlug } from "@/data/content";
import {
  accurateImageAlt,
  poseImageCaveat,
  poseImageShortCaveat,
  poseImageWithheld,
} from "@/data/poseImageAccuracy";
import { poseImageAlt } from "@/data/poseImageAlts";
import { STATIC_REFERENCE_LABEL } from "@/data/poseDemoAvailability";
import { WithheldPoseImage } from "@/components/WithheldPoseImage";
import {
  prefersTeachingMotionOff,
  resolveTeachingStepIndex,
  TEACHING_STEP_DWELL_MS,
  teachingStepFrames,
} from "@/lib/teachingStepSequence";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL;
const imgUrl = (slug: string) => `${BASE}poses/${slug}.webp`;

export type TeachingStepSequenceProps = {
  slug: string;
  english: string;
  poseKey: string;
  /** Narration-driven index when the guided player owns the clock. */
  stepIndex?: number;
  playing?: boolean;
  /** When true, parent advances stepIndex — do not auto-dwell. */
  guideActive?: boolean;
  caption?: string | null;
  side?: 1 | 2;
  variant?: "detail" | "practice";
  className?: string;
  "data-testid"?: string;
};

export function TeachingStepSequence({
  slug,
  english,
  poseKey,
  stepIndex = 0,
  playing = false,
  guideActive = false,
  caption = null,
  side = 1,
  variant = "practice",
  className,
  "data-testid": testId,
}: TeachingStepSequenceProps) {
  const asana = asanaBySlug(slug);
  const frames = useMemo(
    () => teachingStepFrames(slug, poseKey, asana?.steps ?? []),
    [slug, poseKey, asana],
  );

  const [reduceMotion, setReduceMotion] = useState(() => prefersTeachingMotionOff());
  const [autoIndex, setAutoIndex] = useState(0);

  useEffect(() => {
    const sync = () => setReduceMotion(prefersTeachingMotionOff());
    sync();
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener?.("change", sync);
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      mq.removeEventListener?.("change", sync);
      obs.disconnect();
    };
  }, []);

  // Self-driven dwell only when the guided clock is not owning stepIndex.
  useEffect(() => {
    if (guideActive || reduceMotion || !playing || frames.length <= 1) {
      if (reduceMotion) setAutoIndex(frames.length - 1);
      return;
    }
    setAutoIndex(0);
    const id = window.setInterval(() => {
      setAutoIndex((i) => (i + 1) % frames.length);
    }, TEACHING_STEP_DWELL_MS);
    return () => window.clearInterval(id);
  }, [guideActive, reduceMotion, playing, frames.length, slug]);

  const drivenIndex = guideActive ? stepIndex : autoIndex;
  const activeIndex = resolveTeachingStepIndex({
    frameCount: frames.length,
    stepIndex: drivenIndex,
    reduceMotion,
  });
  const frame = frames[activeIndex] ?? frames[0]!;
  const note = poseImageShortCaveat(slug) ?? STATIC_REFERENCE_LABEL;
  const noteTitle = poseImageCaveat(slug);

  return (
    <div
      className={cn(
        "relative w-full max-w-full overflow-hidden bg-accent/20",
        variant === "detail" && "pose-stage-frame rounded-2xl",
        variant === "practice" && "flex h-full w-full items-center justify-center",
        className,
      )}
      data-testid={testId ?? `teaching-step-sequence-${slug}`}
      data-teaching-sequence="steps"
      data-step={activeIndex}
      data-step-count={frames.length}
      data-reduce-motion={reduceMotion ? "1" : "0"}
      data-media="illustrated"
    >
      {/* Pad only when a bottom caption bar is up (same as PoseHumanStage).
          Frame cue text alone must not shrink the still — that made withheld
          placeholders ~109px tall at 320x568 and failed the phone floor. */}
      <div className={cn("absolute inset-0", caption ? "px-2 pb-14 pt-9" : "p-2")}>
        {poseImageWithheld(slug) ? (
          <WithheldPoseImage slug={slug} className="rounded-2xl" />
        ) : (
          <PoseReferenceImage
            loading="lazy"
            width={600}
            height={1200}
            src={imgUrl(frame.imageSlug)}
            alt={accurateImageAlt(frame.imageSlug, poseImageAlt(frame.imageSlug) || english)}
            draggable={false}
            className={cn(
              "h-full w-full object-contain object-center",
              !reduceMotion && "transition-opacity duration-500 ease-out",
            )}
            style={{ transform: side === 2 ? "scaleX(-1)" : undefined }}
            data-testid="teaching-step-image"
          />
        )}
      </div>

      {frame.focusZone ? (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden
          data-testid="teaching-step-focus"
        >
          <circle
            className={reduceMotion ? undefined : "focus-halo-breath"}
            cx={frame.focusZone.cx * 100}
            cy={Math.min(80, Math.max(12, frame.focusZone.cy * 100))}
            r={frame.focusZone.r * 55}
            fill="hsl(var(--primary))"
            fillOpacity={0.16}
            style={
              reduceMotion
                ? undefined
                : { transition: "cx 350ms ease, cy 350ms ease, r 350ms ease" }
            }
          />
        </svg>
      ) : null}

      {frame.focusZone?.label ? (
        <span
          className="absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary shadow-soft backdrop-blur-sm"
          data-testid="teaching-step-focus-label"
        >
          {frame.focusZone.label}
        </span>
      ) : null}

      {frame.stepMotion ? (
        <div
          className="pointer-events-none absolute bottom-16 right-2 z-10 text-primary/80"
          data-testid="teaching-step-motion"
          aria-hidden={reduceMotion}
        >
          <StepMotion motion={frame.stepMotion} size={56} decorative />
        </div>
      ) : null}

      <span
        className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground backdrop-blur-sm"
        data-testid="teaching-step-counter"
      >
        Step {activeIndex + 1} of {frames.length}
      </span>

      <span
        className="pointer-events-none absolute inset-x-2 top-10 z-10 line-clamp-2 rounded-md bg-background/85 px-2 py-1 text-center text-[10px] leading-snug text-muted-foreground backdrop-blur-sm"
        data-testid={`pose-human-note-${slug}`}
        data-teaching-note="1"
        {...(noteTitle ? { title: noteTitle } : {})}
      >
        {note}
      </span>

      {(caption || frame.text) ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 via-black/35 to-transparent px-3 pb-3 pt-10"
          data-testid="teaching-step-cue"
        >
          <p className="text-center text-xs font-medium leading-snug text-white sm:text-sm">
            {caption || frame.text}
          </p>
        </div>
      ) : null}
    </div>
  );
}
