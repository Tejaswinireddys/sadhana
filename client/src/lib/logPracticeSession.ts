import { apiRequest, queryClient } from "@/lib/queryClient";
import { todayISO, type Stats } from "@/lib/sadhana";
import { detectMilestones } from "@/lib/milestones";
import type { Milestone } from "@shared/schema";
import type { Mood } from "@/data/content";

export type LogSessionInput = {
  minutes: number;
  poseNames: string[];
  label: string;
  pathwaySlug: string | null;
  preMood: Mood | null;
  postMood: Mood | null;
  kind?: "asana" | "breathing";
  journalTags?: string[];
  journalBody?: string;
};

export type LogSessionResult = {
  ok: boolean;
  error?: string;
  milestone?: { title: string; message: string };
};

/** Persist a completed practice: session row, journal entry, milestone check. */
export async function logPracticeSession(input: LogSessionInput): Promise<LogSessionResult> {
  const {
    minutes,
    poseNames,
    label,
    pathwaySlug,
    preMood,
    postMood,
    kind = "asana",
    journalTags = [label],
    journalBody,
  } = input;

  try {
    await apiRequest("POST", "/api/sessions", {
      date: todayISO(),
      durationMinutes: Math.max(1, minutes),
      asanas: JSON.stringify(poseNames),
      pathwaySlug: pathwaySlug ?? null,
      notes: null,
      kind,
      preMood: preMood ?? null,
      postMood: postMood ?? null,
    });
    queryClient.invalidateQueries({ queryKey: ["/api/sessions/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Could not save your session." };
  }

  try {
    const moodLine =
      preMood && postMood
        ? `Mood: ${preMood} → ${postMood}.`
        : preMood
          ? `Mood before: ${preMood}.`
          : postMood
            ? `Mood after: ${postMood}.`
            : "";
    const body =
      journalBody ??
      `${label} — practiced ${poseNames.join(", ")}. ${minutes} min. ${moodLine}`.trim();
    await apiRequest("POST", "/api/journal", {
      date: todayISO(),
      title: label,
      body,
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
