/**
 * Decorative landing hero: soft “mat + breathing silhouette” with CSS perspective.
 * No Three.js/Spline — dynamic-imported, pauses offscreen, skips on narrow / reduced-motion.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useMotionEnabled } from "@/components/motion";

type HeroBreathSceneProps = {
  className?: string;
  /** Static photo shown when motion/3D is disabled or offscreen */
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

  const animate = motionOn && inView && !narrow;

  return (
    <div
      ref={rootRef}
      className={cn("relative mx-auto w-full max-w-md", className)}
      data-testid="hero-breath-scene"
    >
      {/* Static fallback — always in DOM for LCP / reduced-motion / mobile */}
      <img
        src={fallbackSrc}
        alt={fallbackAlt}
        width={600}
        height={1200}
        className={cn(
          "w-full rounded-2xl border border-border/60 object-cover shadow-soft-lg transition-opacity duration-300",
          animate ? "opacity-0 absolute inset-0 pointer-events-none" : "opacity-100 relative",
        )}
        decoding="async"
        fetchPriority="high"
      />

      {animate && (
        <div
          className="hero-scene relative aspect-[3/4] overflow-hidden rounded-2xl border border-border/60 shadow-soft-lg"
          aria-hidden
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_40%_20%,hsl(var(--primary)/0.18),transparent_55%),linear-gradient(180deg,hsl(var(--accent)/0.5),hsl(var(--background)))]" />

          {/* Floor / mat plane */}
          <div className="hero-mat absolute bottom-[12%] left-[8%] right-[8%] h-[28%] rounded-[50%] bg-primary/25 blur-[1px]" />
          <div className="hero-mat absolute bottom-[14%] left-[14%] right-[14%] h-[18%] rounded-[50%] border border-primary/30 bg-card/40" />

          {/* Soft instructor silhouette (SVG) */}
          <svg
            className="hero-figure absolute inset-x-[18%] bottom-[22%] top-[12%] text-primary/80"
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

          <p className="absolute bottom-3 left-0 right-0 text-center text-[11px] font-medium tracking-wide text-muted-foreground">
            Breathe with the practice
          </p>
        </div>
      )}
    </div>
  );
}
