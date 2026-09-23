/**
 * Counted nouns, agreeing with their number.
 *
 * "1 poses queued" survived three rounds of fixes because each place that
 * builds such a string builds it by hand. This is the one place.
 */
export function plural(count: number, singular: string, pluralForm?: string): string {
  return count === 1 ? singular : (pluralForm ?? `${singular}s`);
}

/** "1 pose", "3 poses". */
export function countOf(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${plural(count, singular, pluralForm)}`;
}

/** "1 pose queued", "4 poses queued". */
export function posesQueued(count: number): string {
  return `${countOf(count, "pose")} queued`;
}
