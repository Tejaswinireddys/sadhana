/**
 * Preparation that belongs to the session, not a universal block on top.
 *
 * Every program page used to show "Always warm up first — 13 min" — Cat/Cow,
 * Bird Dog, Down Dog, Low Lunge — above a Chair program that promised no
 * floor, a prenatal week, and rest days made of Child's Pose. And the 13
 * minutes were never part of the length the card advertised.
 *
 * The rule now:
 * - A session that already opens with centering or warm-up shapes (arc slots
 *   0–1) keeps its own preparation.
 * - A session with no build or peak work (restorative, rest days) needs none.
 * - Anything else gets a short preparation matched to it, *inside* the queue,
 *   so the card, preview, player and journal all count it.
 *
 * Preparation poses are catalog poses taught by their own reviewed steps and
 * chosen to respect the session's constraints: prenatal sessions use prenatal
 * poses, floor-free sessions stay off the floor, standing sessions start
 * standing.
 */
import type { Asana, DailyPlan, Pathway, PathwayWeek } from "./content";

type PrepPose = { asanaSlug: string; holdSeconds: number; sides?: "each" | "once"; note?: string; preparation?: boolean };

const P = (asanaSlug: string, holdSeconds: number, sides: "each" | "once" = "once"): PrepPose => ({
  asanaSlug,
  holdSeconds,
  sides,
  note: "preparation",
  preparation: true,
});

export const PREPARATION_SETS = {
  /** Seated centre, then the spine through Cat–Cow. */
  floor: [P("sukhasana", 45), P("marjaryasana-bitilasana", 45)],
  /** For sessions that open standing. */
  standing: [P("tadasana", 30), P("urdhva-hastasana", 20)],
  /** Core and arm-balance work: add Bird Dog for the trunk. */
  core: [P("sukhasana", 45), P("marjaryasana-bitilasana", 45), P("chakravakasana", 20, "each")],
  /** Prenatal sessions use prenatal-reviewed shapes only. */
  prenatal: [P("womb-seat", 45), P("prenatal-cat-cow", 45)],
} as const;

export type PreparationKind = keyof typeof PREPARATION_SETS;

type Lookup = (slug: string) => Asana | undefined;

/** Which preparation a queue needs, or null when it has its own / needs none. */
export function preparationKindFor(
  poses: Array<{ asanaSlug: string }>,
  lookup: Lookup,
): PreparationKind | null {
  const asanas = poses.map((p) => lookup(p.asanaSlug)).filter((a): a is Asana => !!a);
  if (!asanas.length) return null;
  if (asanas[0]!.arcSlot <= 1) return null; // opens with its own preparation
  if (!asanas.some((a) => a.arcSlot === 2 || a.arcSlot === 3)) return null; // gentle throughout
  if (asanas.some((a) => a.slug.startsWith("prenatal-"))) return "prenatal";
  if (asanas.some((a) => a.category === "Core")) return "core";
  if (asanas[0]!.category === "Standing") return "standing";
  return "floor";
}

function prepare<T extends { asanaSlug: string }>(poses: T[], lookup: Lookup): T[] {
  const kind = preparationKindFor(poses, lookup);
  if (!kind) return poses;
  const present = new Set(poses.map((p) => p.asanaSlug));
  const prep = PREPARATION_SETS[kind].filter((p) => !present.has(p.asanaSlug) && lookup(p.asanaSlug));
  return [...(prep as unknown as T[]), ...poses];
}

export function withSessionPreparation(pathway: Pathway, lookup: Lookup): Pathway {
  return {
    ...pathway,
    weekPlan: pathway.weekPlan.map((w: PathwayWeek) => ({ ...w, poses: prepare(w.poses, lookup) })),
    dailyPlan: pathway.dailyPlan?.map((d: DailyPlan) => ({ ...d, poses: prepare(d.poses, lookup) })),
  };
}
