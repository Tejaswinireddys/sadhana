import { apiRequest, queryClient } from "@/lib/queryClient";
import { todayISO, type Stats } from "@/lib/sadhana";
import { detectMilestones } from "@/lib/milestones";
import { track } from "@/lib/analytics";
import { captureProduct } from "@/lib/productAnalytics";
import { recordOutcome, writeLastRpe, type RpeScore } from "@/lib/adaptiveRecovery";
import { bumpCorporateAggregate } from "@/lib/corporate";
import {
  broadcastPracticeDataChanged,
} from "@/lib/practiceDataSync";
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
  /** Estimated breaths from hold time (guided sessions). */
  breathCount?: number | null;
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
  breathCount?: number | null;
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
  const breathLine =
    args.breathCount != null && args.breathCount > 0
      ? ` ~${args.breathCount} breath${args.breathCount === 1 ? "" : "s"}.`
      : "";
  return {
    title: `${label} · ${minutes} min`,
    body: `${label} — practiced ${poseLine}. ${minutes} min${plannedLine}.${breathLine} ${moodLine}`.trim(),
  };
}

export type LogSessionResult = {
  ok: boolean;
  error?: string;
  /** Journal row created for this session — Reflect should edit this id. */
  journalId?: number;
  /** Session row created — a late mood or effort rating amends this id. */
  sessionId?: number;
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
    breathCount = null,
    journalTags = [label],
    journalBody,
  } = input;

  const completed = posesCompleted ?? poseNames.length;
  const skipped = posesSkipped ?? 0;

  let sessionId: number | undefined;
  try {
    const sessionRes = await apiRequest("POST", "/api/sessions", {
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
    try {
      const created = (await sessionRes.json()) as { id?: number };
      if (typeof created?.id === "number") sessionId = created.id;
    } catch {
      /* response body optional */
    }
    queryClient.invalidateQueries({ queryKey: ["/api/sessions/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    broadcastPracticeDataChanged("session");
    track("practice_complete", { minutes: Math.max(1, minutes), kind });
    void captureProduct("session_completed", {
      actual_minutes: Math.max(1, minutes),
      poses_completed: completed,
      poses_skipped: skipped,
    });
    const totalPoses = Math.max(1, completed + skipped);
    const skipRate = skipped / totalPoses;
    const savedRpe = rpe != null && rpe >= 1 && rpe <= 10 ? (rpe as RpeScore) : null;
    if (savedRpe != null) writeLastRpe(savedRpe);
    recordOutcome({
      at: new Date().toISOString(),
      rpe: savedRpe ?? undefined,
      skipRate,
      minutes: Math.max(1, minutes),
      pathwaySlug,
    });
    bumpCorporateAggregate(Math.max(1, minutes));
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Could not save your session." };
  }

  let journalId: number | undefined;
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
      breathCount,
    });
    const journalRes = await apiRequest("POST", "/api/journal", {
      date: todayISO(),
      title: entry.title,
      body: journalBody ?? entry.body,
      mood: postMood ?? preMood ?? null,
      tags: JSON.stringify(journalTags),
    });
    try {
      const created = (await journalRes.json()) as { id?: number };
      if (typeof created?.id === "number") journalId = created.id;
    } catch {
      /* response body optional */
    }
    queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
    broadcastPracticeDataChanged("journal");
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
      return {
        ok: true,
        journalId,
        sessionId,
        milestone: { title: hit.title, message: hit.message },
      };
    }
  } catch {
    /* ignore milestone errors */
  }

  return { ok: true, journalId, sessionId };
}

/**
 * A mood or effort rating chosen *after* the practice was saved.
 *
 * The completion screen writes the session the moment the practice ends, so
 * everything the practitioner adds on that screen afterwards has to amend what
 * is already there. Logging again would count the practice twice; doing
 * nothing — which is what used to happen — quietly threw the answer away.
 */
export async function amendLoggedSession(input: {
  sessionId?: number | null;
  journalId?: number | null;
  postMood: Mood | null;
  rpe?: number | null;
  /** Rebuilds the journal body so the entry reads as one coherent note. */
  journal: Parameters<typeof buildJournalEntry>[0];
}): Promise<{ ok: boolean }> {
  const { sessionId, journalId, postMood, rpe = null } = input;
  let ok = true;

  if (sessionId != null) {
    try {
      await apiRequest("PATCH", `/api/sessions/${sessionId}`, {
        ...(postMood != null ? { postMood } : {}),
        ...(rpe != null ? { rpe } : {}),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions/stats"] });
      broadcastPracticeDataChanged("session");
    } catch {
      ok = false;
    }
  }

  if (journalId != null) {
    try {
      const entry = buildJournalEntry(input.journal);
      await apiRequest("PATCH", `/api/journal/${journalId}`, {
        title: entry.title,
        body: entry.body,
        mood: postMood ?? input.journal.preMood ?? null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      broadcastPracticeDataChanged("journal");
    } catch {
      ok = false;
    }
  }

  const savedRpe = rpe != null && rpe >= 1 && rpe <= 10 ? (rpe as RpeScore) : null;
  if (savedRpe != null) writeLastRpe(savedRpe);
  return { ok };
}
