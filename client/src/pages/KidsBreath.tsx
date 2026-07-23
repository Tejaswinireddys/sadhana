import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { VoicePlayer } from "@/components/VoicePlayer";
import { ParentGate } from "@/components/ParentGate";
import { EmptyState } from "@/components/EmptyState";
import { useKidsGate } from "@/context/KidsGateContext";
import { kidsBreathBySlug, type KidsBreath as KidsBreathType } from "@/data/kids";
import { ArrowLeft, Play, Pause, Heart } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

// A simple, kid-friendly breath driver. One requestAnimationFrame loop tracks
// where we are in the inhale/exhale cycle so pause/resume is exact. We expose a
// normalized "openness" value (0 = empty/small, 1 = full/big) and the current
// phase label so each visualizer can animate distinctly. Round counts don't
// matter for kids — it simply loops until they tap pause.
type Phase = "in" | "out";

function useBreathCycle(inSeconds: number, outSeconds: number) {
  const [running, setRunning] = useState(false);
  const [openness, setOpenness] = useState(0.12);
  const [phase, setPhase] = useState<Phase>("in");

  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const elapsedRef = useRef(0); // seconds into current phase
  const phaseRef = useRef<Phase>("in");

  const stop = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTsRef.current = null;
  };

  const tick = useCallback(
    (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      elapsedRef.current += dt;

      let dur = phaseRef.current === "in" ? inSeconds : outSeconds;
      while (elapsedRef.current >= dur) {
        elapsedRef.current -= dur;
        phaseRef.current = phaseRef.current === "in" ? "out" : "in";
        dur = phaseRef.current === "in" ? inSeconds : outSeconds;
      }
      const frac = dur > 0 ? Math.min(1, elapsedRef.current / dur) : 1;
      const o = phaseRef.current === "in" ? 0.12 + 0.88 * frac : 1 - 0.88 * frac;
      setOpenness(o);
      setPhase(phaseRef.current);
      rafRef.current = requestAnimationFrame(tick);
    },
    [inSeconds, outSeconds],
  );

  const toggle = () => {
    if (running) {
      stop();
      setRunning(false);
    } else {
      setRunning(true);
      lastTsRef.current = null;
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  useEffect(() => () => stop(), []);

  return { running, openness, phase, toggle };
}

function phaseLabel(visualizer: KidsBreathType["visualizer"], phase: Phase): string {
  if (visualizer === "bunny") return phase === "in" ? "Sniff, sniff, sniff!" : "Long breath out...";
  if (visualizer === "bumblebee") return phase === "in" ? "Breathe in..." : "Hummmmm...";
  if (visualizer === "pinwheel") return phase === "in" ? "Breathe in..." : "Blowww out!";
  return phase === "in" ? "Breathe in..." : "Breathe out...";
}

// ---- Visualizers ----
function BalloonViz({ openness }: { openness: number }) {
  const size = 80 + openness * 150; // 80 -> 230px
  return (
    <div className="relative flex h-[260px] w-full items-center justify-center" data-testid="viz-balloon">
      <div
        className="rounded-full bg-[hsl(16_72%_60%)] shadow-soft"
        style={{
          width: size,
          height: size,
          opacity: 0.55 + openness * 0.35,
          transition: "none",
        }}
      />
    </div>
  );
}

function BunnyViz({ openness, phase }: { openness: number; phase: Phase }) {
  // During the inhale (sniffs) the circle does small quick pulses; on exhale it
  // shrinks down slowly and smoothly.
  const base = 90;
  const sniff = phase === "in" ? Math.abs(Math.sin(openness * Math.PI * 6)) * 60 : 0;
  const size = phase === "in" ? base + 30 + sniff : base + (1 - openness) * 0 + openness * 90;
  const display = phase === "in" ? base + sniff : 90 + openness * 90;
  return (
    <div className="relative flex h-[260px] w-full items-center justify-center" data-testid="viz-bunny">
      <div
        className="rounded-full bg-[hsl(330_55%_70%)] shadow-soft"
        style={{ width: display, height: display, opacity: 0.6, transition: "none" }}
      />
    </div>
  );
}

function BumblebeeViz({ openness, phase }: { openness: number; phase: Phase }) {
  const size = 90 + openness * 130;
  // On the exhale (hum) add a small horizontal wobble.
  const wobble = phase === "out" ? Math.sin(Date.now() / 60) * 6 : 0;
  return (
    <div className="relative flex h-[260px] w-full items-center justify-center" data-testid="viz-bumblebee">
      <div
        className="rounded-full bg-[hsl(45_90%_55%)] shadow-soft"
        style={{
          width: size,
          height: size,
          opacity: 0.6 + openness * 0.3,
          transform: `translateX(${wobble}px)`,
          transition: "none",
        }}
      />
      {phase === "out" && (
        <span className="absolute bottom-6 text-2xl font-bold text-[hsl(45_70%_35%)] kids-title">
          bzzzz
        </span>
      )}
    </div>
  );
}

function PinwheelViz({ openness, phase }: { openness: number; phase: Phase }) {
  // Spin angle accumulates faster during the exhale.
  const angleRef = useRef(0);
  const [angle, setAngle] = useState(0);
  useEffect(() => {
    const speed = phase === "out" ? 6 + openness * 10 : 1.2; // deg per frame
    angleRef.current = (angleRef.current + speed) % 360;
    setAngle(angleRef.current);
  }, [openness, phase]);

  const colors = ["hsl(16 72% 60%)", "hsl(45 90% 55%)", "hsl(200 60% 60%)", "hsl(330 55% 70%)"];
  return (
    <div className="relative flex h-[260px] w-full items-center justify-center" data-testid="viz-pinwheel">
      <svg width={200} height={200} viewBox="0 0 200 200" style={{ transform: `rotate(${angle}deg)` }}>
        {colors.map((c, i) => (
          <path
            key={i}
            d="M100 100 L100 18 Q140 30 132 70 Z"
            fill={c}
            transform={`rotate(${i * 90} 100 100)`}
          />
        ))}
        <circle cx="100" cy="100" r="10" fill="hsl(28 35% 30%)" />
      </svg>
      {/* stick */}
      <div className="absolute bottom-2 h-16 w-1.5 rounded-full bg-[hsl(28_35%_45%)]" />
    </div>
  );
}

function Visualizer({ breath, openness, phase }: { breath: KidsBreathType; openness: number; phase: Phase }) {
  switch (breath.visualizer) {
    case "balloon":
      return <BalloonViz openness={openness} />;
    case "bunny":
      return <BunnyViz openness={openness} phase={phase} />;
    case "bumblebee":
      return <BumblebeeViz openness={openness} phase={phase} />;
    case "pinwheel":
      return <PinwheelViz openness={openness} phase={phase} />;
  }
}

export default function KidsBreath() {
  useDocumentTitle("Kids breath · Sadhana");
  const { slug } = useParams();
  const { unlocked } = useKidsGate();
  const breath = kidsBreathBySlug(slug);
  const cycle = useBreathCycle(breath?.inSeconds ?? 4, breath?.outSeconds ?? 4);

  if (!breath) {
    return (
      <EmptyState title="Breathing game not found" description="That breathing game isn't here.">
        <Button asChild>
          <Link href="/kids">Back to Kids</Link>
        </Button>
      </EmptyState>
    );
  }

  return (
    <>
      <ParentGate />
      {unlocked && (
        <div className="kids-zone animate-fade-in space-y-6 p-5 sm:p-8" data-testid={`kids-breath-${breath.slug}`}>
          <Link
            href="/kids"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/70 hover:text-foreground"
            data-testid="link-back-kids"
          >
            <ArrowLeft className="h-4 w-4" /> All games
          </Link>

          <div className="space-y-1 text-center">
            <h1 className="kids-title text-4xl font-bold leading-tight" data-testid="text-kids-breath-title">
              {breath.techniqueName}
            </h1>
            <p className="text-lg text-foreground/75">{breath.description}</p>
          </div>

          {/* Animated visualizer */}
          <div className="kids-card mx-auto max-w-md border border-[hsl(38_60%_70%/0.6)] bg-white/60 p-4 dark:bg-white/5">
            <Visualizer breath={breath} openness={cycle.openness} phase={cycle.phase} />
            <p className="kids-title text-center text-2xl font-bold text-[hsl(16_72%_48%)]" data-testid="text-breath-phase">
              {cycle.running ? phaseLabel(breath.visualizer, cycle.phase) : "Ready when you are!"}
            </p>
          </div>

          {/* Start / Pause */}
          <div className="flex justify-center">
            <Button
              size="lg"
              className="rounded-full bg-[hsl(16_72%_55%)] px-10 text-lg hover:bg-[hsl(16_72%_48%)]"
              onClick={cycle.toggle}
              data-testid="button-breath-toggle"
            >
              {cycle.running ? (
                <>
                  <Pause className="mr-2 h-6 w-6" /> Pause
                </>
              ) : (
                <>
                  <Play className="mr-2 h-6 w-6" /> Start
                </>
              )}
            </Button>
          </div>

          {/* Voice player */}
          <div className="mx-auto max-w-md">
            <VoicePlayer
              src={`${import.meta.env.BASE_URL}voice/kids-${breath.slug}.mp3`}
              slug={breath.slug}
              label="Listen along"
            />
          </div>

          {/* Why we do this */}
          <div className="kids-card mx-auto flex max-w-md items-start gap-3 border border-[hsl(38_60%_70%/0.6)] bg-[hsl(41_80%_88%)] p-4 dark:bg-white/5">
            <Heart className="mt-0.5 h-5 w-5 shrink-0 fill-[hsl(16_72%_60%)] text-[hsl(16_72%_55%)]" />
            <div>
              <p className="kids-title text-base font-bold">Why we do this</p>
              <p className="text-sm text-foreground/75" data-testid="text-breath-why">{breath.why}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
