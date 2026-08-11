/**
 * KidsPoseVideo — muted looping Ken Burns demo for kids story poses.
 * Falls back to the still illustration when the clip is missing or fails.
 */
import { useEffect, useRef, useState } from "react";
import { kidsPoseHasVideo, kidsPoseMediaFor } from "@/data/kidsMedia";
import { kidsPoseBySlug } from "@/data/kids";
import { cn } from "@/lib/utils";

export function KidsPoseVideo({
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
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const hasVideo = kidsPoseHasVideo(slug);
  const media = kidsPoseMediaFor(slug);
  const stillSrc = `${import.meta.env.BASE_URL}kids/${kidsPoseBySlug(slug)?.image ?? `kids_${slug}`}.png`;

  useEffect(() => {
    setReady(false);
    setFailed(false);
  }, [slug]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !hasVideo || failed || !media) return;
    v.load();
    const play = v.play();
    if (play && typeof play.catch === "function") {
      play.catch(() => undefined);
    }
  }, [hasVideo, failed, slug, media?.webm, media?.mp4]);

  if (!hasVideo || failed) {
    return (
      <img
        src={stillSrc}
        alt={alt}
        className={cn("kids-bob h-64 w-64 object-contain", className)}
        draggable={false}
        data-testid={testId}
      />
    );
  }

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      data-media={ready ? "video" : "poster"}
    >
      {!ready && (
        <img
          src={media.poster}
          alt=""
          aria-hidden
          className="kids-bob absolute h-64 w-64 object-contain opacity-80"
          draggable={false}
        />
      )}
      <video
        ref={videoRef}
        className={cn("h-64 w-64 object-contain", !ready && "invisible absolute")}
        poster={media.poster}
        playsInline
        muted
        loop
        preload="metadata"
        aria-label={alt}
        onLoadedData={() => setReady(true)}
        onCanPlay={() => setReady(true)}
        onError={() => setFailed(true)}
        data-testid={testId}
      >
        <source src={media.webm} type="video/webm" />
        <source src={media.mp4} type="video/mp4" />
      </video>
    </div>
  );
}
