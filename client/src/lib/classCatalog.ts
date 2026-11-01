/**
 * Facets for the classes catalog.
 *
 * Pathways have no authored style, level, or focus field. These are read off
 * the same data the cards already show: section/kind for style, the first
 * session's poses for level and focus, and catalogSessionMinutes for duration.
 * Nothing here is a second taxonomy written beside the catalog.
 *
 * Plus badges follow the explicit catalog access flag.
 */
import { asanaBySlug, PATHWAYS, type Category, type Pathway } from "@/data/content";
import {
  catalogPreflight,
  catalogSessionMinutes,
  flowPoses,
  type CatalogPose,
} from "@/lib/pathwayTiming";

export const CLASS_STYLES = ["Flow", "Salutation", "Program"] as const;
export type ClassStyle = (typeof CLASS_STYLES)[number];

export const CLASS_LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
export type ClassLevel = (typeof CLASS_LEVELS)[number];

export const DURATION_BUCKETS = [
  { id: "under-15", label: "Under 15 min" },
  { id: "15-30", label: "15–30 min" },
  { id: "30-plus", label: "30 min or more" },
] as const;
export type DurationBucketId = (typeof DURATION_BUCKETS)[number]["id"];

export const CLASS_FOCUSES = [
  "Hips",
  "Backbends",
  "Forward bends",
  "Splits & backbends",
  "Morning",
  "Sleep",
  "Standing",
  "Seated",
  "Core",
  "Rest",
  "Inversions",
] as const;
export type ClassFocus = (typeof CLASS_FOCUSES)[number];

const FOCUS_FROM_PLAN: Record<
  NonNullable<Pathway["dailyPlan"]>[number]["focus"],
  ClassFocus | null
> = {
  "front-splits": "Hips",
  hips: "Hips",
  backbend: "Backbends",
  both: "Splits & backbends",
  morning: "Morning",
  sleep: "Sleep",
  general: null,
};

const FOCUS_FROM_CATEGORY: Record<Category, ClassFocus> = {
  "Hip Openers": "Hips",
  Backbends: "Backbends",
  "Forward Bends": "Forward bends",
  Standing: "Standing",
  Seated: "Seated",
  Core: "Core",
  "Supine/Prone": "Rest",
  Restorative: "Rest",
  Inversions: "Inversions",
};

export type ClassListing = {
  pathway: Pathway;
  style: ClassStyle;
  level: ClassLevel;
  /** Shortest real session in the pathway, from catalogSessionMinutes. */
  minutes: number;
  duration: DurationBucketId;
  focus: ClassFocus;
  plus: boolean;
  isPlus: boolean;
};

export type ClassFilters = {
  query?: string;
  style?: ClassStyle | "all";
  level?: ClassLevel | "all";
  duration?: DurationBucketId | "all";
  focus?: ClassFocus | "all";
};

/** Classes share the access flag of their underlying program. */
export function isPlusClass(p: Pathway): boolean {
  return p.isPlus;
}

export function classStyle(p: Pathway): ClassStyle {
  if (p.kind === "flow" && p.section === "salutation-goddess") return "Salutation";
  if (p.kind === "flow") return "Flow";
  return "Program";
}

function sessionQueues(p: Pathway): CatalogPose[][] {
  if (p.kind === "flow") return [flowPoses(p)];
  if (p.kind === "daily" && p.dailyPlan?.length) return p.dailyPlan.map((d) => d.poses);
  if (p.weekPlan.length) return p.weekPlan.map((w) => w.poses);
  return [];
}

export function classMinutes(p: Pathway): number {
  const queues = sessionQueues(p).filter((poses) => poses.length > 0);
  if (!queues.length) return 1;
  return Math.min(...queues.map((poses) => catalogSessionMinutes(poses)));
}

export function durationBucket(minutes: number): DurationBucketId {
  if (minutes < 15) return "under-15";
  if (minutes <= 30) return "15-30";
  return "30-plus";
}

function focusFromPoses(poses: CatalogPose[]): ClassFocus {
  const counts = new Map<Category, number>();
  for (const pose of poses) {
    const slug = pose.asanaSlug ?? pose.slug;
    const category = slug ? asanaBySlug(slug)?.category : undefined;
    if (!category) continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  let best: Category | null = null;
  let bestN = 0;
  for (const [category, n] of counts) {
    if (n > bestN) {
      best = category;
      bestN = n;
    }
  }
  return best ? FOCUS_FROM_CATEGORY[best] : "Standing";
}

function focusFor(p: Pathway, poses: CatalogPose[]): ClassFocus {
  const days = p.dailyPlan ?? [];
  if (days.length) {
    const counts = new Map<string, number>();
    for (const day of days) {
      if (day.focus === "general") continue;
      counts.set(day.focus, (counts.get(day.focus) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestN = 0;
    for (const [focus, n] of counts) {
      if (n > bestN) {
        best = focus;
        bestN = n;
      }
    }
    if (best) {
      const mapped = FOCUS_FROM_PLAN[best as keyof typeof FOCUS_FROM_PLAN];
      if (mapped) return mapped;
    }
  }
  return focusFromPoses(poses);
}

export function describeClass(p: Pathway): ClassListing {
  const queues = sessionQueues(p).filter((poses) => poses.length > 0);
  const first = queues[0] ?? [];
  const minutes = classMinutes(p);
  const level = first.length ? catalogPreflight(first).difficulty.level : "Beginner";
  return {
    pathway: p,
    style: classStyle(p),
    level,
    minutes,
    duration: durationBucket(minutes),
    focus: focusFor(p, first),
    plus: isPlusClass(p),
    isPlus: p.isPlus,
  };
}

export function classListings(pathways: readonly Pathway[] = PATHWAYS): ClassListing[] {
  return pathways.map(describeClass);
}

function searchRank(item: ClassListing, query: string): number {
  const name = item.pathway.name.toLowerCase();
  if (name.includes(query)) return 0;
  if ((item.pathway.tagline ?? "").toLowerCase().includes(query)) return 1;
  if (item.focus.toLowerCase().includes(query)) return 2;
  return 3;
}

export function filterClasses(items: readonly ClassListing[], filters: ClassFilters): ClassListing[] {
  const query = filters.query?.trim().toLowerCase() ?? "";
  const matched = items.filter((item) => {
    if (filters.style && filters.style !== "all" && item.style !== filters.style) return false;
    if (filters.level && filters.level !== "all" && item.level !== filters.level) return false;
    if (filters.duration && filters.duration !== "all" && item.duration !== filters.duration) return false;
    if (filters.focus && filters.focus !== "all" && item.focus !== filters.focus) return false;
    if (!query) return true;
    const p = item.pathway;
    const haystack = [p.name, p.tagline, p.target, p.summary, item.style, item.focus, item.level]
      .filter((part): part is string => !!part)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
  if (!query) return matched;
  return matched
    .map((item, index) => ({ item, index, rank: searchRank(item, query) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((row) => row.item);
}

export function filtersAreActive(filters: ClassFilters): boolean {
  return (
    !!filters.query?.trim() ||
    (!!filters.style && filters.style !== "all") ||
    (!!filters.level && filters.level !== "all") ||
    (!!filters.duration && filters.duration !== "all") ||
    (!!filters.focus && filters.focus !== "all")
  );
}
