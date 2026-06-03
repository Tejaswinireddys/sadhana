// BreathingVisualizer — drives a breathing technique using a single
// requestAnimationFrame loop + elapsed-time math (NO setTimeout chains), so
// pausing/resuming is exact. An expanding circle grows on inhale, holds on
// retention, shrinks on exhale, and holds again on empty. A phase counter and
// cycle counter are shown. Optional Nadi Shodhana mode alternates the active
// nostril side per round.
//
// The visualizer's circle size is computed from elapsed time within the
// current phase (it is NOT a CSS animation), so it pauses cleanly. We still
// add `.breath-circle` so it is suppressed under reduced-motion/motion-off
// only for the gentle idle pulse before starting.

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw } from "lucide-react";

export type BreathPhase = { label: string; seconds: number };

export type BreathConfig = {
  phases: BreathPhase[];
  rounds: number;
  // when true, alternate active nostril each round (Nadi Shodhana)
  alternateNostril?: boolean;
  // rapid mode (Kapalabhati): show pumping pulse instead of slow circle
  rapid?: boolean;
};

type Props = {
  config: BreathConfig;
  onComplete?: (totalSeconds: number) => void;
  accent?: string; // tailwind text color class for the circle, default primary
};

// Map phase label to a target scale of the circle (0.45 = empty, 1 = full).
function phaseTargets(label: string): { from: number; to: number } {
  const l = label.toLowerCase();
  if (l.includes("inhale")) return { from: 0.45, to: 1 };
  if (l.includes("exhale")) return { from: 1, to: 0.45 };
  if (l.includes("hold")) {
    // hold-full vs hold-empty inferred by caller ordering; default hold-full
    return { from: 1, to: 1 };
  }
  return { from: 0.7, to: 0.7 };
}

