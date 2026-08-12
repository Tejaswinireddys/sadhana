/**
 * PoseCardVideo — muted looping demo clip for library cards.
 * Loads only when near the viewport; falls back to PoseImage if the clip
 * is missing or fails. Keeps the grid light (no autoplay for off-screen cards).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { PoseImage } from "@/components/PoseImage";
import { manifestToVideoSources, usePoseMedia } from "@/lib/poseMediaApi";
import { cn } from "@/lib/utils";

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
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const { data: manifest } = usePoseMedia(slug);
  const media = useMemo(() => manifestToVideoSources(slug, manifest), [slug, manifest]);
  const hasVideo = Boolean(media);

  useEffect(() => {
    if (!hasVideo) return;
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "120px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasVideo, slug]);

  useEffect(() => {
    setReady(false);
    setFailed(false);
  }, [slug]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !near || !hasVideo || failed) return;
    v.load();
    const play = v.play();
    if (play && typeof play.catch === "function") {
      play.catch(() => {
        /* autoplay can fail; poster/image fallback still shows */
      });
    }
  }, [near, hasVideo, failed, slug, media?.webm, media?.mp4]);

  if (!hasVideo || failed || !media) {
    return (
      <PoseImage
        slug={slug}
        alt={alt}
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
      ref={wrapRef}
      className={cn("relative aspect-square w-full overflow-hidden bg-accent/30", className)}
      style={{ aspectRatio: "1 / 1" }}
      data-testid={testId ?? `pose-card-video-${slug}`}
      data-media={ready ? "video" : "poster"}
    >
      {!ready && (
        <img width={600} height={1200}
          src={media.poster}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-contain"
          loading="lazy"
          decoding="async"
        />
      )}
      {near && (
        <video
          ref={videoRef}
          className={cn(
            "relative z-[1] h-full w-full object-contain",
            ready ? "opacity-100" : "opacity-0",
          )}
          poster={media.poster}
          playsInline
          muted
          loop
          preload="metadata"
          aria-label={`${alt} demonstration`}
          onLoadedData={() => setReady(true)}
          onCanPlay={() => setReady(true)}
          onError={() => setFailed(true)}
          data-testid={`pose-card-video-el-${slug}`}
        >
          <source src={media.webm} type="video/webm" />
          <source src={media.mp4} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
