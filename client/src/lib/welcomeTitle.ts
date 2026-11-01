/**
 * Home welcome-header title.
 *
 * The greeting keys off whether the practitioner has actually returned — i.e.
 * has at least one completed session — never off whether a name or profile
 * happens to be stored. So a first-ever visitor is invited to start, and a
 * returning one is welcomed back, by name only when we have a real name.
 */

/**
 * Whether a value is safe to show in the name slot.
 *
 * Guards against a number (an age, an id) landing where a name belongs — we'd
 * rather greet with no name than with a digit. This is the fix for the header
 * rendering "Welcome back, 34".
 */
export function isDisplayableName(name: string | null | undefined): name is string {
  if (name == null) return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (/^\d+$/.test(trimmed)) return false; // e.g. an age, never a name
  return true;
}

export function welcomeHeaderTitle({
  hasCompletedSessions,
  displayName,
  loading = false,
}: {
  hasCompletedSessions: boolean;
  displayName?: string | null;
  /**
   * True while saved practice is still being read. "Start your practice" is a
   * statement about someone with no history; showing it to a returning
   * practitioner for half a second, before their name appears, tells them the
   * app has lost their practice.
   */
  loading?: boolean;
}): string {
  if (loading) return "Today";
  if (!hasCompletedSessions) return "Start your practice";
  if (isDisplayableName(displayName)) return `Welcome back, ${displayName.trim()}`;
  return "Welcome back";
}

/**
 * The line under the Today title. Only says things that are true of this
 * visitor: "nothing is saved anywhere but this browser" describes a guest,
 * and was also shown to signed-in accounts whose practice syncs to the server.
 */
export function welcomeHeaderSubtitle({
  loading,
  practicedToday,
  hasCompletedSessions,
  hour,
  reminderHour,
  signedIn,
}: {
  loading: boolean;
  practicedToday: boolean;
  hasCompletedSessions: boolean;
  /** Local hour now (0–23). */
  hour: number;
  reminderHour: number;
  signedIn: boolean;
}): string {
  if (loading) return "Reading your saved practice…";
  if (practicedToday) return "You've already practised today. What follows is optional.";
  if (hasCompletedSessions) {
    return hour >= reminderHour
      ? "Evening — a shorter, quieter practice is below."
      : "Your practice for today is below, with three other options.";
  }
  return signedIn
    ? "Your first practice is below. It's saved to your account, so it's there on any device you sign in on."
    : "Your first practice is below. Nothing is saved anywhere but this browser until you say so.";
}
