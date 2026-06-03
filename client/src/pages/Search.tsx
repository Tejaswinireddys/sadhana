// Search — global search across poses, breathing, pathways, and affirmations.
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
import { Search as SearchIcon, Wind, Route as RouteIcon, Sparkles, LayoutGrid } from "lucide-react";

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

  const results = useMemo(() => {
    if (!q) return { poses: [], breathing: [], pathways: [], affirmations: [] };

    const poses = ASANAS.filter((a) => {
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
      return hay.includes(q);
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

    return { poses, breathing, pathways, affirmations };
  }, [q]);

  const total =
    results.poses.length +
    results.breathing.length +
    results.pathways.length +
    results.affirmations.length;

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
          description="Find poses, breathing techniques, pathways, and affirmations from the search box in the sidebar."
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
                          src={`/poses/${a.slug}.png`}
                          alt={a.english}
                          className="h-14 w-14 shrink-0 rounded-lg bg-accent/40 object-cover"
                          draggable={false}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.visibility = "hidden";
                          }}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-serif text-base">{a.sanskrit}</p>
                          <p className="truncate text-sm text-muted-foreground">{a.english}</p>
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
        </div>
      )}
    </div>
  );
}
