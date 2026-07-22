import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ProfileCard } from "@/components/ProfileCard";
import { PROFILES, type Profile } from "@/data/profiles";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UserProfile } from "@shared/schema";
import { Compass } from "lucide-react";
import { cn } from "@/lib/utils";

type AudienceFilter = "all" | "everyday" | "men" | "women" | "pregnancy";

const AUDIENCE_IDS = new Set(["mens-strength", "womens-wellness", "pregnancy"]);

const FILTERS: { id: AudienceFilter; label: string }[] = [
  { id: "all", label: "All paths" },
  { id: "everyday", label: "Everyday" },
  { id: "men", label: "Men" },
  { id: "women", label: "Women" },
  { id: "pregnancy", label: "Pregnancy" },
];

function matchesFilter(p: Profile, filter: AudienceFilter): boolean {
  if (filter === "all") return true;
  if (filter === "men") return p.id === "mens-strength";
  if (filter === "women") return p.id === "womens-wellness";
  if (filter === "pregnancy") return p.id === "pregnancy";
  return !AUDIENCE_IDS.has(p.id);
}

export default function Profiles() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<AudienceFilter>("all");
  const { data: activeProfile } = useQuery<UserProfile | null>({
    queryKey: ["/api/profile/active"],
  });
  const activeId = activeProfile?.profileId ?? null;

  const deactivate = useMutation({
    mutationFn: () => apiRequest("POST", "/api/profile/deactivate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/active"] });
      toast({ title: "Profile cleared", description: "Your home dashboard is back to the default." });
    },
  });

  const visible = useMemo(
    () => PROFILES.filter((p) => matchesFilter(p, filter)),
    [filter],
  );

  return (
    <div className="animate-fade-in space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <Compass className="h-5 w-5" />
          <span className="text-xs font-medium uppercase tracking-wide">Personalize</span>
        </div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Pick a path that fits your life</h1>
        <p className="max-w-2xl text-muted-foreground">
          Choose a preset built around a goal and a realistic cadence. Activating a path tailors
          your home dashboard and pre-builds today's session — poses and breath, ready to go.
        </p>
        {activeId && (
          <div className="flex items-center gap-3 pt-1">
            <p className="text-sm text-muted-foreground" data-testid="text-active-profile-note">
              Currently following your path. Want a change?
            </p>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 cursor-pointer"
              onClick={() => deactivate.mutate()}
              disabled={deactivate.isPending}
              data-testid="button-clear-profile"
            >
              Clear profile
            </Button>
          </div>
        )}
      </header>

      <div
        className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Filter practice paths"
      >
        {FILTERS.map((f) => {
          const on = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex h-11 shrink-0 cursor-pointer items-center rounded-full border px-4 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                on
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border/60 bg-card/80 text-foreground hover:border-primary/30 hover:bg-primary/5",
              )}
              data-testid={`filter-profile-${f.id}`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((p) => (
          <ProfileCard key={p.id} profile={p} active={p.id === activeId} />
        ))}
      </div>
    </div>
  );
}
