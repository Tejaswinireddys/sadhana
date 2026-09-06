/**
 * Shared wall-clock timing for catalog cards, program weeks, daily previews,
 * guided setup, and the live player. Holds-only sums used to advertise
 * "4 min" while the same queue opened as an 8–25 minute narrated session.
 */
import { asanaBySlug, type DailyPlan, type Pathway, type PathwayWeek } from "@/data/content";
import {
  guidedSessionSeconds,
  guidedTimeLabel,
  SIDE_SWITCH_SECONDS,
  TRANSITION_SECONDS,
  type GuidedTimedPose,
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

/** Full guided wall-clock: get-ready, narration (both sides), holds, switches. */
export function catalogSessionSeconds(poses: CatalogPose[]): number {
  return guidedSessionSeconds(catalogPosesToTimed(poses));
}

export function catalogSessionMinutes(poses: CatalogPose[]): number {
  return Math.max(1, Math.round(catalogSessionSeconds(poses) / 60));
}

export function catalogSessionLabel(poses: CatalogPose[]): string {
  return guidedTimeLabel(catalogSessionSeconds(poses));
}

/** Timer-only: preparation + holds + side switch — no spoken instruction. */
export function timerOnlySessionSeconds(poses: CatalogPose[]): number {
  return poses.reduce((sum, p) => {
    const hold = Math.max(0, p.holdSeconds);
    const each = poseSides(p) === "each";
    const sides = each ? 2 : 1;
    return sum + TRANSITION_SECONDS + hold * sides + (each ? SIDE_SWITCH_SECONDS : 0);
  }, 0);
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
