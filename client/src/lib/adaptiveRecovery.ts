/**
 * Adaptive difficulty / recovery from RPE, skips, and readiness.
 * Conservative by default — never increases load after high effort or pain flags.
 */
import { ASANAS, asanaBySlug } from "@/data/content";
import { isLowEnergyMood } from "./moods";
import { KEYS, readJson, writeJson } from "./localPrefs";

export type RpeScore = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type SessionOutcome = {
  at: string;
  /** Present when the practitioner saved an RPE. Older / skipped-dialog logs omit it. */
  rpe?: RpeScore | null;
  /** 0–1 fraction of poses skipped */
  skipRate: number;
  minutes: number;
  pathwaySlug?: string | null;
  sore?: boolean;
};

export type HistorySession = {
  date: string;
  posesCompleted?: number | null;
  posesSkipped?: number | null;
  asanas?: string | null;
  preMood?: string | null;
  postMood?: string | null;
};

export type HistoryJournal = {
  date: string;
  mood?: string | null;
};

export type PracticeHistory = {
  sessions?: HistorySession[];
  journal?: HistoryJournal[];
};

export type AdaptiveAdvice = {
  intensity: "recover" | "easy" | "steady" | "build";
  holdScale: number;
  preferNeed: string;
  maxMinutes: number;
  reasons: string[];
  /** Human-readable plan label for Today */
  headline: string;
  soreParts?: string[];
  energy?: string;
};

const OUTCOMES_KEY = "sadhana.adaptive.outcomes";
const MAX_OUTCOMES = 30;
const MAX_REASONS = 4;

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

