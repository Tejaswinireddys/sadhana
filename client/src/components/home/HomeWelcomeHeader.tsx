/** Presentational welcome header for Home priority ladder (audit §11).
 *  Right panel is a decorative "hero moment": a layered pose composition with a
 *  soft gradient, depth, and gentle breath motion (reduced-motion / motion-off safe).
 */
const HERO_POSES = ["vrksasana", "tadasana", "balasana"];

export function HomeWelcomeHeader({
  title,
  dateLabel,
}: {
  title: string;
  dateLabel: string;
}) {
  const base = import.meta.env.BASE_URL;
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
        {/* Warm ambient wash */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_25%_15%,hsl(var(--primary)/0.16),transparent_60%),radial-gradient(ellipse_at_85%_90%,hsl(var(--secondary)/0.14),transparent_55%)]" />
        {/* Soft scrim so the left text edge blends into the panel */}
        <div className="absolute inset-0 bg-gradient-to-r from-card via-card/40 to-transparent" />

        {/* Layered poses — largest in front, receding for depth */}
        <div className="absolute inset-y-0 right-0 flex items-end">
          {HERO_POSES.map((slug, i) => {
            const depth = HERO_POSES.length - 1 - i; // 0 = front
            const heights = ["h-[11.5rem]", "h-[9.5rem]", "h-[8rem]"];
            const opacity = [1, 0.85, 0.65];
            return (
              <img
                key={slug}
                src={`${base}poses/${slug}.webp`}
                alt=""
                className={`hero-photo-breath -ml-6 w-auto rounded-2xl object-cover shadow-soft ${heights[depth]}`}
                style={{
                  opacity: opacity[depth],
                  transform: `translateY(${depth * 8}px) rotate(${(i - 1) * 2}deg)`,
                  zIndex: HERO_POSES.length - depth,
                  animationDelay: `${depth * 0.4}s`,
                }}
                loading="eager"
                decoding="async"
                draggable={false}
              />
            );
          })}
        </div>

        {/* Quiet caption chip */}
        <span className="absolute bottom-3 left-4 rounded-full bg-background/75 px-3 py-1 text-xs font-medium text-primary shadow-soft backdrop-blur-sm">
          Your practice, today
        </span>
      </div>
    </header>
  );
}
