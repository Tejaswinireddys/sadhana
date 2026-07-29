/**
 * poseSearch — one matcher, shared by the sidebar typeahead and the results page.
 *
 * The typeahead previously offered nothing but "Search for 'warrior'" and a
 * recents list, which is not a useful autocomplete for a 207-pose library —
 * it made the user commit to a navigation to find out whether anything matched.
 * Keeping the ranking here means the preview can never disagree with the page
 * it previews.
 */
import { ASANAS, type Asana } from "@/data/content";

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

/** Does this pose match at all? Mirrors the results page exactly. */
export function poseMatches(a: Asana, q: string, qSquashed: string): boolean {
  const hay = [
    a.sanskrit,
    a.english,
    a.category,
    a.summary,
    a.benefits.join(" "),
    a.bestFor.join(" "),
    a.steps.map((s) => s.text).join(" "),
  ]
    .join(" ")
    .toLowerCase();
  if (hay.includes(q)) return true;
  if (qSquashed.length >= 3) {
    if (squash(a.sanskrit).includes(qSquashed)) return true;
    if (squash(a.english).includes(qSquashed)) return true;
    if (matchesWordPrefixes(qSquashed, a.english)) return true;
    if (matchesWordPrefixes(qSquashed, a.sanskrit)) return true;
  }
  return false;
}

/**
 * Rank for the preview: a name match beats a body match, and a name that
 * *starts* with the query beats one that merely contains it. Someone typing
 * "warrior" wants Warrior I, not a pose whose step text mentions warriors.
 */
function score(a: Asana, q: string, qSquashed: string): number {
  const english = a.english.toLowerCase();
  const sanskrit = a.sanskrit.toLowerCase();
  if (english === q || sanskrit === q) return 0;
  if (english.startsWith(q) || sanskrit.startsWith(q)) return 1;
  if (english.includes(q) || sanskrit.includes(q)) return 2;
  if (qSquashed.length >= 3 && (squash(english).includes(qSquashed) || squash(sanskrit).includes(qSquashed))) {
    return 3;
  }
  if (a.category.toLowerCase().includes(q)) return 4;
  return 5;
}

export type PoseSuggestion = { slug: string; english: string; sanskrit: string; category: string };

/** Top matches for the typeahead, plus how many matched in total. */
export function searchPoses(query: string, limit = 6): { items: PoseSuggestion[]; total: number } {
  const q = query.trim().toLowerCase();
  if (!q) return { items: [], total: 0 };
  const qSquashed = squash(q);

  const matched = ASANAS.filter((a) => poseMatches(a, q, qSquashed));
  const ranked = [...matched].sort(
    (a, b) => score(a, q, qSquashed) - score(b, q, qSquashed) || a.english.localeCompare(b.english),
  );

  return {
    items: ranked.slice(0, limit).map((a) => ({
      slug: a.slug,
      english: a.english,
      sanskrit: a.sanskrit,
      category: a.category,
    })),
    total: matched.length,
  };
}
