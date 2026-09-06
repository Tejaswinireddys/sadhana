/**
 * Leaving a finished guided session must never depend on the journal save.
 * Testers could complete a pose, see "Saved to your journal," and still be
 * stuck on /guided because Done / Reflect waited on sessionLogged.
 */

export type CompletionLeaveAction = "home" | "journal";

export function completionLeavePath(
  action: CompletionLeaveAction,
  journal?: { title: string; body: string },
): string {
  if (action === "journal") {
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
