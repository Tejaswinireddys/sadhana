import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PoseImage } from "@/components/PoseImage";
import { EmptyState } from "@/components/EmptyState";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ASANAS, CATEGORIES, type Category, type Asana } from "@/data/content";
import type { FavoriteAsana } from "@shared/schema";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

const diffColor: Record<string, string> = {
  Beginner: "bg-secondary/20 text-secondary-foreground border-secondary/30",
  Intermediate: "bg-primary/15 text-primary border-primary/30",
  Advanced: "bg-destructive/15 text-destructive border-destructive/30",
};

const LEVELS = ["All", "Beginner", "Intermediate", "Advanced"] as const;
type LevelFilter = (typeof LEVELS)[number];

const TIME_FILTERS = ["Any time", "Under 30s hold", "1 min+"] as const;
type TimeFilter = (typeof TIME_FILTERS)[number];

const PROP_FILTERS = ["Any props", "No props", "Needs block", "Needs strap", "Needs wall"] as const;
type PropFilter = (typeof PROP_FILTERS)[number];

// Does any variation of this asana use the given prop?
function usesProp(a: Asana, prop: string): boolean {
  return Object.values(a.variations).some((v) => v.props.includes(prop));
}
function usesNoProps(a: Asana): boolean {
  return Object.values(a.variations).every((v) => v.props.every((p) => p === "none"));
}

export default function Asanas() {
  const [category, setCategory] = useState<Category | "All">("All");
  const [level, setLevel] = useState<LevelFilter>("All");
  const [time, setTime] = useState<TimeFilter>("Any time");
  const [prop, setProp] = useState<PropFilter>("Any props");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const { data: favorites = [] } = useQuery<FavoriteAsana[]>({
    queryKey: ["/api/favorites/asanas"],
  });
  const favSet = useMemo(() => new Set(favorites.map((f) => f.slug)), [favorites]);

  const toggleFav = useMutation({
    mutationFn: ({ slug, isFav }: { slug: string; isFav: boolean }) =>
      isFav
        ? apiRequest("DELETE", `/api/favorites/asanas/${slug}`)
        : apiRequest("POST", "/api/favorites/asanas", { slug }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/favorites/asanas"] }),
  });

  const list = useMemo(() => {
    return ASANAS.filter((a) => {
      if (category !== "All" && a.category !== category) return false;
      if (level !== "All" && a.difficulty !== level) return false;
      if (time === "Under 30s hold" && a.holdSeconds >= 30) return false;
      if (time === "1 min+" && a.holdSeconds < 60) return false;
      if (prop === "No props" && !usesNoProps(a)) return false;
      if (prop === "Needs block" && !usesProp(a, "block")) return false;
      if (prop === "Needs strap" && !usesProp(a, "strap")) return false;
      if (prop === "Needs wall" && !usesProp(a, "wall")) return false;
      if (favoritesOnly && !favSet.has(a.slug)) return false;
      return true;
    });
  }, [category, level, time, prop, favoritesOnly, favSet]);

  const resetFilters = () => {
    setCategory("All");
    setLevel("All");
    setTime("Any time");
    setProp("Any props");
    setFavoritesOnly(false);
  };

  const FilterRow = ({
    label,
    options,
    active,
    onSelect,
    group,
  }: {
    label: string;
    options: readonly string[];
    active: string;
    onSelect: (v: any) => void;
    group: string;
  }) => (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button
            key={o}
            variant={active === o ? "default" : "outline"}
            onClick={() => onSelect(o)}
            className="min-h-[44px] cursor-pointer px-3 transition-colors duration-200"
            data-testid={`filter-${group}-${o.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
          >
            {o}
          </Button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in space-y-6">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Asana Library</h1>
        <p className="text-muted-foreground">
          {ASANAS.length} poses across seven families. Tap any card to explore the full guide.
        </p>
      </header>

      {/* Favorites tab + count chip */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={favoritesOnly ? "default" : "outline"}
          onClick={() => setFavoritesOnly((v) => !v)}
          className="min-h-[44px] cursor-pointer gap-1.5 transition-colors duration-200"
          data-testid="filter-favorites"
        >
          <Heart className={cn("h-4 w-4", favoritesOnly && "fill-current")} />
          Favorites
          {favorites.length > 0 && (
            <span className="ml-1 rounded-full bg-background/30 px-1.5 text-xs tabular-nums">
              {favorites.length}
            </span>
          )}
        </Button>
        <Badge variant="secondary" className="tabular-nums" data-testid="chip-pose-count">
          {list.length} {list.length === 1 ? "pose" : "poses"}
        </Badge>
      </div>

      {/* Layered filters */}
      <div className="space-y-4 rounded-xl border border-border bg-card/40 p-4">
        <FilterRow
          label="Category"
          options={["All", ...CATEGORIES]}
          active={category}
          onSelect={setCategory}
          group="category"
        />
        <FilterRow label="Level" options={LEVELS} active={level} onSelect={setLevel} group="level" />
        <FilterRow label="Hold time" options={TIME_FILTERS} active={time} onSelect={setTime} group="time" />
        <FilterRow label="Props" options={PROP_FILTERS} active={prop} onSelect={setProp} group="props" />
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="No poses match these filters yet"
          description="Try removing one — your perfect pose is in here somewhere."
          testId="empty-asanas"
        >
          <Button variant="outline" onClick={resetFilters} data-testid="button-clear-filters">
            Clear filters
          </Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((a) => {
            const isFav = favSet.has(a.slug);
            return (
              <Card
                key={a.slug}
                className="group relative h-full overflow-hidden shadow-soft transition-shadow hover:shadow-soft-lg hover-elevate"
                data-testid={`card-asana-${a.slug}`}
              >
                {/* Favorite toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFav.mutate({ slug: a.slug, isFav });
                  }}
                  className="absolute right-3 top-3 z-10 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-background/85 text-foreground shadow-soft backdrop-blur transition-colors duration-200 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={isFav ? `Remove ${a.english} from favorites` : `Add ${a.english} to favorites`}
                  aria-pressed={isFav}
                  data-testid={`button-favorite-${a.slug}`}
                >
                  <Heart className={cn("h-5 w-5", isFav ? "fill-primary text-primary" : "text-muted-foreground")} />
                </button>

                <Link href={`/asanas/${a.slug}`} className="block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div>
                    <div className="transition-transform duration-200 group-hover:scale-[1.02]">
                      <PoseImage
                        slug={a.slug}
                        alt={a.english}
                        rounded="rounded-none"
                        aspect="aspect-square"
                        shadow={false}
                        breath={false}
                        testId={`asana-thumb-${a.slug}`}
                      />
                    </div>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-serif text-lg leading-tight">{a.english}</h3>
                          <p className="text-sm italic text-muted-foreground">{a.sanskrit}</p>
                        </div>
                        <Badge variant="outline" className={`shrink-0 ${diffColor[a.difficulty]}`}>
                          {a.difficulty}
                        </Badge>
                      </div>
                      {a.bestFor[0] && (
                        <p className="truncate text-xs text-primary/90" data-testid={`asana-best-for-${a.slug}`}>
                          Best for · {a.bestFor[0]}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{a.category}</span>
                        <span>{a.hold}</span>
                      </div>
                    </CardContent>
                  </div>
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
