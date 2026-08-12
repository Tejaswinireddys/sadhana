/**
 * Muted looping pose clip with HLS (hls.js) + progressive fallback.
 * Poster stays visible until the stream is ready; errors never block the UI.
 */
import { useEffect, useRef, useState } from "react";
import { attachHls, type HlsAttachHandle } from "@/lib/hlsAttach";
import type { PoseMediaSources } from "@/data/poseMedia";
import { cn } from "@/lib/utils";

export function StreamVideo({
  media,
  className,
  "aria-label": ariaLabel,
  autoPlay = true,
  loop = true,
  testId,
  onFailed,
}: {
  media: PoseMediaSources;
  className?: string;
  "aria-label"?: string;
  autoPlay?: boolean;
  loop?: boolean;
  testId?: string;
  onFailed?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<HlsAttachHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setReady(false);
    setFailed(false);
  }, [media.hls, media.mp4, media.webm]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || failed) return;
    hlsRef.current?.destroy();
    hlsRef.current = null;

    const fail = () => {
      setFailed(true);
      onFailed?.();
    };

    if (media.hls) {
      hlsRef.current = attachHls(v, media.hls, { onError: fail });
    } else {
      v.load();
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [media.hls, media.mp4, media.webm, failed, onFailed]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !ready || !autoPlay || failed) return;
    v.muted = true;
    const p = v.play();
    if (p) p.catch(() => undefined);
  }, [ready, autoPlay, failed]);

  if (failed) return null;

  return (
    <div className={cn("relative overflow-hidden bg-accent/20", className)} data-testid={testId}>
      <img
        src={media.poster}
        alt=""
        aria-hidden
        width={600}
        height={1200}
        className={cn(
          "absolute inset-0 h-full w-full object-cover",
          ready && "opacity-0",
        )}
      />
      <video
        ref={videoRef}
        className={cn("relative z-[1] h-full w-full object-cover", !ready && "opacity-0")}
        poster={media.poster}
        playsInline
        muted
        loop={loop}
        preload="metadata"
        aria-label={ariaLabel}
        onLoadedData={() => setReady(true)}
        onCanPlay={() => setReady(true)}
        onError={() => {
          setFailed(true);
          onFailed?.();
        }}
      >
        {!media.hls && media.webm ? <source src={media.webm} type="video/webm" /> : null}
        {!media.hls && media.mp4 ? <source src={media.mp4} type="video/mp4" /> : null}
      </video>
    </div>
  );
}
