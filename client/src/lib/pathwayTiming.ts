/**
 * Shared wall-clock timing for catalog cards, program weeks, daily previews,
 * guided setup, and the live player. Holds-only sums used to advertise
 * "4 min" while the same queue opened as an 8–25 minute narrated session.
 */
import { asanaBySlug, type DailyPlan, type Pathway, type PathwayWeek } from "@/data/content";
import { buildSessionPreflight, type SessionPreflight } from "@/lib/sessionPreflight";
import {
  guidedSessionSeconds,
  guidedTimeLabel,
  SIDE_SWITCH_SECONDS,
  TRANSITION_SECONDS,
  type GuidedTimedPose,
  type InstructionMode,
} from "@/lib/guidedDuration";

export type CatalogPose = {
  asanaSlug?: string;
  slug?: string;
  holdSeconds: number;
  sides?: "each" | "once" | "single";
  note?: string;
};

export function poseSides(pose: CatalogPose): "each" | "once" {
  if (pose.sides === "each") return "each";
  if (pose.sides === "once" || pose.sides === "single") return "once";
  return /each side/i.test(pose.note ?? "") ? "each" : "once";
}

export function catalogPosesToTimed(poses: CatalogPose[]): GuidedTimedPose[] {
  return poses.map((p) => {
    const slug = p.asanaSlug ?? p.slug;
    const asana = slug ? asanaBySlug(slug) : undefined;
    return {
      holdSeconds: p.holdSeconds,
      sides: poseSides(p),
      slug,
      stepCount: asana?.steps.length ?? 0,
    };
  });
}

/** Full wall-clock for `mode`: get-ready, instruction (both sides), holds, switches. */
export function catalogSessionSeconds(
  poses: CatalogPose[],
  mode: InstructionMode = "guided",
): number {
  return guidedSessionSeconds(catalogPosesToTimed(poses), mode);
}

export function catalogSessionMinutes(
  poses: CatalogPose[],
  mode: InstructionMode = "guided",
): number {
  return Math.max(1, Math.round(catalogSessionSeconds(poses, mode) / 60));
}

export function catalogSessionLabel(
  poses: CatalogPose[],
  mode: InstructionMode = "guided",
): string {
  return guidedTimeLabel(catalogSessionSeconds(poses, mode));
}

/** Timer-only: preparation + holds + side switch — no spoken instruction. */
export function timerOnlySessionSeconds(poses: CatalogPose[]): number {
  return catalogSessionSeconds(poses, "timer");
}

export function timerOnlySessionLabel(poses: CatalogPose[]): string {
  return guidedTimeLabel(timerOnlySessionSeconds(poses));
}

export function flowPoses(p: Pathway): CatalogPose[] {
  return p.weekPlan[0]?.poses ?? [];
}

export function flowSessionLabel(p: Pathway): string {
  return catalogSessionLabel(flowPoses(p));
}

export function flowSessionMinutes(p: Pathway): number {
  return catalogSessionMinutes(flowPoses(p));
}

export function weekSessionLabel(week: PathwayWeek): string {
  return catalogSessionLabel(week.poses);
}

export function dailySessionLabel(day: DailyPlan): string {
  return catalogSessionLabel(day.poses);
}

/**
 * The one set of facts every card, preview and the player show for a catalog
 * queue — length for `mode`, level, intensity, props, pose count. Cards used
 * to hardcode "All levels · No props required" beside a Sleep Wind-Down that
 * asks for a bolster and a chair.
 */
export function catalogPreflight(
  poses: CatalogPose[],
  mode: InstructionMode = "guided",
): SessionPreflight {
  return buildSessionPreflight({
    poses: queueCatalogPoses(poses).map((p) => ({
      ...p.asana,
      holdSeconds: p.holdSeconds,
      sides: p.sides,
    })),
    mode,
  });
}

/**
 * The part of a session that prepares the body — the leading centering and
 * warm-up shapes (arc slots 0–1). Programs and flows carry their own, so there
 * is no universal warm-up to bolt on top; this names it and its share of the
 * total so the card can say "includes 2 min of preparation".
 */
export function sessionPreparation(
  poses: CatalogPose[],
  mode: InstructionMode = "guided",
): { poses: CatalogPose[]; names: string[]; seconds: number; label: string } | null {
  const lead: CatalogPose[] = [];
  for (const p of poses) {
    const slug = p.asanaSlug ?? p.slug;
    const asana = slug ? asanaBySlug(slug) : undefined;
    if (!asana || asana.arcSlot > 1) break;
    lead.push(p);
  }
  if (!lead.length) return null;
  const seconds = catalogSessionSeconds(lead, mode);
  const names = lead
    .map((p) => asanaBySlug((p.asanaSlug ?? p.slug)!)?.english)
    .filter((n): n is string => !!n);
  return { poses: lead, names: Array.from(new Set(names)), seconds, label: guidedTimeLabel(seconds) };
}

/** Program-card range from the same week/day math as setup and the player. */
export function pathwaySessionRangeLabel(p: Pathway): string {
  if (p.kind === "flow") return flowSessionLabel(p);
  const buckets =
    p.kind === "daily" && p.dailyPlan?.length
      ? p.dailyPlan.map((day) => catalogSessionMinutes(day.poses))
      : p.weekPlan.map((week) => catalogSessionMinutes(week.poses));
  if (!buckets.length) return p.timePerSession;
  const lo = Math.min(...buckets);
  const hi = Math.max(...buckets);
  const range = lo === hi ? `${lo} min` : `${lo}–${hi} min`;
  return p.sessionsPerWeek > 1 ? `${range}, ${p.sessionsPerWeek}x/week` : range;
}

/** When timer-only is materially shorter, surface both so the card is honest. */
export function catalogDurationCopy(poses: CatalogPose[]): {
  guidedLabel: string;
  timerLabel: string;
  showTimerOnly: boolean;
} {
  const guidedSec = catalogSessionSeconds(poses);
  const timerSec = timerOnlySessionSeconds(poses);
  return {
    guidedLabel: guidedTimeLabel(guidedSec),
    timerLabel: guidedTimeLabel(timerSec),
    showTimerOnly: Math.abs(guidedSec - timerSec) >= 90,
  };
}

export function queueCatalogPoses(poses: CatalogPose[]) {
  return poses
    .map((pose) => {
      const slug = pose.asanaSlug ?? pose.slug;
      const asana = slug ? asanaBySlug(slug) : undefined;
      if (!asana) return null;
      return { asana, holdSeconds: pose.holdSeconds, sides: poseSides(pose) };
    })
    .filter(
      (x): x is { asana: NonNullable<ReturnType<typeof asanaBySlug>>; holdSeconds: number; sides: "once" | "each" } =>
        x != null,
    );
}
