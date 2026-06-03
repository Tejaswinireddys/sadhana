import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ProfileCard } from "@/components/ProfileCard";
import { PROFILES } from "@/data/profiles";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UserProfile } from "@shared/schema";
import { Compass } from "lucide-react";

export default function Profiles() {
  const { toast } = useToast();
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
              onClick={() => deactivate.mutate()}
              disabled={deactivate.isPending}
              data-testid="button-clear-profile"
            >
              Clear profile
            </Button>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PROFILES.map((p) => (
          <ProfileCard key={p.id} profile={p} active={p.id === activeId} />
        ))}
      </div>
    </div>
  );
}
