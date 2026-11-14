import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { attachHls } from "@/lib/hlsAttach";
import { resolveVideoSource, type VideoSourceInput } from "@/lib/videoSource";
import { claimPageMedia, onPageMediaClaim } from "@/lib/pageMedia";
import { cn } from "@/lib/utils";

export type VideoCaption = { src: string; srcLang: string; label: string; default?: boolean };
export type VideoPlayerProps = VideoSourceInput & {
  title: string;
  poster?: string;
  captions?: VideoCaption[];
  fallback: ReactNode;
  /** Wrapper around the video (and loading fallback). */
  className?: string;
  /**
   * Classes on the <video> element. Defaults to landscape 16:9. Callers that
   * ship portrait lessons pass a 9:16 box with object-contain — never cover —
   * so the body is not cropped on phones.
   */
  videoClassName?: string;
};

const DEFAULT_VIDEO_CLASS = "aspect-video w-full rounded-xl bg-card object-contain";

/** User-controlled playback; missing, unsupported and failed streams retain the existing image. */
export function VideoPlayer(props: VideoPlayerProps) {
  const source = resolveVideoSource(props);
  if (!source) return <>{props.fallback}</>;
  return <PlayableVideo key={props.playbackPolicy === "signed" ? props.playbackId || props.title : source.url} {...props} source={source} />;
}

function PlayableVideo({
  source,
  title,
  poster,
  captions = [],
  fallback,
  className,
  videoClassName = DEFAULT_VIDEO_CLASS,
}: VideoPlayerProps & {
  source: NonNullable<ReturnType<typeof resolveVideoSource>>;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const loaded = useRef(false);
  const resume = useRef<{ time: number; playing: boolean } | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const reactId = useId();
  const mediaOwner = `video-player:${reactId}`;
  useEffect(() => {
    const video = ref.current;
    if (!video || failed) return;
    const fail = () => setFailed(true);
    const timeout = window.setTimeout(() => { if (!loaded.current) fail(); }, 15000);
    const handle = source.hls ? attachHls(video, source.url, { onError: fail }) : null;
    if (!source.hls) { video.src = source.url; video.load(); }
    return () => {
      window.clearTimeout(timeout);
      // Refreshing a signed URL must not restart a class or resume a paused video.
      resume.current = { time: video.currentTime, playing: !video.paused };
      video.pause();
      handle?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [source.url, source.hls, failed]);
  // Another surface claimed the page — pause so AI trainer / lesson / Mux do not stack.
  useEffect(() => onPageMediaClaim((claim) => {
    if (claim.id === mediaOwner) return;
    ref.current?.pause();
  }), [mediaOwner]);
  if (failed) return <>{fallback}</>;
  return (
    <div className={cn("relative", className)} data-testid="video-player" data-media-kind={ready ? "video" : "image"}>
      {!ready && <div data-testid="video-poster-fallback">{fallback}</div>}
      <video
        ref={ref}
        controls
        playsInline
        crossOrigin="anonymous"
        preload="metadata"
        poster={poster}
        aria-label={title}
        data-testid="video-player-element"
        data-media-owner={mediaOwner}
        className={cn(videoClassName, !ready && "pointer-events-none absolute inset-0 opacity-0")}
        onPlay={() => claimPageMedia(mediaOwner)}
        onLoadedMetadata={() => {
          const video = ref.current;
          if (video && resume.current) {
            video.currentTime = resume.current.time;
            if (resume.current.playing) void video.play().catch(() => {});
            resume.current = null;
          }
          loaded.current = true;
          setReady(true);
        }}
        onError={() => setFailed(true)}
      >
        {captions.map((track) => <track key={`${track.srcLang}:${track.src}`} kind="captions" {...track} />)}
      </video>
    </div>
  );
}
