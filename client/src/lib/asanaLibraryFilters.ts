import { ASANAS, type Asana } from "../data/content";
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
