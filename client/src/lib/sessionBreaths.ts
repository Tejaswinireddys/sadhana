/**
 * Estimate breaths practiced from hold time.
 * Defaults to a calm ~6s cycle (inhale+exhale) when no technique is linked.
 */
import { breathBySlug } from "@/data/content";

/** Default calm ujjayi-like cycle when no breathSlug is on the session. */
export const DEFAULT_BREATH_CYCLE_SECONDS = 6;

/** Sum of inhale/exhale/hold phases for a named technique, or the default. */
export function breathCycleSeconds(breathSlug?: string | null): number {
  if (!breathSlug) return DEFAULT_BREATH_CYCLE_SECONDS;
  const tech = breathBySlug(breathSlug);
  if (!tech?.phases?.length) return DEFAULT_BREATH_CYCLE_SECONDS;
  const sum = tech.phases.reduce((s, p) => s + (Number(p.seconds) || 0), 0);
  return sum > 0 ? sum : DEFAULT_BREATH_CYCLE_SECONDS;
}

/** Whole breaths completed during accumulated hold seconds (min 0). */
export function estimateBreathCount(
  holdSeconds: number,
  breathSlug?: string | null,
): number {
  if (!isFinite(holdSeconds) || holdSeconds <= 0) return 0;
  const cycle = breathCycleSeconds(breathSlug);
  return Math.max(0, Math.floor(holdSeconds / cycle));
}
