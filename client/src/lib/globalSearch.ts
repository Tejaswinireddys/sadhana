/**
 * Cross-catalog search shared by the sidebar typeahead and `/search`.
 *
 * Pose ranking stays in poseSearch.ts. This module covers breathing, kids,
 * pathways, and affirmations — and the category synonyms that make a query
 * like "breathing" return techniques even when a name is "Ujjayi".
 */
import {
  AFFIRMATIONS,
  BREATHING,
  PATHWAYS,
  type BreathTechnique,
  type Pathway,
} from "@/data/content";
import { KIDS_BREATH, KIDS_POSES, type KidsBreath, type KidsPose } from "@/data/kids";
import { rankedPoses, searchPoses, squash, type PoseSuggestion } from "@/lib/poseSearch";

const BREATH_CATEGORY_QUERIES = new Set([
  "breath",
  "breathing",
  "breathe",
  "pranayama",
  "pranayam",
  "prānāyāma",
]);

const KIDS_CATEGORY_QUERIES = new Set(["kids", "kid", "children", "child", "family"]);

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function isBreathingCategoryQuery(query: string): boolean {
  const q = normalizeQuery(query);
  if (!q) return false;
  if (BREATH_CATEGORY_QUERIES.has(q)) return true;
  const squashed = squash(q);
  return [...BREATH_CATEGORY_QUERIES].some((term) => squash(term) === squashed);
}

export function isKidsCategoryQuery(query: string): boolean {
  const q = normalizeQuery(query);
  if (!q) return false;
  if (KIDS_CATEGORY_QUERIES.has(q)) return true;
  return [...KIDS_CATEGORY_QUERIES].some((term) => squash(term) === squash(q));
}

function hayIncludes(hay: string, q: string, qSquashed: string): boolean {
  const lower = hay.toLowerCase();
  if (lower.includes(q)) return true;
  if (qSquashed.length >= 3 && squash(hay).includes(qSquashed)) return true;
  // "breath" should match "breathing" / "breathe" without requiring the full word.
  if (q.length >= 4 && (lower.includes(`${q}ing`) || lower.includes(`${q}e`))) return true;
  return false;
}

export function matchBreathing(query: string): BreathTechnique[] {
  const q = normalizeQuery(query);
  if (!q) return [];
  if (isBreathingCategoryQuery(q)) return [...BREATHING];
  const qSquashed = squash(q);
  return BREATHING.filter((b) => {
    const hay = [b.name, b.sanskrit, b.tagline, b.description, b.pattern, ...b.benefits].join(" ");
    return hayIncludes(hay, q, qSquashed);
  });
}

export type KidsSearchHit =
  | ({ kind: "pose" } & KidsPose)
  | ({ kind: "breath" } & KidsBreath);

export function matchKids(query: string): KidsSearchHit[] {
  const q = normalizeQuery(query);
  if (!q) return [];
  const qSquashed = squash(q);
  if (isKidsCategoryQuery(q)) {
    return [
      ...KIDS_POSES.map((k) => ({ kind: "pose" as const, ...k })),
      ...KIDS_BREATH.map((k) => ({ kind: "breath" as const, ...k })),
    ];
  }
  const kidsPoses = KIDS_POSES.filter((k) => {
    const hay = [k.title, k.poseName, k.sanskrit ?? "", k.intro, k.story.join(" ")].join(" ");
    return hayIncludes(hay, q, qSquashed);
  }).map((k) => ({ kind: "pose" as const, ...k }));
  const kidsBreath = KIDS_BREATH.filter((k) => {
    const hay = [k.techniqueName, k.description, k.why].join(" ");
    return hayIncludes(hay, q, qSquashed);
  }).map((k) => ({ kind: "breath" as const, ...k }));
  return [...kidsPoses, ...kidsBreath];
}

export function matchPathways(query: string): Pathway[] {
  const q = normalizeQuery(query);
  if (!q) return [];
  const qSquashed = squash(q);
  return PATHWAYS.filter((p) => {
    const hay = [p.name, p.summary, p.target].join(" ");
    return hayIncludes(hay, q, qSquashed);
  });
}

export function matchAffirmations(query: string): string[] {
  const q = normalizeQuery(query);
  if (!q) return [];
  return AFFIRMATIONS.filter((t) => t.toLowerCase().includes(q));
}

export type GlobalSearchResults = {
  poses: ReturnType<typeof rankedPoses>;
  breathing: BreathTechnique[];
  pathways: Pathway[];
  affirmations: string[];
  kids: KidsSearchHit[];
};

export function searchCatalog(query: string): GlobalSearchResults {
  const q = normalizeQuery(query);
  if (!q) {
    return { poses: [], breathing: [], pathways: [], affirmations: [], kids: [] };
  }
  return {
    poses: rankedPoses(q),
    breathing: matchBreathing(q),
    pathways: matchPathways(q),
    affirmations: matchAffirmations(q),
    kids: matchKids(q),
  };
}

export type SidebarSuggestion =
  | { kind: "pose"; pose: PoseSuggestion }
  | { kind: "breathing"; technique: BreathTechnique }
  | { kind: "kids"; hit: KidsSearchHit };

/**
 * Compact typeahead for the shell. Prefers breathing/kids when the query is a
 * category word so "breathing" is not drowned by pose name hits.
 */
export function searchSidebarSuggestions(
  query: string,
  limit = 8,
): { items: SidebarSuggestion[]; total: number } {
  const catalog = searchCatalog(query);
  const posePreview = searchPoses(query, limit);
  const total =
    catalog.poses.length +
    catalog.breathing.length +
    catalog.pathways.length +
    catalog.affirmations.length +
    catalog.kids.length;
  if (!normalizeQuery(query) || total === 0) {
    return { items: [], total: 0 };
  }

  const items: SidebarSuggestion[] = [];
  const preferBreath = isBreathingCategoryQuery(query);
  const preferKids = isKidsCategoryQuery(query);

  const pushBreathing = (n: number) => {
    for (const technique of catalog.breathing.slice(0, n)) {
      if (items.length >= limit) return;
      items.push({ kind: "breathing", technique });
    }
  };
  const pushKids = (n: number) => {
    for (const hit of catalog.kids.slice(0, n)) {
      if (items.length >= limit) return;
      items.push({ kind: "kids", hit });
    }
  };
  const pushPoses = (n: number) => {
    for (const pose of posePreview.items.slice(0, n)) {
      if (items.length >= limit) return;
      items.push({ kind: "pose", pose });
    }
  };

  if (preferBreath) {
    pushBreathing(limit);
    pushPoses(2);
  } else if (preferKids) {
    pushKids(limit);
    pushPoses(2);
  } else {
    pushBreathing(3);
    pushKids(2);
    pushPoses(limit);
  }

  return { items: items.slice(0, limit), total };
}
