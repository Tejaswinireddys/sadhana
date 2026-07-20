// Search — global search across poses, breathing, pathways, affirmations, and kids.
//   - Reads the query from the URL hash (`#/search?q=...`) since the app uses
//     hash routing.
//   - Case-insensitive substring match. No artificial result limit.
//   - Groups results by type with section headers and per-group counts.
//   - Each result links to its detail page; affirmations link to /affirmations.
import { useEffect, useState, useMemo } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { ASANAS, PATHWAYS, BREATHING, AFFIRMATIONS } from "@/data/content";
import { KIDS_POSES, KIDS_BREATH } from "@/data/kids";
import { Search as SearchIcon, Wind, Route as RouteIcon, Sparkles, LayoutGrid, Smile } from "lucide-react";

// Read ?q=... from the URL. wouter's hash navigation stores query params on
// `location.search` (e.g. "http://host/?q=warrior#/search"), so we read there;
// we also fall back to any query embedded in the hash for direct deep-links.
function readQuery(): string {
  const direct = new URLSearchParams(window.location.search).get("q");
  if (direct) return direct;
  const hash = window.location.hash;
  const qIndex = hash.indexOf("?");
  if (qIndex !== -1) {
    const fromHash = new URLSearchParams(hash.slice(qIndex + 1)).get("q");
    if (fromHash) return fromHash;
  }
  return "";
}

// Returns true if `squashedQuery` can be formed by concatenating prefixes of
// the words in `name`, taken in order (words may be skipped). This makes
// abbreviated, space-less queries like "downdog" match "Downward-Facing Dog"
// (down + dog) or "warr2" match "Warrior 2".
function matchesWordPrefixes(squashedQuery: string, name: string): boolean {
  if (!squashedQuery) return false;
  const words = name.toLowerCase().split(/[\s-]+/).filter(Boolean);
  // Recursive consume: from word index w, try to match the rest of the query.
  const consume = (qi: number, w: number): boolean => {
    if (qi >= squashedQuery.length) return true;
    for (let i = w; i < words.length; i++) {
      const word = words[i];
      // Match the longest possible shared prefix between the remaining query
      // and this word, then recurse onto the next word.
      let k = 0;
      while (k < word.length && qi + k < squashedQuery.length && word[k] === squashedQuery[qi + k]) {
        k++;
      }
      // Require at least one character matched and try every prefix length.
      for (let len = k; len >= 1; len--) {
        if (consume(qi + len, i + 1)) return true;
      }
    }
    return false;
  };
  return consume(0, 0);
}

