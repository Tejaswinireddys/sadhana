/**
 * Adaptive difficulty / recovery from RPE, skips, and readiness.
 * Conservative by default — never increases load after high effort or pain flags.
 */
import { KEYS, readJson, writeJson } from "./localPrefs";

export type RpeScore = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type SessionOutcome = {
  at: string;
  rpe: RpeScore;
  /** 0–1 fraction of poses skipped */
  skipRate: number;
  minutes: number;
  pathwaySlug?: string | null;
  sore?: boolean;
};

export type AdaptiveAdvice = {
  intensity: "recover" | "easy" | "steady" | "build";
  holdScale: number;
  preferNeed: string;
  maxMinutes: number;
  reasons: string[];
  /** Human-readable plan label for Today */
  headline: string;
};

const OUTCOMES_KEY = "sadhana.adaptive.outcomes";
const MAX_OUTCOMES = 30;

export function readOutcomes(): SessionOutcome[] {
  return readJson<SessionOutcome[]>(OUTCOMES_KEY, []);
}

export function recordOutcome(outcome: SessionOutcome): void {
  const list = readOutcomes();
  list.unshift(outcome);
  writeJson(OUTCOMES_KEY, list.slice(0, MAX_OUTCOMES));
}

export function clearOutcomes(): void {
  writeJson(OUTCOMES_KEY, []);
}

/** Derive next-session advice from recent outcomes. Safety > engagement. */
export function adviseNextSession(outcomes = readOutcomes()): AdaptiveAdvice {
  const recent = outcomes.slice(0, 5);
  const reasons: string[] = [];

  if (recent.length === 0) {
    return {
      intensity: "steady",
      holdScale: 1,
      preferNeed: "calm",
      maxMinutes: 20,
      reasons: ["No recent effort data — starting with a steady, moderate plan."],
      headline: "A steady practice for today",
    };
  }

  const last = recent[0]!;
  const avgRpe = recent.reduce((s, o) => s + o.rpe, 0) / recent.length;
  const avgSkip = recent.reduce((s, o) => s + o.skipRate, 0) / recent.length;

  if (last.sore || last.rpe >= 9) {
    reasons.push(
      last.sore
        ? "You marked soreness last time — choosing recovery."
        : `Last effort was RPE ${last.rpe}/10 — choosing recovery.`,
    );
    return {
      intensity: "recover",
      holdScale: 0.7,
      preferNeed: "calm",
      maxMinutes: 12,
      reasons,
      headline: "A gentle recovery session",
    };
  }

  if (avgRpe >= 7.5 || avgSkip >= 0.35) {
    reasons.push(
      avgSkip >= 0.35
        ? "Several poses were skipped recently — easing intensity."
        : `Average recent RPE is ${avgRpe.toFixed(1)} — easing intensity.`,
    );
    return {
      intensity: "easy",
      holdScale: 0.85,
      preferNeed: "calm",
      maxMinutes: 15,
      reasons,
      headline: "An easier practice to rebuild momentum",
    };
  }

  if (avgRpe <= 4 && avgSkip < 0.1 && recent.length >= 3) {
    reasons.push("Recent sessions felt manageable — a slight build is available (you can override).");
    return {
      intensity: "build",
      holdScale: 1.1,
      preferNeed: "strength",
      maxMinutes: 25,
      reasons,
      headline: "A progressive practice (optional)",
    };
  }

  reasons.push(`Recent average RPE ${avgRpe.toFixed(1)} — keeping a steady load.`);
  return {
    intensity: "steady",
    holdScale: 1,
    preferNeed: "movement",
    maxMinutes: 20,
    reasons,
    headline: "A steady practice for today",
  };
}

export function scaleHoldSeconds(base: number, scale: number): number {
  const n = Math.round(base * scale);
  return Math.min(180, Math.max(15, n));
}

/** Persist last RPE for Trainer/Home without stuffing journal text. */
export function writeLastRpe(rpe: RpeScore) {
  writeJson(KEYS.lastRpe, { rpe, at: new Date().toISOString() });
}

export function readLastRpe(): { rpe: RpeScore; at: string } | null {
  return readJson<{ rpe: RpeScore; at: string } | null>(KEYS.lastRpe, null);
}
