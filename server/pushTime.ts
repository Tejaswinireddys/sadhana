/** Pure timezone helpers for Web Push reminder dispatch. */

export type TimezoneSub = {
  /** Minutes to add to local time to get UTC (Date#getTimezoneOffset). */
  timezoneOffsetMinutes: number;
};

/** Local calendar hour for a subscription given "now". */
export function localHourFor(sub: TimezoneSub, now = new Date()): number {
  const shifted = new Date(now.getTime() - sub.timezoneOffsetMinutes * 60_000);
  return shifted.getUTCHours();
}

export function localDayHourKey(sub: TimezoneSub, now = new Date()): string {
  const shifted = new Date(now.getTime() - sub.timezoneOffsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  const h = String(shifted.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}`;
}
