/**
 * PoseCardVideo — library thumbnails.
 *
 * Demo clips are step journeys that start on a shared standing entry (~0.2s).
 * Autoplaying (or pausing there) makes every card look identical. Show the
 * pose PNG — the same poster Pathways uses — and only swap to video on hover.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { PoseImage } from "@/components/PoseImage";
import { attachHls, type HlsAttachHandle } from "@/lib/hlsAttach";
import { manifestToVideoSources, usePoseMedia } from "@/lib/poseMediaApi";
import { asanaBySlug } from "@/data/content";
import { cn } from "@/lib/utils";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function PoseCardVideo({
  slug,
  alt,
  className,
  testId,
}: {
  slug: string;
  alt: string;
  className?: string;
  testId?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<HlsAttachHandle | null>(null);
  const [hover, setHover] = useState(false);
  const [failed, setFailed] = useState(false);
  const reduceMotion = useMemo(() => prefersReducedMotion(), []);
  const { data: manifest } = usePoseMedia(slug);
  const media = useMemo(() => manifestToVideoSources(slug, manifest), [slug, manifest]);
  const hasVideo = Boolean(media);
  const showVideo = !!media && hover && !failed && !reduceMotion;
  const resolvedAlt = asanaBySlug(slug)?.imageAlt || alt;

  useEffect(() => {
    setFailed(false);
  }, [slug]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !showVideo || !media) return;

    hlsRef.current?.destroy();
    hlsRef.current = null;

    if (media.hls) {
      hlsRef.current = attachHls(v, media.hls, {
        onError: () => setFailed(true),
      });
    } else {
      v.load();
    }

    v.muted = true;
    const play = v.play();
    if (play && typeof play.catch === "function") {
      play.catch(() => {
        /* gesture-blocked play is fine — poster stays visible underneath */
      });
    }

    return () => {
      v.pause();
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [showVideo, slug, media]);

  if (!hasVideo || failed || !media) {
    return (
      <PoseImage
        slug={slug}
        alt={resolvedAlt}
        rounded="rounded-none"
        aspect="aspect-square"
        shadow={false}
        breath={false}
        testId={testId}
        className={className}
      />
    );
  }

  return (
    <div
      className={cn("relative aspect-square w-full overflow-hidden bg-accent/30", className)}
      style={{ aspectRatio: "1 / 1" }}
      data-testid={testId ?? `pose-card-video-${slug}`}
      data-media={showVideo ? "video" : "poster"}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <img
        width={600}
        height={1200}
        src={media.poster}
        alt={resolvedAlt}
        className="relative z-0 h-full w-full object-contain"
        loading="lazy"
        decoding="async"
      />
      {showVideo && (
        <video
          ref={videoRef}
          className="absolute inset-0 z-[1] h-full w-full object-contain"
          poster={media.poster}
          playsInline
          muted
          loop
          preload="none"
          aria-hidden
          onError={() => setFailed(true)}
          data-testid={`pose-card-video-el-${slug}`}
        >
          {!media.hls && media.webm ? <source src={media.webm} type="video/webm" /> : null}
          {!media.hls && media.mp4 ? <source src={media.mp4} type="video/mp4" /> : null}
        </video>
      )}
    </div>
  );
}
