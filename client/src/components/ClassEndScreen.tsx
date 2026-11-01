import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, RotateCcw } from "lucide-react";
import type { ClassSummary } from "@shared/classLibrary";
import { Button } from "@/components/ui/button";
import { EffortRating } from "@/components/EffortRating";
import { asanaBySlug } from "@/data/content";
import { CLASS_MIN_COUNTED_SECONDS, NEXT_CLASS_COUNTDOWN_SECONDS, classCompletionLog } from "@/lib/classPlayer";
import { amendLoggedSession, logPracticeSession } from "@/lib/logPracticeSession";
import { formatClassMinutes } from "@/lib/classesApi";

type LogState =
  | { kind: "saving" }
  | { kind: "saved"; sessionId: number | null; journalId: number | null }
  | { kind: "not-counted" }
  | { kind: "failed" };

/**
 * "Class complete": time practised, an effort rating, and the next class with
 * a cancellable 10s countdown.
 *
 * The finished class is logged once, as it ends, through `logPracticeSession`
 * — the session + journal write guided practice uses — so it counts on
 * Progress and Today. The rating then amends that row, like guided practice.
 */
export function ClassEndScreen({ item, next, watchedSeconds, onWatchAgain }: {
  item: ClassSummary;
  next: ClassSummary | null;
  watchedSeconds: number;
  onWatchAgain: () => void;
}) {
  const [, navigate] = useLocation();
  const [log, setLog] = useState<LogState>({ kind: "saving" });
  const [effort, setEffort] = useState<number | null>(null);
  const [effortSaved, setEffortSaved] = useState(false);
  const autoNext = next && !next.locked ? next : null;
  const [remaining, setRemaining] = useState<number | null>(autoNext ? NEXT_CLASS_COUNTDOWN_SECONDS : null);
  const logged = useRef(false);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const entry = classCompletionLog({
    title: item.title, instructorName: item.instructorName, durationMinutes: item.durationMinutes,
    watchedSeconds, chapters: item.chapters ?? [], poseName: (slug) => asanaBySlug(slug)?.english,
  });

  useEffect(() => { heading.current?.focus(); }, []);

  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    if (!entry) { setLog({ kind: "not-counted" }); return; }
    void logPracticeSession(entry).then((result) => {
      setLog(result.ok ? { kind: "saved", sessionId: result.sessionId ?? null, journalId: result.journalId ?? null } : { kind: "failed" });
    });
    // Logged once per finish; `entry` is derived from props that do not change here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (remaining === null || !autoNext) return;
    if (remaining <= 0) { navigate(`/classes/${autoNext.slug}`); return; }
    const timer = setTimeout(() => setRemaining((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(timer);
  }, [remaining, autoNext, navigate]);

  const cancelCountdown = () => setRemaining(null);

  const saveEffort = async () => {
    if (log.kind !== "saved" || effort === null || !entry) return;
    // Effort amends the session row only; the journal entry already reads right.
    await amendLoggedSession({
      sessionId: log.sessionId, journalId: null, postMood: null, rpe: effort,
      journal: { label: entry.label, minutes: entry.minutes, plannedMinutes: entry.plannedMinutes, poseNames: entry.poseNames,
        posesCompleted: entry.poseNames.length, posesSkipped: 0, preMood: null, postMood: null },
    });
    setEffortSaved(true);
  };

  return (
    <div className="space-y-5 rounded-xl border border-card-border bg-card p-6 text-center shadow-soft" data-testid="class-end">
      <CheckCircle2 className="mx-auto h-10 w-10 text-primary" aria-hidden />
      <h2 ref={heading} tabIndex={-1} className="font-serif text-2xl font-semibold outline-none">Class complete</h2>
      <p className="text-muted-foreground" data-testid="class-end-time" role="status">
        {log.kind === "not-counted"
          ? `Less than ${CLASS_MIN_COUNTED_SECONDS / 60} minute practised, so this one isn't added to Progress.`
          : `${formatClassMinutes(entry?.minutes ?? 0)} practised${
            log.kind === "saved" ? " · added to Progress" : log.kind === "failed" ? " · couldn't save to Progress" : ""}.`}
      </p>

      {log.kind === "saved" && (
        <div className="space-y-3" data-testid="class-end-effort">
          <p className="text-sm font-medium">How hard did that feel? <span className="font-normal text-muted-foreground">(1 easy – 10 maximal)</span></p>
          <EffortRating value={effort} onChange={(n) => { setEffort(n); setEffortSaved(false); }} testIdPrefix="class-rpe" />
          <Button type="button" className="min-h-11" disabled={effort === null || effortSaved} onClick={() => void saveEffort()} data-testid="class-rpe-save">
            {effortSaved ? "Effort saved" : "Save effort"}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={() => { cancelCountdown(); onWatchAgain(); }} data-testid="class-end-again">
          <RotateCcw className="mr-1 h-4 w-4" aria-hidden /> Watch again
        </Button>
        {next && (
          <Button asChild className="min-h-11">
            <Link href={next.locked ? "/plus" : `/classes/${next.slug}`} data-testid="class-end-next">
              {next.locked ? `Next: ${next.title} (Plus)` : `Next class: ${next.title}`}
            </Link>
          </Button>
        )}
      </div>

      {autoNext && remaining !== null && (
        <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="class-end-countdown">
          Next class starts in {remaining}s.{" "}
          <button type="button" className="min-h-11 cursor-pointer font-medium text-foreground underline underline-offset-2" onClick={cancelCountdown} data-testid="class-end-cancel">
            Cancel
          </button>
        </p>
      )}
      {autoNext && remaining === null && (
        <p className="text-sm text-muted-foreground" data-testid="class-end-countdown-cancelled">Autoplay cancelled.</p>
      )}
    </div>
  );
}
