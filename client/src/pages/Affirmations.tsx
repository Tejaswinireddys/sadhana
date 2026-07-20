import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  AFFIRMATION_THEMES,
  AFFIRMATIONS,
  PROFILE_AFFIRMATION_TAG_MAP,
  affirmationsForTheme,
  type AffirmationThemeId,
} from "@/data/content";
import { profileById } from "@/data/profiles";
import type { Favorite, UserProfile } from "@shared/schema";
import { Heart, Volume2 } from "lucide-react";

function readAloud(text: string) {
  if ("speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
}

function readParam(name: string): string {
  const direct = new URLSearchParams(window.location.search).get(name);
  if (direct) return direct;
  const hash = window.location.hash;
  const qIndex = hash.indexOf("?");
  if (qIndex !== -1) {
    const fromHash = new URLSearchParams(hash.slice(qIndex + 1)).get(name);
    if (fromHash) return fromHash;
  }
  return "";
}

function slugifyAffirmation(text: string): string {
  return text.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 40);
}

function AffirmationCard({
  text,
  fav,
  onToggle,
  highlighted,
}: {
  text: string;
  fav?: Favorite;
  onToggle: () => void;
  highlighted?: boolean;
}) {
  return (
    <Card
      id={`affirmation-${slugifyAffirmation(text)}`}
      className={`shadow-soft transition-shadow ${highlighted ? "ring-2 ring-primary" : ""}`}
      data-testid={`card-affirmation-${text.slice(0, 12)}`}
    >
      <CardContent className="flex flex-col gap-3 p-5">
        <p className="font-serif text-lg leading-snug">"{text}"</p>
        <div className="flex gap-2">
          <Button
            variant={fav ? "default" : "outline"}
            size="sm"
            onClick={onToggle}
            data-testid={`button-favorite-${text.slice(0, 12)}`}
          >
            <Heart className={`mr-1.5 h-4 w-4 ${fav ? "fill-current" : ""}`} />
            {fav ? "Favorited" : "Favorite"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => readAloud(text)} data-testid={`button-read-${text.slice(0, 12)}`}>
            <Volume2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AffirmationGrid({
  items,
  favByText,
  toggle,
  focus,
}: {
  items: string[];
  favByText: (text: string) => Favorite | undefined;
  toggle: (text: string) => void;
  focus: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing in this theme yet"
        description="Try another theme, or favorite affirmations from All."
      />
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((text) => (
        <AffirmationCard
          key={text}
          text={text}
          fav={favByText(text)}
          onToggle={() => toggle(text)}
          highlighted={!!focus && focus === text}
        />
      ))}
    </div>
  );
}

export default function Affirmations() {
  const { data: favorites = [], isLoading } = useQuery<Favorite[]>({ queryKey: ["/api/favorites"] });
  const { data: activeProfileRow } = useQuery<UserProfile | null>({
    queryKey: ["/api/profile/active"],
  });
  const [focus, setFocus] = useState(() => readParam("focus"));
  const profile = profileById(activeProfileRow?.profileId);
  const profileTheme =
    profile?.recommendedAffirmationsTag
      ? PROFILE_AFFIRMATION_TAG_MAP[profile.recommendedAffirmationsTag]
      : undefined;

  const initialTheme = (): string => {
    const fromUrl = readParam("theme");
    if (fromUrl && (fromUrl === "all" || fromUrl === "favorites" || fromUrl in PROFILE_AFFIRMATION_TAG_MAP || AFFIRMATION_THEMES.some((t) => t.id === fromUrl))) {
      return PROFILE_AFFIRMATION_TAG_MAP[fromUrl] ?? fromUrl;
    }
    return profileTheme ?? "all";
  };
  const [themeTab, setThemeTab] = useState(initialTheme);

  useEffect(() => {
    const onChange = () => {
      setFocus(readParam("focus"));
      const t = readParam("theme");
      if (t) setThemeTab(PROFILE_AFFIRMATION_TAG_MAP[t] ?? t);
    };
    window.addEventListener("hashchange", onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      window.removeEventListener("hashchange", onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, []);

  useEffect(() => {
    if (!focus) return;
    const id = `affirmation-${slugifyAffirmation(focus)}`;
    const t = setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    const clear = setTimeout(() => setFocus(""), 2600);
    return () => {
      clearTimeout(t);
      clearTimeout(clear);
    };
  }, [focus]);

  const favByText = (text: string) => favorites.find((f) => f.affirmationText === text);

  const addFav = useMutation({
    mutationFn: (text: string) =>
      apiRequest("POST", "/api/favorites", { affirmationText: text, createdAt: new Date().toISOString() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/favorites"] }),
  });
  const removeFav = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/favorites/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/favorites"] }),
  });

  const toggle = (text: string) => {
    const f = favByText(text);
    if (f) removeFav.mutate(f.id);
    else addFav.mutate(text);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Affirmations</h1>
        <p className="text-muted-foreground">
          {AFFIRMATIONS.length} mindful affirmations across calm, strength, motherhood, clarity,
          self-love, and sleep. Favorite the ones that resonate and read them aloud.
          {profile && profileTheme ? (
            <>
              {" "}
              For your {profile.name} path, try{" "}
              <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground"
                onClick={() => setThemeTab(profileTheme)}
                data-testid="button-profile-theme"
              >
                {AFFIRMATION_THEMES.find((t) => t.id === profileTheme)?.label}
              </button>
              .
            </>
          ) : null}
        </p>
      </header>

      <Tabs value={themeTab} onValueChange={setThemeTab}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="all" data-testid="tab-all-affirmations">
            All
          </TabsTrigger>
          {AFFIRMATION_THEMES.map((t) => (
            <TabsTrigger key={t.id} value={t.id} data-testid={`tab-theme-${t.id}`}>
              {t.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="favorites" data-testid="tab-favorite-affirmations">
            Favorites{favorites.length ? ` (${favorites.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <AffirmationGrid items={AFFIRMATIONS} favByText={favByText} toggle={toggle} focus={focus} />
        </TabsContent>

        {AFFIRMATION_THEMES.map((t) => (
          <TabsContent key={t.id} value={t.id} className="mt-4">
            <AffirmationGrid
              items={affirmationsForTheme(t.id as AffirmationThemeId)}
              favByText={favByText}
              toggle={toggle}
              focus={focus}
            />
          </TabsContent>
        ))}

        <TabsContent value="favorites" className="mt-4">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : favorites.length === 0 ? (
            <EmptyState
              title="No favorites yet"
              description="Tap the heart on any affirmation to keep it close. Your starred affirmations will gather here."
              testId="empty-favorites"
            />
          ) : (
            <AffirmationGrid
              items={favorites.map((f) => f.affirmationText)}
              favByText={favByText}
              toggle={toggle}
              focus={focus}
            />
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