export default function Search() {
  const [query, setQuery] = useState(readQuery());

  // Keep query in sync as navigation changes (sidebar live-typing navigation).
  // wouter dispatches a `hashchange` event on every navigate().
  useEffect(() => {
    const onChange = () => setQuery(readQuery());
    window.addEventListener("hashchange", onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      window.removeEventListener("hashchange", onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, []);

  const q = query.trim().toLowerCase();
  // A more forgiving, "squashed" form of the query with spaces and hyphens
  // removed, so "downdog" matches "Downward-Facing Dog" / "Adho Mukha Svanasana".
  const squash = (s: string) => s.toLowerCase().replace(/[\s-]+/g, "");
  const qSquashed = squash(q);

  const results = useMemo(() => {
    if (!q) return { poses: [], breathing: [], pathways: [], affirmations: [], kids: [] };

    const poses = ASANAS.filter((a) => {
      // Primary substring match across sanskrit, english, category, summary,
      // benefits, and step text (all case-insensitive).
      const hay = [
        a.sanskrit,
        a.english,
        a.category,
        a.summary,
        a.benefits.join(" "),
        a.steps.map((s) => s.text).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      if (hay.includes(q)) return true;
      // Forgiving fallback: strip spaces/hyphens from both query and the
      // pose names so e.g. "forwardfold" matches "Standing Forward Fold".
      if (qSquashed.length >= 3) {
        if (squash(a.sanskrit).includes(qSquashed)) return true;
        if (squash(a.english).includes(qSquashed)) return true;
        // Word-prefix concatenation: lets "downdog" match
        // "Downward-Facing Dog" by consuming a prefix from consecutive words.
        if (matchesWordPrefixes(qSquashed, a.english)) return true;
        if (matchesWordPrefixes(qSquashed, a.sanskrit)) return true;
      }
      return false;
    });

    const pathways = PATHWAYS.filter((p) => {
      const hay = [p.name, p.summary, p.target].join(" ").toLowerCase();
      return hay.includes(q);
    });

    const breathing = BREATHING.filter((b) => {
      const hay = [b.name, b.tagline, b.description].join(" ").toLowerCase();
      return hay.includes(q);
    });

    const affirmations = AFFIRMATIONS.filter((t) => t.toLowerCase().includes(q));

    const kidsPoses = KIDS_POSES.filter((k) => {
      const hay = [k.title, k.poseName, k.sanskrit ?? "", k.intro, k.story.join(" ")].join(" ").toLowerCase();
      return hay.includes(q) || (qSquashed.length >= 3 && squash(k.poseName).includes(qSquashed));
    }).map((k) => ({ kind: "pose" as const, ...k }));

    const kidsBreath = KIDS_BREATH.filter((k) => {
      const hay = [k.techniqueName, k.description, k.why].join(" ").toLowerCase();
      return hay.includes(q);
    }).map((k) => ({ kind: "breath" as const, ...k }));

    return {
      poses,
      breathing,
      pathways,
      affirmations,
      kids: [...kidsPoses, ...kidsBreath],
    };
  }, [q, qSquashed]);

  const total =
    results.poses.length +
    results.breathing.length +
    results.pathways.length +
    results.affirmations.length +
    results.kids.length;

  return (
    <div className="animate-fade-in space-y-6">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Search</h1>
        {q && (
          <p className="text-muted-foreground" data-testid="text-search-summary">
            {total} result{total === 1 ? "" : "s"} for "{query.trim()}"
          </p>
        )}
      </header>

      {!q ? (
        <EmptyState
          title="Type to search across everything in Sadhana"
          description="Find poses, breathing techniques, pathways, affirmations, and kids stories from the search box in the sidebar."
          testId="empty-search-prompt"
        >
          <SearchIcon className="h-8 w-8 text-muted-foreground" />
        </EmptyState>
      ) : total === 0 ? (
        <EmptyState
          title={`No matches for "${query.trim()}"`}
          description="Try different keywords — a Sanskrit name, an English pose, a benefit, or a feeling."
          testId="empty-search-results"
        />
      ) : (
        <div className="space-y-8">
          {/* Poses */}
          {results.poses.length > 0 && (
            <section className="space-y-3" data-testid="search-group-poses">
              <h2 className="flex items-center gap-2 font-serif text-xl">
                <LayoutGrid className="h-5 w-5 text-secondary" /> Poses
                <span className="text-sm font-normal text-muted-foreground">
                  · {results.poses.length} pose{results.poses.length === 1 ? "" : "s"}
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {results.poses.map((a) => (
                  <Link key={a.slug} href={`/asanas/${a.slug}`}>
                    <Card
                      className="cursor-pointer shadow-soft transition-colors hover:bg-accent/40"
                      data-testid={`search-result-pose-${a.slug}`}
                    >
                      <CardContent className="flex items-center gap-3 p-3">
                        <img
                          src={`${import.meta.env.BASE_URL}poses/${a.slug}.png`}
                          alt={a.english}
                          className="h-14 w-14 shrink-0 rounded-lg bg-accent/40 object-cover"
                          draggable={false}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.visibility = "hidden";
                          }}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-serif text-base" data-testid={`search-pose-english-${a.slug}`}>
                            {a.english}
                          </p>
                          <p className="truncate text-sm italic text-muted-foreground" data-testid={`search-pose-sanskrit-${a.slug}`}>
                            {a.sanskrit}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Breathing */}
          {results.breathing.length > 0 && (
            <section className="space-y-3" data-testid="search-group-breathing">
              <h2 className="flex items-center gap-2 font-serif text-xl">
                <Wind className="h-5 w-5 text-secondary" /> Breathing
                <span className="text-sm font-normal text-muted-foreground">
                  · {results.breathing.length} technique
                  {results.breathing.length === 1 ? "" : "s"}
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {results.breathing.map((b) => (
                  <Link key={b.slug} href={`/breathing`}>
                    <Card
                      className="cursor-pointer shadow-soft transition-colors hover:bg-accent/40"
                      data-testid={`search-result-breathing-${b.slug}`}
                    >
                      <CardContent className="space-y-1 p-4">
                        <p className="font-serif text-base">{b.name}</p>
                        <p className="text-sm text-muted-foreground">{b.tagline}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Pathways */}
          {results.pathways.length > 0 && (
            <section className="space-y-3" data-testid="search-group-pathways">
              <h2 className="flex items-center gap-2 font-serif text-xl">
                <RouteIcon className="h-5 w-5 text-secondary" /> Pathways
                <span className="text-sm font-normal text-muted-foreground">
                  · {results.pathways.length} pathway
                  {results.pathways.length === 1 ? "" : "s"}
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {results.pathways.map((p) => (
                  <Link key={p.slug} href={`/pathways/${p.slug}`}>
                    <Card
                      className="cursor-pointer shadow-soft transition-colors hover:bg-accent/40"
                      data-testid={`search-result-pathway-${p.slug}`}
                    >
                      <CardContent className="space-y-1 p-4">
                        <p className="font-serif text-base">{p.name}</p>
                        <p className="text-sm text-muted-foreground">Toward {p.target}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Affirmations */}
          {results.affirmations.length > 0 && (
            <section className="space-y-3" data-testid="search-group-affirmations">
              <h2 className="flex items-center gap-2 font-serif text-xl">
                <Sparkles className="h-5 w-5 text-secondary" /> Affirmations
                <span className="text-sm font-normal text-muted-foreground">
                  · {results.affirmations.length} affirmation
                  {results.affirmations.length === 1 ? "" : "s"}
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {results.affirmations.map((t) => (
                  <Link
                    key={t}
                    href={`/affirmations?focus=${encodeURIComponent(t)}`}
                  >
                    <Card
                      className="cursor-pointer shadow-soft transition-colors hover:bg-accent/40"
                      data-testid={`search-result-affirmation-${t.slice(0, 12)}`}
                    >
                      <CardContent className="p-4">
                        <p className="font-serif text-base leading-snug">"{t}"</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Kids */}
          {results.kids.length > 0 && (
            <section className="space-y-3" data-testid="search-group-kids">
              <h2 className="flex items-center gap-2 font-serif text-xl">
                <Smile className="h-5 w-5 text-secondary" /> Kids
                <span className="text-sm font-normal text-muted-foreground">
                  · {results.kids.length} result{results.kids.length === 1 ? "" : "s"}
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {results.kids.map((k) =>
                  k.kind === "pose" ? (
                    <Link key={`pose-${k.slug}`} href={`/kids/${k.slug}`}>
                      <Card
                        className="cursor-pointer shadow-soft transition-colors hover:bg-accent/40"
                        data-testid={`search-result-kids-${k.slug}`}
                      >
                        <CardContent className="space-y-1 p-4">
                          <p className="font-serif text-base">{k.title}</p>
                          <p className="text-sm text-muted-foreground">{k.poseName}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ) : (
                    <Link key={`breath-${k.slug}`} href={`/kids/breath/${k.slug}`}>
                      <Card
                        className="cursor-pointer shadow-soft transition-colors hover:bg-accent/40"
                        data-testid={`search-result-kids-breath-${k.slug}`}
                      >
                        <CardContent className="space-y-1 p-4">
                          <p className="font-serif text-base">{k.techniqueName}</p>
                          <p className="text-sm text-muted-foreground">{k.description}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ),
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
