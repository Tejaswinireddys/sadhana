import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AFFIRMATIONS } from "@/data/content";
import type { Favorite } from "@shared/schema";
import { Heart, Volume2 } from "lucide-react";

function readAloud(text: string) {
  if ("speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
}

function readFocus(): string {
  const direct = new URLSearchParams(window.location.search).get("focus");
  if (direct) return direct;
  const hash = window.location.hash;
  const qIndex = hash.indexOf("?");
  if (qIndex !== -1) {
    const fromHash = new URLSearchParams(hash.slice(qIndex + 1)).get("focus");
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

export default function Affirmations() {
  const { data: favorites = [], isLoading } = useQuery<Favorite[]>({ queryKey: ["/api/favorites"] });
  const [focus, setFocus] = useState(readFocus());

  // When arriving from search with ?focus=..., scroll to and highlight the card.
  useEffect(() => {
    const onChange = () => setFocus(readFocus());
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
          {AFFIRMATIONS.length} mindful affirmations. Favorite the ones that resonate and read them aloud.
        </p>
      </header>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all-affirmations">All</TabsTrigger>
          <TabsTrigger value="favorites" data-testid="tab-favorite-affirmations">
            Favorites{favorites.length ? ` (${favorites.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AFFIRMATIONS.map((text) => (
              <AffirmationCard
                key={text}
                text={text}
                fav={favByText(text)}
                onToggle={() => toggle(text)}
                highlighted={!!focus && focus === text}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="favorites" className="mt-4">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : favorites.length === 0 ? (
            <EmptyState
              title="No favorites yet"
              description="Tap the heart on any affirmation to keep it close. Your starred affirmations will gather here."
              testId="empty-favorites"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {favorites.map((f) => (
                <AffirmationCard key={f.id} text={f.affirmationText} fav={f} onToggle={() => toggle(f.affirmationText)} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
