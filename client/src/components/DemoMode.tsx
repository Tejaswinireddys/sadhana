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
import { asanaBySlug } from "@/data/content";
import { cn } from "@/lib/utils";
import { Play, Pause, Check, Sparkles } from "lucide-react";

export function DemoMode({ slug }: { slug: string }) {
  const asana = asanaBySlug(slug);
  const { toast } = useToast();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = asana?.steps ?? [];
  const stepCount = steps.length || 1;

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

  const src = `/voice/pose-${asana.slug}.mp3`;
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

        {/* Hero image — full width, breathes harder while playing */}
        <div className="relative w-full overflow-hidden rounded-2xl bg-accent/30">
          <img
            src={`/poses/${asana.slug}.png`}
            alt={`${asana.english} (${asana.sanskrit}) illustration`}
            draggable={false}
            className={cn(
              "block w-full select-none rounded-2xl object-cover shadow-soft-lg",
              playing ? "photo-breath-demo" : "photo-breath",
            )}
            data-testid={`demo-hero-${asana.slug}`}
          />
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
