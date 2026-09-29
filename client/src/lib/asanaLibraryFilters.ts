import { ASANAS, CATEGORIES, type Asana, type Category } from "../data/content";
import { matchesCategoryFilter } from "../data/poseTaxonomy";
import { profileById, type AudienceChip } from "../data/profiles";

/** Library opens unfiltered. Do not seed this from the active practice path. */
export const DEFAULT_AUDIENCE_FILTER: AudienceChip = "All";

const MEN_SLUGS = new Set(profileById("mens-strength")?.recommendedAsanas ?? []);
const WOMEN_SLUGS = new Set(profileById("womens-wellness")?.recommendedAsanas ?? []);
const PREGNANCY_SLUGS = new Set(profileById("pregnancy")?.recommendedAsanas ?? []);

export function matchesAudience(a: Asana, audience: AudienceChip): boolean {
  if (audience === "All") return true;
  if (audience === "Men") return MEN_SLUGS.has(a.slug);
  if (audience === "Women") return WOMEN_SLUGS.has(a.slug);
  if (audience === "Pregnancy") return PREGNANCY_SLUGS.has(a.slug) || a.slug.startsWith("prenatal-");
  return true;
}

export function libraryCountForAudience(audience: AudienceChip): number {
  return ASANAS.filter((a) => matchesAudience(a, audience)).length;
}

/** Pose-family counts for the always-visible library chips (All + each CATEGORIES entry). */
export function libraryCountForCategory(category: Category | "All"): number {
  return ASANAS.filter((a) => matchesCategoryFilter(a, category)).length;
}

export function libraryFamilyChipCounts(): { id: Category | "All"; label: string; count: number }[] {
  return [
    { id: "All", label: "All", count: libraryCountForCategory("All") },
    ...CATEGORIES.map((c) => ({ id: c, label: c, count: libraryCountForCategory(c) })),
  ];
}
