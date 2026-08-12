/** Presentational welcome header for Home priority ladder (audit §11).
 *  Right panel is a decorative "hero moment": a layered pose composition with a
 *  soft gradient, depth, and gentle breath motion (reduced-motion / motion-off safe).
 */
import { useCallback, useState } from "react";
import { welcomeHeaderTitle } from "@/lib/welcomeTitle";

const HERO_POSES = ["vrksasana", "tadasana", "balasana"];

export function HomeWelcomeHeader({
  hasCompletedSessions,
  displayName,
  dateLabel,
}: {
  /** True once the practitioner has ≥1 completed session (a returning visitor). */
  hasCompletedSessions: boolean;
  /** The practitioner's display name, if we have a real one. */
  displayName?: string | null;
  dateLabel: string;
}) {
  const base = import.meta.env.BASE_URL;
  const title = welcomeHeaderTitle({ hasCompletedSessions, displayName });
  // Pale watercolour figures on a white card render as a blank white rectangle
  // for the whole load. Hold a visible placeholder until the front pose lands.
  const [heroReady, setHeroReady] = useState(false);
  const markReady = useCallback((node: HTMLImageElement | null) => {
    // Cached images can finish before onLoad is attached — check on mount too.
    if (node?.complete && node.naturalWidth > 0) setHeroReady(true);
  }, []);
  return (
    <header className="grid gap-6 md:grid-cols-[1.15fr_0.85fr] md:items-center">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground" data-testid="text-today-date">
          {dateLabel}
        </p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl" data-testid="text-welcome">
          {title}
        </h1>
        <p className="max-w-xl text-muted-foreground">
          One clear next step below — then more ways to practice if you want them.
        </p>
      </div>

      {/* Hero composition — decorative, hidden on small screens to protect layout. */}
      <div
        className="relative hidden h-48 overflow-hidden rounded-3xl border border-card-border bg-card shadow-soft-lg md:block"
        aria-hidden
        data-testid="home-hero-scene"
      >
        {/* Warm ambient wash. Deliberately stronger than the pose art so the
            panel reads as a designed surface even before anything loads. */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_25%_15%,hsl(var(--primary)/0.22),transparent_60%),radial-gradient(ellipse_at_85%_90%,hsl(var(--secondary)/0.18),transparent_55%)]" />

        {/* Placeholder while the figures decode — never a blank white box. */}
        <div
          className={`absolute inset-y-6 right-6 flex items-end gap-3 transition-opacity duration-500 ${
            heroReady ? "opacity-0" : "opacity-100"
          }`}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-16 animate-pulse rounded-2xl bg-primary/10"
              style={{ height: `${9 - i * 1.5}rem`, animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>

        {/* Layered poses — largest in front, receding for depth */}
        <div className="absolute inset-y-0 right-0 flex items-end">
          {HERO_POSES.map((slug, i) => {
            const depth = HERO_POSES.length - 1 - i; // 0 = front
            const heights = ["h-[11.5rem]", "h-[9.5rem]", "h-[8rem]"];
            const opacity = [1, 0.85, 0.65];
            return (
              <img
                key={slug}
                ref={depth === 0 ? markReady : undefined}
                onLoad={depth === 0 ? () => setHeroReady(true) : undefined}
                src={`${base}poses/${slug}.png`}
                alt=""
                width={600}
                height={1200}
                className={`hero-photo-breath -ml-6 w-auto rounded-2xl object-contain shadow-soft transition-opacity duration-500 ${heights[depth]}`}
                style={{
                  opacity: heroReady ? opacity[depth] : 0,
                  transform: `translateY(${depth * 8}px) rotate(${(i - 1) * 2}deg)`,
                  zIndex: HERO_POSES.length - depth,
                  animationDelay: `${depth * 0.4}s`,
                }}
                loading={depth === 0 ? "eager" : "lazy"}
                decoding="async"
                draggable={false}
              />
            );
          })}
        </div>

        {/* Scrim behind the caption only — a full-width scrim washed the art out
            in light mode, and the caption sat *under* the z-indexed photos, so
            "Your practice, today" was clipped to "Your pr…". */}
        <div className="absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-card via-card/80 to-transparent" />
        <span className="absolute bottom-3 left-4 z-20 rounded-full bg-background px-3 py-1 text-xs font-semibold text-foreground shadow-soft ring-1 ring-card-border">
          Your practice, today
        </span>
      </div>
    </header>
  );
}
