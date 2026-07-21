// Where each asana appears in real practice — so detail pages can invite
// users into a session, not leave them staring at a catalog card.
import { PATHWAYS, WARMUP } from "./content";
import { QUICK_SESSIONS } from "./quickSessions";
import { PROFILES } from "./profiles";

export type AsanaUsageHit =
  | { kind: "mood"; id: string; label: string; time: string }
  | { kind: "flow"; slug: string; name: string; minutes: number }
  | { kind: "profile"; id: string; name: string }
  | { kind: "warmup"; label: string };

export function usagesForAsana(slug: string): AsanaUsageHit[] {
  const hits: AsanaUsageHit[] = [];

  if (WARMUP.steps.some((s) => s.asanaSlug === slug)) {
    hits.push({ kind: "warmup", label: WARMUP.title });
  }

  for (const q of QUICK_SESSIONS) {
    if (q.poses.some((p) => p.slug === slug)) {
      hits.push({ kind: "mood", id: q.id, label: q.label, time: q.time });
    }
  }

  for (const p of PATHWAYS) {
    if (p.kind !== "flow") continue;
    const poses = p.weekPlan?.[0]?.poses ?? [];
    if (poses.some((x) => x.asanaSlug === slug)) {
      hits.push({
        kind: "flow",
        slug: p.slug,
        name: p.name,
        minutes: p.minutesPerSession ?? 10,
      });
    }
  }

  for (const profile of PROFILES) {
    if (profile.recommendedAsanas.includes(slug)) {
      hits.push({ kind: "profile", id: profile.id, name: profile.name });
    }
  }

  return hits;
}