export function BreathingVisualizer({ config, onComplete, accent = "text-primary" }: Props) {
  const [running, setRunning] = useState(false);
  const [round, setRound] = useState(0); // completed rounds
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [phaseElapsed, setPhaseElapsed] = useState(0); // seconds into current phase
  const [scale, setScale] = useState(0.7);
  const [done, setDone] = useState(false);

  // refs for the rAF loop (avoid stale closures)
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const phaseElapsedRef = useRef(0);
  const phaseIdxRef = useRef(0);
  const roundRef = useRef(0);
  const totalRef = useRef(0);

  const phases = config.phases;
  const totalRounds = config.rounds;

  // derive correct hold target (empty vs full) based on the previous phase
  const targetFor = useCallback(
    (idx: number) => {
      const ph = phases[idx];
      const l = ph.label.toLowerCase();
      if (l.includes("inhale")) return { from: 0.45, to: 1 };
      if (l.includes("exhale")) return { from: 1, to: 0.45 };
      if (l.includes("hold")) {
        const prev = phases[(idx - 1 + phases.length) % phases.length];
        const pl = prev.label.toLowerCase();
        // hold after inhale => full; hold after exhale => empty
        if (pl.includes("exhale")) return { from: 0.45, to: 0.45 };
        return { from: 1, to: 1 };
      }
      return phaseTargets(ph.label);
    },
    [phases],
  );

  const stopLoop = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTsRef.current = null;
  };

  const finish = useCallback(() => {
    stopLoop();
    setRunning(false);
    setDone(true);
    setScale(0.7);
    onComplete?.(Math.round(totalRef.current));
  }, [onComplete]);

  const tick = useCallback(
    (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      phaseElapsedRef.current += dt;
      totalRef.current += dt;

      let idx = phaseIdxRef.current;
      let ph = phases[idx];

      // advance through any completed phases
      while (phaseElapsedRef.current >= ph.seconds) {
        phaseElapsedRef.current -= ph.seconds;
        idx += 1;
        if (idx >= phases.length) {
          idx = 0;
          roundRef.current += 1;
          if (roundRef.current >= totalRounds) {
            setRound(roundRef.current);
            finish();
            return;
          }
        }
        ph = phases[idx];
      }

      phaseIdxRef.current = idx;

      // interpolate the circle scale within the current phase
      const { from, to } = targetFor(idx);
      const frac = ph.seconds > 0 ? Math.min(1, phaseElapsedRef.current / ph.seconds) : 1;
      const s = from + (to - from) * frac;

      setScale(s);
      setPhaseIdx(idx);
      setPhaseElapsed(phaseElapsedRef.current);
      setRound(roundRef.current);

      rafRef.current = requestAnimationFrame(tick);
    },
    [phases, totalRounds, targetFor, finish],
  );

  const start = () => {
    setDone(false);
    setRunning(true);
    // reset
    phaseElapsedRef.current = 0;
    phaseIdxRef.current = 0;
    roundRef.current = 0;
    totalRef.current = 0;
    lastTsRef.current = null;
    setPhaseIdx(0);
    setRound(0);
    rafRef.current = requestAnimationFrame(tick);
  };

  const togglePause = () => {
    if (running) {
      stopLoop();
      setRunning(false);
    } else {
      setRunning(true);
      lastTsRef.current = null;
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  const reset = () => {
    stopLoop();
    setRunning(false);
    setDone(false);
    phaseElapsedRef.current = 0;
    phaseIdxRef.current = 0;
    roundRef.current = 0;
    totalRef.current = 0;
    setPhaseIdx(0);
    setPhaseElapsed(0);
    setRound(0);
    setScale(0.7);
  };

  // cleanup
  useEffect(() => () => stopLoop(), []);

  const ph = phases[phaseIdx];
  const phaseRemaining = ph ? Math.max(0, Math.ceil(ph.seconds - phaseElapsed)) : 0;
  const activeSide = config.alternateNostril ? (round % 2 === 0 ? "left" : "right") : null;

  const px = 240;
  const circlePx = Math.round(px * scale);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Visualizer */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: px, height: px }}
        data-testid="breathing-visualizer"
      >
        {/* outer ring guide */}
        <div className="absolute inset-0 rounded-full border border-border opacity-40" />
        {/* the breathing circle */}
        <div
          className={`breath-circle rounded-full bg-current ${accent}`}
          style={{
            width: circlePx,
            height: circlePx,
            opacity: 0.16 + scale * 0.18,
            transition: running ? "none" : "width 0.4s ease, height 0.4s ease",
          }}
        />
        {/* phase text overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {config.alternateNostril && running && (
            <div className="mb-2 flex items-center gap-2" data-testid="text-nostril-side">
              <span
                className={`inline-block h-3 w-3 rounded-full ${
                  activeSide === "left" ? "bg-primary" : "bg-muted"
                }`}
              />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {activeSide === "left" ? "Left nostril" : "Right nostril"}
              </span>
              <span
                className={`inline-block h-3 w-3 rounded-full ${
                  activeSide === "right" ? "bg-primary" : "bg-muted"
                }`}
              />
            </div>
          )}
          <p className="font-serif text-2xl" data-testid="text-breath-phase">
            {done ? "Complete" : ph?.label ?? "Ready"}
          </p>
          {running && !done && (
            <p className="mt-1 font-serif text-4xl tabular-nums" data-testid="text-breath-count">
              {phaseRemaining}
            </p>
          )}
        </div>
      </div>

      {/* Round counter */}
      <p className="text-sm text-muted-foreground" data-testid="text-round-counter">
        Round <span className="tabular-nums">{Math.min(round + (running ? 1 : 0), totalRounds)}</span> of{" "}
        <span className="tabular-nums">{totalRounds}</span>
      </p>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {!running && !done && round === 0 && phaseElapsed === 0 ? (
          <Button size="lg" onClick={start} data-testid="button-breath-start">
            <Play className="mr-2 h-5 w-5" /> Start
          </Button>
        ) : (
          <>
            <Button
              size="lg"
              variant="outline"
              onClick={togglePause}
              disabled={done}
              data-testid="button-breath-pause"
            >
              {running ? <Pause className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5" />}
              {running ? "Pause" : "Resume"}
            </Button>
            <Button size="lg" variant="ghost" onClick={done ? start : reset} data-testid="button-breath-reset">
              <RotateCcw className="mr-2 h-5 w-5" /> {done ? "Again" : "Reset"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
