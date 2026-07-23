import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, Loader2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

type ProductDemoVideoProps = {
  /** Base name without extension, under /videos and /images /captions */
  name?: string;
  title?: string;
  className?: string;
  /** Prefer muted autoplay when allowed and not reduced-data / reduced-motion */
  autoPlayMuted?: boolean;
  posterSrc?: string;
  webmSrc?: string;
  mp4Src?: string;
  captionsSrc?: string;
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

/**
 * Reusable product walkthrough player.
 * Supports MP4 (+ optional WebM), poster, captions, lazy load, and reduced-data mode.
 * Never autoplays with sound.
 */
export function ProductDemoVideo({
  name = "product-overview",
  title = "Product overview",
  className,
  autoPlayMuted = true,
  posterSrc,
  webmSrc,
  mp4Src,
  captionsSrc,
}: ProductDemoVideoProps) {
  const base = import.meta.env.BASE_URL;
  // PNG is the shipped poster (WebP optional). Prefer real PNG over a missing .webp.
  const poster = posterSrc ?? `${base}images/${name}-poster.png`;
  const webm = webmSrc ?? `${base}videos/${name}.webm`;
  const mp4 = mp4Src ?? `${base}videos/${name}.mp4`;
  const captions = captionsSrc ?? `${base}captions/${name}.vtt`;

  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const reduceMotion = useMemo(() => prefersReducedMotion(), []);
  const saveData = useMemo(() => prefersReducedData(), []);
  const canAutoplay = autoPlayMuted && !reduceMotion && !saveData;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const visible = !!entry?.isIntersecting;
        setInView(visible);
        if (!visible && !el.paused) {
          el.pause();
          setPlaying(false);
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    setShowSources(true);
  }, [inView]);

  // After React attaches <source> children, browsers require an explicit load().
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !showSources || failed) return;
    setReady(false);
    el.load();
  }, [showSources, failed, mp4, webm]);

  // Don't spin forever if metadata never arrives (offline / blocked).
  useEffect(() => {
    if (!showSources || ready || failed) return;
    const t = window.setTimeout(() => {
      if (!videoRef.current || videoRef.current.readyState >= 2) return;
      setFailed(true);
    }, 12000);
    return () => window.clearTimeout(t);
  }, [showSources, ready, failed]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !showSources || !canAutoplay || !inView || failed) return;
    el.muted = true;
    const p = el.play();
    if (p) {
      p.then(() => setPlaying(true)).catch(() => {
        /* autoplay blocked — user can press play */
      });
    }
  }, [showSources, canAutoplay, inView, failed, ready]);

  const toggle = async () => {
    const el = videoRef.current;
    if (!el || failed) return;
    if (el.paused) {
      el.muted = true;
      try {
        await el.play();
        setPlaying(true);
      } catch {
        /* Keep poster + play control; do not treat gesture-blocked play as a media failure */
      }
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  return (
    <figure
      className={cn("surface relative overflow-hidden", className)}
      data-testid="product-demo-video"
    >
      <div className="relative aspect-video bg-muted/40">
        {!ready && !failed && showSources && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/50">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
            <span className="sr-only">Loading video</span>
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card/90 p-6 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="max-w-sm text-sm text-muted-foreground">
              Demo video couldn’t load. Check your connection, then try Play again.
            </p>
            <img
              src={poster}
              alt=""
              className="mt-2 max-h-40 rounded-xl object-cover opacity-80"
            />
          </div>
        )}
        <video
          ref={videoRef}
          className={cn("h-full w-full object-cover", failed && "invisible")}
          poster={poster}
          playsInline
          muted
          loop
          preload={saveData || !inView ? "none" : "metadata"}
          aria-label={title}
          onLoadedData={() => {
            setReady(true);
            setFailed(false);
          }}
          onError={() => {
            // Ignore transient errors before sources are attached.
            if (!showSources) return;
            setFailed(true);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        >
          {showSources && (
            <>
              {/* MP4 first — Safari / iOS; WebM as progressive enhancement */}
              <source src={mp4} type="video/mp4" />
              <source src={webm} type="video/webm" />
              <track kind="captions" src={captions} srcLang="en" label="English" default />
            </>
          )}
        </video>
        {!failed && (
          <div className="absolute bottom-3 left-3 z-20">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="min-h-11 cursor-pointer gap-1.5 shadow-soft"
              onClick={toggle}
              aria-pressed={playing}
              data-testid="product-demo-toggle"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playing ? "Pause" : "Play"}
            </Button>
          </div>
        )}
      </div>
      <figcaption className="border-t border-border/60 px-4 py-3 text-sm text-muted-foreground">
        {title}
        {saveData && (
          <span className="ml-2 text-xs">(autoplay off — reduced data)</span>
        )}
      </figcaption>
    </figure>
  );
}
