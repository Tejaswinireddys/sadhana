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
}: {
  hasCompletedSessions: boolean;
  displayName?: string | null;
}): string {
  if (!hasCompletedSessions) return "Start your practice";
  if (isDisplayableName(displayName)) return `Welcome back, ${displayName.trim()}`;
  return "Welcome back";
}