function parseDay(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function inLastDays(iso: string, now: Date, days: number): boolean {
  const d = parseDay(iso);
  if (!d) return false;
  const n = Math.floor((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000);
  return n >= 0 && n < days;
}

function parseAsanaNames(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function resolveAsana(nameOrSlug: string) {
  const bySlug = asanaBySlug(nameOrSlug);
  if (bySlug) return bySlug;
  const q = nameOrSlug.trim().toLowerCase();
  return ASANAS.find(
    (a) => a.english.toLowerCase() === q || a.sanskrit.toLowerCase() === q || a.slug === nameOrSlug,
  );
}

function isHipOpener(nameOrSlug: string): boolean {
  const a = resolveAsana(nameOrSlug);
  if (!a) return /\bhips?\b/i.test(nameOrSlug);
  if (a.category === "Hip Openers") return true;
  return a.stretchZones.some((z) => /\bhips?\b/i.test(z.region) && z.primary);
}

function capReasons(reasons: string[]): string[] {
  return reasons.slice(0, MAX_REASONS);
}

const EMPTY_ADVICE: AdaptiveAdvice = {
  intensity: "steady",
  holdScale: 1,
  preferNeed: "movement",
  maxMinutes: 20,
  reasons: ["No recent effort data — starting with a steady, moderate plan."],
  headline: "A steady practice for today",
};

/** Derive next-session advice from recent outcomes and logged practice/journal. */
export function adviseNextSession(
  outcomes = readOutcomes(),
  history?: PracticeHistory,
  now = new Date(),
): AdaptiveAdvice {
  const recent = outcomes.slice(0, 5);
  const sessions = history?.sessions ?? [];
  const journal = history?.journal ?? [];
  const weekSessions = sessions.filter((s) => inLastDays(s.date, now, 7));
  const weekJournal = journal.filter((j) => inLastDays(j.date, now, 7));
  const hasHistory = sessions.length > 0 || journal.length > 0;

  if (recent.length === 0 && !hasHistory) {
    return EMPTY_ADVICE;
  }

  const reasons: string[] = [];
  const hipSkipSessions = weekSessions.filter((s) => {
    if ((s.posesSkipped ?? 0) <= 0) return false;
    return parseAsanaNames(s.asanas).some(isHipOpener);
  }).length;

  const skipRates = weekSessions.map((s) => {
    const completed = s.posesCompleted ?? 0;
    const skipped = s.posesSkipped ?? 0;
    const total = completed + skipped;
    return total > 0 ? skipped / total : 0;
  });
  const avgSessionSkip =
    skipRates.length > 0 ? skipRates.reduce((a, b) => a + b, 0) / skipRates.length : 0;

  const tiredNotes = [
    ...weekJournal.map((j) => j.mood),
    ...weekSessions.flatMap((s) => [s.postMood, s.preMood]),
  ].filter((m) => isLowEnergyMood(m)).length;

  if (sessions.length > 0) {
    reasons.push(
      sessions.length === 1
        ? "You've logged a session recently — building on that, not starting from scratch."
        : `You've logged ${sessions.length} sessions recently — building on that, not starting from scratch.`,
    );
  }

  let soreParts: string[] | undefined;
  if (hipSkipSessions >= 2) {
    reasons.push(
      hipSkipSessions === 2
        ? "You skipped hip openers twice this week, so today goes gentler there."
        : `You skipped hip openers ${hipSkipSessions} times this week, so today goes gentler there.`,
    );
    soreParts = ["Hips"];
  }

  if (tiredNotes > 0) {
    reasons.push(
      tiredNotes === 1
        ? "A recent journal note was tired or stressed — keeping this calmer and shorter."
        : "Recent journal notes were tired or stressed — keeping this calmer and shorter.",
    );
  }

  const rpeValues = recent
    .map((o) => o.rpe)
    .filter((r): r is RpeScore => r != null && r >= 1 && r <= 10);
  const avgRpe = rpeValues.length > 0 ? rpeValues.reduce((s, n) => s + n, 0) / rpeValues.length : null;
  const avgOutcomeSkip =
    recent.length > 0 ? recent.reduce((s, o) => s + o.skipRate, 0) / recent.length : 0;
  const avgSkip = recent.length > 0 ? avgOutcomeSkip : avgSessionSkip;

  const last = recent[0];
  const lastRpe = last?.rpe;

  const withHistory = (advice: AdaptiveAdvice): AdaptiveAdvice => ({
    ...advice,
    reasons: capReasons([...reasons, ...advice.reasons.filter((r) => !reasons.includes(r))]),
    soreParts: soreParts ?? advice.soreParts,
    energy: tiredNotes > 0 ? "low" : advice.energy,
  });

  if (last?.sore || (lastRpe != null && lastRpe >= 9)) {
    reasons.push(
      last?.sore
        ? "You marked soreness last time — choosing recovery."
        : `Last effort was RPE ${lastRpe}/10 — choosing recovery.`,
    );
    return {
      intensity: "recover",
      holdScale: 0.7,
      preferNeed: "calm",
      maxMinutes: 12,
      reasons: capReasons(reasons),
      headline: "A gentle recovery session",
      soreParts,
      energy: "low",
    };
  }

  if ((avgRpe != null && avgRpe >= 7.5) || avgSkip >= 0.35) {
    if (avgSkip >= 0.35 && !reasons.some((r) => /skipped/i.test(r))) {
      reasons.push("Several poses were skipped recently — easing intensity.");
    } else if (avgRpe != null && avgRpe >= 7.5) {
      reasons.push(`Average recent RPE is ${avgRpe.toFixed(1)} — easing intensity.`);
    }
    return {
      intensity: "easy",
      holdScale: 0.85,
      preferNeed: "calm",
      maxMinutes: 15,
      reasons: capReasons(reasons),
      headline: "An easier practice to rebuild momentum",
      soreParts,
      energy: tiredNotes > 0 ? "low" : undefined,
    };
  }

  if (avgRpe != null && avgRpe <= 4 && avgSkip < 0.1 && rpeValues.length >= 3) {
    return withHistory({
      intensity: "build",
      holdScale: 1.1,
      preferNeed: "strength",
      maxMinutes: 25,
      reasons: ["Recent sessions felt manageable — a slight build is available (you can override)."],
      headline: "A progressive practice (optional)",
    });
  }

  if (recent.length === 0) {
    if (tiredNotes > 0) {
      return {
        intensity: "easy",
        holdScale: 0.85,
        preferNeed: "calm",
        maxMinutes: 15,
        reasons: capReasons(reasons),
        headline: "A calmer practice for how you've been feeling",
        soreParts,
        energy: "low",
      };
    }
    if (hipSkipSessions >= 2) {
      return {
        intensity: "easy",
        holdScale: 0.9,
        preferNeed: "movement",
        maxMinutes: 20,
        reasons: capReasons(reasons),
        headline: "A gentler practice for your hips",
        soreParts,
      };
    }
    return {
      intensity: "steady",
      holdScale: 1,
      preferNeed: "movement",
      maxMinutes: 20,
      reasons: capReasons(reasons),
      headline: "A practice shaped by how you've been practicing",
      soreParts,
    };
  }

  if (avgRpe != null) {
    reasons.push(`Recent average RPE ${avgRpe.toFixed(1)} — keeping a steady load.`);
  } else if (reasons.length === 0) {
    reasons.push("Keeping a steady load from your recent practice.");
  }

  return {
    intensity: "steady",
    holdScale: 1,
    preferNeed: "movement",
    maxMinutes: 20,
    reasons: capReasons(reasons),
    headline: "A steady practice for today",
    soreParts,
    energy: tiredNotes > 0 ? "low" : undefined,
  };
}

export function scaleHoldSeconds(base: number, scale: number): number {
  const n = Math.round(base * scale);
  // Restorative holds may already be above 180s; don't clip the class shorter
  // than the composer just built.
  return Math.min(300, Math.max(15, n));
}

/** Persist last RPE for Trainer/Home without stuffing journal text. */
export function writeLastRpe(rpe: RpeScore) {
  writeJson(KEYS.lastRpe, { rpe, at: new Date().toISOString() });
}

export function readLastRpe(): { rpe: RpeScore; at: string } | null {
  return readJson<{ rpe: RpeScore; at: string } | null>(KEYS.lastRpe, null);
}
