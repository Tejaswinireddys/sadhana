/**
 * Decorative landing hero: real pose photo with soft CSS perspective / breath.
 * No Three.js/Spline — dynamic-imported, pauses offscreen, respects reduced-motion.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useMotionEnabled } from "@/components/motion";

type HeroBreathSceneProps = {
  className?: string;
  /** Static photo shown as the visual anchor */
  fallbackSrc?: string;
  fallbackAlt?: string;
};

export default function HeroBreathScene({
  className,
  fallbackSrc = `${import.meta.env.BASE_URL}poses/tadasana.png`,
  fallbackAlt = "Illustrated Mountain Pose from the Sadhana asana library",
}: HeroBreathSceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const motionOn = useMotionEnabled();
  const [inView, setInView] = useState(true);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const sync = () => setNarrow(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(!!entry?.isIntersecting),
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Always keep the pose photo visible. Depth/breath overlays only when motion is allowed.
  const animate = motionOn && inView;
  const strongDepth = animate && !narrow;

  return (
    <div
      ref={rootRef}
      className={cn("relative mx-auto w-full max-w-md", className)}
      data-testid="hero-breath-scene"
    >
      <div
        className={cn(
          "hero-scene relative overflow-hidden rounded-2xl border border-border/60 shadow-soft-lg",
          strongDepth && "hero-scene-depth",
          animate && "hero-scene-alive",
        )}
      >
        <img
          src={fallbackSrc}
          alt={fallbackAlt}
          width={600}
          height={1200}
          className={cn(
            "relative z-[1] aspect-[3/4] w-full object-cover",
            animate && "hero-photo-breath",
          )}
          decoding="async"
          fetchPriority="high"
        />

        {/* Soft atmosphere — always present for brand depth */}
        <div
          className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(ellipse_at_40%_18%,hsl(var(--primary)/0.14),transparent_52%),linear-gradient(180deg,transparent_55%,hsl(var(--background)/0.35))]"
          aria-hidden
        />

        {/* Mat plane + silhouette only when motion is on (decorative, aria-hidden) */}
        {animate && (
          <div className="pointer-events-none absolute inset-0 z-[3]" aria-hidden>
            <div className="hero-mat absolute bottom-[10%] left-[10%] right-[10%] h-[22%] rounded-[50%] bg-primary/20 blur-[2px]" />
            <div className="hero-mat absolute bottom-[12%] left-[16%] right-[16%] h-[14%] rounded-[50%] border border-primary/25 bg-card/25" />
            {strongDepth && (
              <svg
                className="hero-figure absolute inset-x-[22%] bottom-[24%] top-[18%] text-primary/35"
                viewBox="0 0 120 220"
                fill="currentColor"
              >
                <ellipse cx="60" cy="28" rx="16" ry="18" className="opacity-90" />
                <path
                  d="M60 48c-14 2-26 18-28 46-1 18 4 36 10 52l8 28h20l8-28c6-16 11-34 10-52-2-28-14-44-28-46z"
                  className="opacity-85"
                />
                <path d="M32 100c-18 8-28 22-30 38 12-4 24-6 34-4" className="opacity-70" />
                <path d="M88 100c18 8 28 22 30 38-12-4-24-6-34-4" className="opacity-70" />
                <path d="M48 170c-4 16-6 28-4 40h12l4-40" className="opacity-75" />
                <path d="M72 170c4 16 6 28 4 40H64l-4-40" className="opacity-75" />
              </svg>
            )}
            <p className="absolute bottom-3 left-0 right-0 text-center text-[11px] font-medium tracking-wide text-background/90 drop-shadow-sm">
              Breathe with the practice
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
