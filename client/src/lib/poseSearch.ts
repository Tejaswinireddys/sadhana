/**
 * poseSearch — one matcher, shared by the sidebar typeahead and the results page.
 *
 * The typeahead previously offered nothing but "Search for 'warrior'" and a
 * recents list, which is not a useful autocomplete for a 207-pose library —
 * it made the user commit to a navigation to find out whether anything matched.
 * Keeping the ranking here means the preview can never disagree with the page
 * it previews.
 *
 * Anatomy queries (hip, back, neck, shoulders) map to catalog categories /
 * body-region tags before falling through to full-text, so "hip" returns Hip
 * Openers instead of every pose whose cues mention "hip-width".
 */
import { ASANAS, type Asana, type Category } from "@/data/content";

const NAME_WEIGHT = 10;
const SANSKRIT_WEIGHT = 8;
const TAG_WEIGHT = 5;
const BODY_WEIGHT = 1;

export function squash(s: string): string {
  return s.toLowerCase().replace(/[\s-]+/g, "");
}

/**
 * True when `squashedQuery` can be formed from prefixes of the words in `name`,
 * in order, skipping words freely. Lets "downdog" find "Downward-Facing Dog"
 * and "warr2" find "Warrior 2".
 */
export function matchesWordPrefixes(squashedQuery: string, name: string): boolean {
  if (!squashedQuery) return false;
  const words = name.toLowerCase().split(/[\s-]+/).filter(Boolean);
  const consume = (qi: number, w: number): boolean => {
    if (qi >= squashedQuery.length) return true;
    if (w >= words.length) return false;
    const word = words[w];
    const max = Math.min(word.length, squashedQuery.length - qi);
    for (let take = max; take >= 1; take--) {
      if (word.startsWith(squashedQuery.slice(qi, qi + take)) && consume(qi + take, w + 1)) {
        return true;
      }
    }
    return consume(qi, w + 1);
  };
  return consume(0, 0);
}

function contains(text: string, q: string, qSquashed: string): boolean {
  const lower = text.toLowerCase();
  if (lower.includes(q)) return true;
  if (qSquashed.length >= 3 && squash(text).includes(qSquashed)) return true;
  return false;
}

function nameHit(a: Asana, q: string, qSquashed: string): boolean {
  if (contains(a.english, q, qSquashed) || contains(a.sanskrit, q, qSquashed)) return true;
  if (qSquashed.length >= 3) {
    if (matchesWordPrefixes(qSquashed, a.english)) return true;
    if (matchesWordPrefixes(qSquashed, a.sanskrit)) return true;
  }
  return false;
}

function tagHay(a: Asana): string {
  return [a.category, ...a.benefits, ...a.bestFor].join(" ");
}

function anatomyTagHay(a: Asana): string {
  return [
    ...a.benefits,
    ...a.bestFor,
    ...a.stretchZones.filter((z) => z.primary).map((z) => z.region),
  ].join(" ");
}

function bodyHay(a: Asana): string {
  return [a.summary, ...a.steps.map((s) => s.text)].join(" ");
}

/** Whole-query anatomy terms that should hit a category (or body-region tags) first. */
function anatomyTarget(q: string): { categories: Category[]; tagsOnly: boolean } | null {
  if (/^hips?(\s+openers?)?$/.test(q)) return { categories: ["Hip Openers"], tagsOnly: false };
  if (/^cores?$/.test(q)) return { categories: ["Core"], tagsOnly: false };
  if (/^backbends?$/.test(q)) return { categories: ["Backbends"], tagsOnly: false };
  if (/^(low(er)?\s+)?backs?$/.test(q)) return { categories: ["Backbends", "Forward Bends"], tagsOnly: false };
  if (/^necks?$/.test(q)) return { categories: [], tagsOnly: true };
  if (/^shoulders?$/.test(q)) return { categories: [], tagsOnly: true };
  return null;
}

function anatomyMatches(a: Asana, q: string, qSquashed: string): boolean {
  const target = anatomyTarget(q);
  if (!target) return false;
  if (nameHit(a, q, qSquashed)) return true;
  if (target.tagsOnly) return contains(anatomyTagHay(a), q, qSquashed);
  return target.categories.includes(a.category);
}

/** Does this pose match at all? Mirrors the results page exactly. */
export function poseMatches(a: Asana, q: string, qSquashed: string): boolean {
  if (anatomyTarget(q)) return anatomyMatches(a, q, qSquashed);

  if (nameHit(a, q, qSquashed)) return true;
  if (contains(tagHay(a), q, qSquashed)) return true;
  if (contains(bodyHay(a), q, qSquashed)) return true;
  return false;
}

function nameTiebreak(a: Asana, q: string, qSquashed: string): number {
  const english = a.english.toLowerCase();
  const sanskrit = a.sanskrit.toLowerCase();
  if (english === q || sanskrit === q) return 0;
  if (english.startsWith(q) || sanskrit.startsWith(q)) return 1;
  if (english.includes(q) || sanskrit.includes(q)) return 2;
  if (qSquashed.length >= 3 && (squash(english).includes(qSquashed) || squash(sanskrit).includes(qSquashed))) {
    return 3;
  }
  if (matchesWordPrefixes(qSquashed, a.english) || matchesWordPrefixes(qSquashed, a.sanskrit)) return 4;
  return 5;
}

/**
 * Field weights: name ×10, Sanskrit ×8, category/benefit tag ×5, body text ×1.
 * Anatomy-mapped categories count as a tag hit even when the category label
 * doesn't contain the query ("back" → Forward Bends).
 */
export function scorePose(a: Asana, q: string, qSquashed: string): number {
  let score = 0;
  if (contains(a.english, q, qSquashed) || (qSquashed.length >= 3 && matchesWordPrefixes(qSquashed, a.english))) {
    score += NAME_WEIGHT;
  }
  if (contains(a.sanskrit, q, qSquashed) || (qSquashed.length >= 3 && matchesWordPrefixes(qSquashed, a.sanskrit))) {
    score += SANSKRIT_WEIGHT;
  }
  const target = anatomyTarget(q);
  const mappedCategory = !!target && !target.tagsOnly && target.categories.includes(a.category);
  const tagHit =
    mappedCategory ||
    contains(tagHay(a), q, qSquashed) ||
    (!!target?.tagsOnly && contains(anatomyTagHay(a), q, qSquashed));
  if (tagHit) score += TAG_WEIGHT;
  if (contains(bodyHay(a), q, qSquashed)) score += BODY_WEIGHT;
  return score;
}

export type PoseSuggestion = {
  slug: string;
  english: string;
  sanskrit: string;
  category: string;
  imageAlt: string;
};

/** All matching poses, highest score first. Empty query → []. */
export function rankedPoses(query: string): Asana[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const qSquashed = squash(q);
  return ASANAS.filter((a) => poseMatches(a, q, qSquashed)).sort(
    (a, b) =>
      scorePose(b, q, qSquashed) - scorePose(a, q, qSquashed) ||
      nameTiebreak(a, q, qSquashed) - nameTiebreak(b, q, qSquashed) ||
      a.english.localeCompare(b.english),
  );
}

/** Top matches for the typeahead, plus how many matched in total. */
export function searchPoses(query: string, limit = 6): { items: PoseSuggestion[]; total: number } {
  const ranked = rankedPoses(query);
  return {
    items: ranked.slice(0, limit).map((a) => ({
      slug: a.slug,
      english: a.english,
      sanskrit: a.sanskrit,
      category: a.category,
      imageAlt: a.imageAlt,
    })),
    total: ranked.length,
  };
}
