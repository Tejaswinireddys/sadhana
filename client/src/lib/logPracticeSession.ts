import { apiRequest, queryClient } from "@/lib/queryClient";
import { todayISO, type Stats } from "@/lib/sadhana";
import { detectMilestones } from "@/lib/milestones";
import { track } from "@/lib/analytics";
import { recordOutcome, writeLastRpe, type RpeScore } from "@/lib/adaptiveRecovery";
import { bumpCorporateAggregate } from "@/lib/corporate";
import type { Milestone } from "@shared/schema";
import type { Mood } from "@/data/content";

export type LogSessionInput = {
  /** Minutes ACTUALLY practiced. The one number that feeds stats and streaks. */
  minutes: number;
  /** Minutes the session was designed to take. Recorded, never summed. */
  plannedMinutes?: number | null;
  poseNames: string[];
  /** How many poses were held to completion vs. skipped past. */
  posesCompleted?: number;
  posesSkipped?: number;
  /** A name only — no duration baked in. See SessionMeta.label. */
  label: string;
  pathwaySlug: string | null;
  preMood: Mood | null;
  postMood: Mood | null;
  /** Rate of perceived exertion 1–10 */
  rpe?: number | null;
  kind?: "asana" | "breathing";
  journalTags?: string[];
  journalBody?: string;
};

/**
 * Build the journal title + body for a completed practice.
 *
 * Pure and exported so the "two different numbers for one session" bug stays
 * fixed: every minute figure the user can see comes from `minutes` (elapsed).
 */
export function buildJournalEntry(args: {
  label: string;
  minutes: number;
  plannedMinutes?: number | null;
  poseNames: string[];
  posesCompleted: number;
  posesSkipped: number;
  preMood: Mood | null;
  postMood: Mood | null;
}): { title: string; body: string } {
  const { label, minutes, plannedMinutes, poseNames, posesCompleted, posesSkipped } = args;
  const moodLine =
    args.preMood && args.postMood
      ? `Mood: ${args.preMood} → ${args.postMood}.`
      : args.preMood
        ? `Mood before: ${args.preMood}.`
        : args.postMood
          ? `Mood after: ${args.postMood}.`
          : "";
  const poseLine =
    posesSkipped > 0
      ? `${posesCompleted} of ${poseNames.length} poses (${posesSkipped} skipped)`
      : poseNames.join(", ");
  const plannedLine =
    plannedMinutes && plannedMinutes !== minutes ? ` (planned ${plannedMinutes} min)` : "";
  return {
    title: `${label} · ${minutes} min`,
    body: `${label} — practiced ${poseLine}. ${minutes} min${plannedLine}. ${moodLine}`.trim(),
  };
}

export type LogSessionResult = {
  ok: boolean;
  error?: string;
  milestone?: { title: string; message: string };
};

/** Persist a completed practice: session row, journal entry, milestone check. */
export async function logPracticeSession(input: LogSessionInput): Promise<LogSessionResult> {
  const {
    minutes,
    plannedMinutes = null,
    poseNames,
    posesCompleted,
    posesSkipped,
    label,
    pathwaySlug,
    preMood,
    postMood,
    rpe = null,
    kind = "asana",
    journalTags = [label],
    journalBody,
  } = input;

  const completed = posesCompleted ?? poseNames.length;
  const skipped = posesSkipped ?? 0;

  try {
    await apiRequest("POST", "/api/sessions", {
      date: todayISO(),
      durationMinutes: Math.max(1, minutes),
      plannedMinutes: plannedMinutes ?? null,
      posesCompleted: completed,
      posesSkipped: skipped,
      asanas: JSON.stringify(poseNames),
      pathwaySlug: pathwaySlug ?? null,
      notes: null,
      kind,
      preMood: preMood ?? null,
      postMood: postMood ?? null,
      rpe: rpe ?? null,
    });
    queryClient.invalidateQueries({ queryKey: ["/api/sessions/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    track("practice_complete", { minutes: Math.max(1, minutes), kind });
    const totalPoses = Math.max(1, completed + skipped);
    const skipRate = skipped / totalPoses;
    if (rpe != null && rpe >= 1 && rpe <= 10) {
      writeLastRpe(rpe as RpeScore);
      recordOutcome({
        at: new Date().toISOString(),
        rpe: rpe as RpeScore,
        skipRate,
        minutes: Math.max(1, minutes),
        pathwaySlug,
      });
    }
    bumpCorporateAggregate(Math.max(1, minutes));
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Could not save your session." };
  }

  try {
    const entry = buildJournalEntry({
      label,
      minutes,
      plannedMinutes,
      poseNames,
      posesCompleted: completed,
      posesSkipped: skipped,
      preMood,
      postMood,
    });
    await apiRequest("POST", "/api/journal", {
      date: todayISO(),
      title: entry.title,
      body: journalBody ?? entry.body,
      mood: postMood ?? preMood ?? null,
      tags: JSON.stringify(journalTags),
    });
    queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
  } catch {
    // Session is already saved; journal failure is non-fatal.
  }

  try {
    const [statsRes, msRes] = await Promise.all([
      apiRequest("GET", `/api/sessions/stats/${todayISO()}`),
      apiRequest("GET", "/api/milestones"),
    ]);
    const stats = (await statsRes.json()) as Stats;
    const celebratedRows = (await msRes.json()) as Milestone[];
    const celebrated = new Set(celebratedRows.map((m) => m.kind));
    const hits = detectMilestones(stats.currentStreak, stats.totalSessions, celebrated);
    if (hits.length > 0) {
      const hit = hits[hits.length - 1];
      for (const h of hits) {
        await apiRequest("POST", "/api/milestones", { kind: h.kind }).catch(() => {});
      }
      queryClient.invalidateQueries({ queryKey: ["/api/milestones"] });
      return { ok: true, milestone: { title: hit.title, message: hit.message } };
    }
  } catch {
    /* ignore milestone errors */
  }

  return { ok: true };
}
