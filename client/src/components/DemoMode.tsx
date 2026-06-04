// DemoMode — an instructor-led "guided demo" for an asana.
//   - Shows the pose hero image large, full width.
//   - A prominent terracotta "Watch a guided demo" CTA.
//   - On play: narration audio starts, the hero image breathes more visibly,
//     and step captions appear one-by-one below the image, timed to the actual
//     audio length via `timeupdate` (no hard-coded timings).
//   - A progress bar across the top tracks narration playback.
//   - Pause freezes audio AND step rotation. On end, a soft completion message
//     with a "Got it" button closes the demo back to the regular detail view.
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { asanaBySlug, DEFAULT_FOCUS_ZONE } from "@/data/content";
import { cn } from "@/lib/utils";
import { Play, Pause, Check, Sparkles } from "lucide-react";

export function DemoMode({ slug }: { slug: string }) {
  const asana = asanaBySlug(slug);
  const { toast } = useToast();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const imgWrapRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = asana?.steps ?? [];
  const stepCount = steps.length || 1;

  // Focus zone for the currently active step (falls back to whole-body).
  // Coordinates are normalized 0-1; we scale by 100 onto a 0..100 viewBox.
  const activeZone =
    (started && steps[stepIndex]?.focusZone) || DEFAULT_FOCUS_ZONE;

  // Measure the rendered image box so the focus halo stays a true circle
  // regardless of the pose image's aspect ratio.
  useEffect(() => {
    const el = imgWrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset everything when navigating to a different pose.
  useEffect(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    setPlaying(false);
    setStarted(false);
    setCompleted(false);
    setCurrent(0);
    setStepIndex(0);
  }, [slug]);

  if (!asana) return null;

  const src = `${import.meta.env.BASE_URL}voice/pose-${asana.slug}.mp3`;
  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  const start = () => {
    const a = audioRef.current;
    if (!a) return;
    setStarted(true);
    setCompleted(false);
    const p = a.play();
    if (p && typeof p.then === "function") {
      p.then(() => setPlaying(true)).catch((err) => {
        setPlaying(false);
        toast({
          title: "Couldn't start the demo",
          description: err?.message || "The narration couldn't play. Please try again.",
          variant: "destructive",
        });
      });
    } else {
      setPlaying(true);
    }
  };

  const pause = () => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    setPlaying(false);
  };

  const resume = () => {
    const a = audioRef.current;
    if (!a) return;
    const p = a.play();
    if (p && typeof p.then === "function") {
      p.then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      setPlaying(true);
    }
  };

  const closeDemo = () => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    setPlaying(false);
    setStarted(false);
    setCompleted(false);
    setCurrent(0);
    setStepIndex(0);
  };

  return (
    <section
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
      data-testid={`demo-mode-${asana.slug}`}
    >
      {/* progress bar across the top */}
      <div className="h-1.5 w-full bg-accent/40" aria-hidden>
        <div
          className="h-full bg-primary transition-[width] duration-200 ease-linear"
          style={{ width: started ? `${progress}%` : "0%" }}
          data-testid={`demo-progress-${asana.slug}`}
        />
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Guided demo
          </span>
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
            {asana.english}
          </h2>
          <p className="text-sm text-muted-foreground">{asana.sanskrit}</p>
        </div>

        {/* Hero image — full width, breathes harder while playing, with an
            animated SVG "focus halo" overlay that moves to the body region the
            current step targets. */}
        <div ref={imgWrapRef} className="relative w-full overflow-hidden rounded-2xl bg-accent/30">
          <img
            src={`${import.meta.env.BASE_URL}poses/${asana.slug}.png`}
            alt={`${asana.english} (${asana.sanskrit}) illustration`}
            draggable={false}
            className={cn(
              "block w-full select-none rounded-2xl object-cover shadow-soft-lg",
              playing ? "photo-breath-demo photo-brightness-pulse" : "photo-breath",
            )}
            data-testid={`demo-hero-${asana.slug}`}
          />

          {/* Focus overlay — only while the demo is running. The circle cx/cy/r
              are CSS-transitioned (300ms) so the halo glides between steps. */}
          {started && !completed && (
            (() => {
              // Pixel coords from normalized zone. Radius scales with the
              // smaller dimension so the halo is a true circle.
              const cx = activeZone.cx * box.w;
              const cy = activeZone.cy * box.h;
              const r = activeZone.r * Math.min(box.w || 1, box.h || 1);
              const tween = "cx 300ms ease, cy 300ms ease, r 300ms ease";
              return (
                <svg
                  viewBox={`0 0 ${box.w || 1} ${box.h || 1}`}
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  aria-hidden
                  data-testid={`demo-focus-overlay-${asana.slug}`}
                >
                  {/* Pulsing terracotta halo over the active region */}
                  <circle
                    className="focus-halo-breath"
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="hsl(var(--primary))"
                    style={{ transition: tween }}
                    data-testid={`demo-focus-halo-${asana.slug}`}
                  />
                  {/* Crisper ring outline for an unmistakable target */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth={Math.max(2, (box.w || 0) * 0.008)}
                    strokeOpacity={0.85}
                    style={{ transition: tween }}
                  />
                  {/* Small indicator arrow bobbing in from above the region. */}
                  <g
                    style={{
                      transition: "transform 300ms ease",
                      transform: `translate(${cx}px, ${cy - r - 10}px)`,
                    }}
                  >
                    <g className="focus-arrow-bob">
                      <path d="M0 9 L-7 0 L7 0 Z" fill="hsl(var(--primary))" />
                    </g>
                  </g>
                </svg>
              );
            })()
          )}

          {/* Caption naming the focused region, for clarity + accessibility */}
          {started && !completed && (
            <span
              className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/85 px-3 py-1 text-xs font-medium text-primary shadow-soft backdrop-blur-sm"
              data-testid={`demo-focus-label-${asana.slug}`}
            >
              {activeZone.label}
            </span>
          )}
        </div>

        {/* CTA / playback controls */}
        {!started ? (
          <Button
            size="lg"
            onClick={start}
            data-testid={`button-watch-demo-${asana.slug}`}
            className="w-full gap-2 rounded-full bg-primary py-6 text-base font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Play className="h-5 w-5 fill-current" /> Watch a guided demo
          </Button>
        ) : completed ? (
          <div
            className="flex flex-col items-center gap-3 rounded-xl bg-accent/40 p-6 text-center"
            data-testid={`demo-complete-${asana.slug}`}
          >
            <p className="font-serif text-lg">Demo complete · Try the pose yourself</p>
            <Button
              onClick={closeDemo}
              variant="default"
              className="gap-2 rounded-full"
              data-testid={`button-demo-got-it-${asana.slug}`}
            >
              <Check className="h-4 w-4" /> Got it
            </Button>
          </div>
        ) : (
          <Button
            size="lg"
            variant="secondary"
            onClick={playing ? pause : resume}
            data-testid={`button-pause-demo-${asana.slug}`}
            className="w-full gap-2 rounded-full py-6 text-base font-medium"
          >
            {playing ? (
              <>
                <Pause className="h-5 w-5" /> Pause
              </>
            ) : (
              <>
                <Play className="h-5 w-5 fill-current" /> Resume
              </>
            )}
          </Button>
        )}

        {/* Synchronized step captions — appear one by one below the image */}
        {started && !completed && (
          <ol className="space-y-2" data-testid={`demo-steps-${asana.slug}`}>
            {steps.map((step, i) => {
              const isActive = i === stepIndex;
              const isPast = i < stepIndex;
              return (
                <li
                  key={i}
                  className={cn(
                    "rounded-lg px-4 py-3 transition-all duration-500",
                    isActive
                      ? "border-l-4 border-primary bg-accent/50 text-base font-medium text-foreground opacity-100"
                      : isPast
                        ? "border-l-4 border-transparent text-sm text-muted-foreground opacity-60"
                        : "border-l-4 border-transparent text-sm text-muted-foreground opacity-40",
                  )}
                  data-testid={`demo-step-${asana.slug}-${i}`}
                  aria-current={isActive ? "step" : undefined}
                >
                  <span className="mr-2 font-serif text-primary">{i + 1}.</span>
                  {step.text}
                </li>
              );
            })}
          </ol>
        )}

        <audio
          ref={audioRef}
          src={src}
          preload="auto"
          data-testid={`demo-audio-${asana.slug}`}
          onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
          onTimeUpdate={(e) => {
            const a = e.target as HTMLAudioElement;
            setCurrent(a.currentTime);
            if (a.duration > 0) {
              const idx = Math.min(
                stepCount - 1,
                Math.floor((a.currentTime / a.duration) * stepCount),
              );
              setStepIndex(idx);
            }
          }}
          onEnded={() => {
            setPlaying(false);
            setCompleted(true);
            setStepIndex(stepCount - 1);
          }}
          onError={() => {
            setPlaying(false);
            toast({
              title: "Demo audio unavailable",
              description: `Couldn't load narration (${src}).`,
              variant: "destructive",
            });
          }}
        />
      </div>
    </section>
  );
}
