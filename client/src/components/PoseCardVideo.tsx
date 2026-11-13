/**
 * PoseCardVideo — library thumbnails.
 *
 * Demo clips are step journeys that start on a shared standing entry (~0.2s).
 * Autoplaying (or pausing there) makes every card look identical. Always show
 * the pose illustration via PoseImage (never a blank cream box while a poster
 * decodes), and only swap to video on hover.
 *
 * Card frame: fixed 3:4 aspect + object-cover + cream wash so tall 1:2
 * illustrations fill the card without grey side bands. Teaching surfaces keep
 * object-contain via PoseImage's default.
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

/** Shared library-card frame: cream wash + fixed portrait crop. */
export const POSE_CARD_ASPECT = "aspect-[3/4]";
export const POSE_CARD_FRAME_CLASS = "bg-background";

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
        /* gesture-blocked play is fine — illustration stays visible underneath */
      });
    }

    return () => {
      v.pause();
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [showVideo, slug, media]);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        POSE_CARD_ASPECT,
        POSE_CARD_FRAME_CLASS,
        className,
      )}
      style={{ aspectRatio: "3 / 4" }}
      data-testid={testId ?? `pose-card-video-${slug}`}
      data-media={showVideo ? "video" : "illustration"}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/*
        PoseImage is the always-visible base. A separate poster <img> that
        stayed invisible until onLoad painted every card as a blank cream box
        whenever decode lagged or the poster 404'd.
      */}
      <PoseImage
        slug={slug}
        alt={resolvedAlt}
        rounded="rounded-none"
        aspect={POSE_CARD_ASPECT}
        fit="cover"
        shadow={false}
        breath={false}
        // Eager: lazy + content-visibility on the library card left many
        // thumbnails never decoding (blank cream boxes). thumb also prefers
        // pre-scaled assets when they exist; otherwise it still loads full-size.
        thumb
        className={cn("h-full w-full", POSE_CARD_FRAME_CLASS)}
      />
      {showVideo && (
        <video
          ref={videoRef}
          className="absolute inset-0 z-[1] h-full w-full object-cover object-center"
          poster={media?.poster}
          playsInline
          muted
          loop
          preload="none"
          aria-hidden
          onError={() => setFailed(true)}
          data-testid={`pose-card-video-el-${slug}`}
        >
          {!media?.hls && media?.webm ? <source src={media.webm} type="video/webm" /> : null}
          {!media?.hls && media?.mp4 ? <source src={media.mp4} type="video/mp4" /> : null}
        </video>
      )}
    </div>
  );
}
