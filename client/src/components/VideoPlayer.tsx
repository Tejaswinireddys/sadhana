import { useEffect, useRef, useState, type ReactNode } from "react";
import { attachHls } from "@/lib/hlsAttach";
import { resolveVideoSource, type VideoSourceInput } from "@/lib/videoSource";
import { cn } from "@/lib/utils";

export type VideoCaption = { src: string; srcLang: string; label: string; default?: boolean };
export type VideoPlayerProps = VideoSourceInput & {
  title: string;
  poster?: string;
  captions?: VideoCaption[];
  fallback: ReactNode;
  className?: string;
};

/** User-controlled playback; missing, unsupported and failed streams retain the existing image. */
export function VideoPlayer(props: VideoPlayerProps) {
  const source = resolveVideoSource(props);
  if (!source) return <>{props.fallback}</>;
  return <PlayableVideo key={source.url} {...props} source={source} />;
}

function PlayableVideo({ source, title, poster, captions = [], fallback, className }: VideoPlayerProps & {
  source: NonNullable<ReturnType<typeof resolveVideoSource>>;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const loaded = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video || failed) return;
    const fail = () => setFailed(true);
    const timeout = window.setTimeout(() => { if (!loaded.current) fail(); }, 15000);
    const handle = source.hls ? attachHls(video, source.url, { onError: fail }) : null;
    if (!source.hls) { video.src = source.url; video.load(); }
    return () => {
      window.clearTimeout(timeout);
      video.pause();
      handle?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [source.url, source.hls, failed]);
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
        className={cn("aspect-video w-full rounded-xl bg-card object-contain", !ready && "pointer-events-none absolute inset-0 opacity-0")}
        onLoadedMetadata={() => { loaded.current = true; setReady(true); }}
        onError={() => setFailed(true)}
      >
        {captions.map((track) => <track key={`${track.srcLang}:${track.src}`} kind="captions" {...track} />)}
      </video>
    </div>
  );
}
