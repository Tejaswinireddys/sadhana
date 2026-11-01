/**
 * Leaving a finished guided session must never depend on the journal save.
 * Testers could complete a pose, see "Saved to your journal," and still be
 * stuck on /guided because Done / Reflect waited on sessionLogged.
 */

export type CompletionLeaveAction = "home" | "journal";

export function completionLeavePath(
  action: CompletionLeaveAction,
  journal?: { title: string; body: string; editId?: number | null },
): string {
  if (action === "journal") {
    // Prefer editing the auto-saved session entry so Reflect does not create a duplicate.
    if (journal?.editId != null && Number.isFinite(journal.editId)) {
      return `/journal?edit=${journal.editId}`;
    }
    const q = new URLSearchParams({ new: "1" });
    if (journal?.title) q.set("title", journal.title);
    if (journal?.body) q.set("body", journal.body);
    return `/journal?${q.toString()}`;
  }
  return "/";
}

/**
 * Completion CTAs always leave. Saving is best-effort and must not gate
 * navigation — including when an auto-save is still in flight.
 */
export function canLeaveCompletion(): boolean {
  return true;
}

export function shouldFireBackgroundSave(opts: {
  credited: boolean;
  sessionLogged: boolean;
  saving: boolean;
}): boolean {
  return opts.credited && !opts.sessionLogged && !opts.saving;
}

export type ReflectionAction = "save" | "queue" | "amend" | "skip";

/**
 * What to do with a mood or effort rating given on the completion screen.
 *
 * The practice is saved ~1.2s after it ends, and that save (session, journal,
 * then stats and milestones) takes a few round trips. A rating confirmed in
 * between used to call the save again, hit its "already saving" guard, and
 * vanish. It is now queued and applied as an amendment when the save lands.
 *
 * - `save`: nothing saved or in flight yet — save the practice with it.
 * - `queue`: a save is in flight — hold it, amend once that save finishes.
 * - `amend`: the practice is saved — amend the saved rows.
 * - `skip`: the practice did not count, so there is nothing to amend.
 */
export function reflectionAction(opts: { sessionLogged: boolean; saveInFlight: boolean; counts: boolean }): ReflectionAction {
  if (opts.sessionLogged) return opts.counts ? "amend" : "skip";
  return opts.saveInFlight ? "queue" : "save";
}
