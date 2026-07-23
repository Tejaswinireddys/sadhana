/** Presentational welcome header for Home priority ladder (audit §11). */
export function HomeWelcomeHeader({
  title,
  dateLabel,
}: {
  title: string;
  dateLabel: string;
}) {
  return (
    <header className="grid gap-6 md:grid-cols-[1.2fr_0.8fr] md:items-end">
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
      <div
        className="relative hidden h-36 overflow-hidden rounded-2xl border border-card-border bg-card shadow-soft md:block"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,hsl(var(--primary)/0.12),transparent_55%)]" />
        <div className="absolute inset-y-0 right-0 flex items-end gap-2 pr-3 pt-3">
          {["tadasana", "balasana", "viparita-karani", "vrksasana"].map((slug, i) => (
            <img
              key={slug}
              src={`${import.meta.env.BASE_URL}poses/${slug}.png`}
              alt=""
              className="h-[7.5rem] w-auto rounded-xl object-cover shadow-soft"
              style={{ transform: `translateY(${(i % 2) * 10}px)` }}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          ))}
        </div>
      </div>
    </header>
  );
}
