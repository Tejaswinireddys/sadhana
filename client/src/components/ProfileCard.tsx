// ProfileCard — a single personalization preset card on the /profiles page.
//   - illustration thumbnail (reuses the first recommended pose image)
//   - name, tagline, minutes/sessions badge
//   - "Activate" button (persists via /api/profile/activate)
//   - "Currently active" badge when selected
//   - "Why this profile?" expandable section
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { resolveIcon } from "@/lib/icons";
import type { Profile } from "@/data/profiles";
import { Check, Clock, CalendarDays, ChevronDown, Info } from "lucide-react";

export function ProfileCard({ profile, active }: { profile: Profile; active: boolean }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const Icon = resolveIcon(profile.icon);
  const thumbSlug = profile.recommendedAsanas[0];

  const activate = useMutation({
    mutationFn: () => apiRequest("POST", "/api/profile/activate", { profileId: profile.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/active"] });
      toast({
        title: `${profile.name} activated`,
        description: "Your home dashboard is now tailored to this path.",
      });
    },
  });

  const days = profile.daysPerWeek === 7 ? "daily" : `${profile.daysPerWeek}x / week`;

  return (
    <Card
      className={`flex h-full flex-col overflow-hidden shadow-soft transition-shadow hover:shadow-soft-lg ${
        active ? "border-primary ring-1 ring-primary" : ""
      }`}
      data-testid={`profile-card-${profile.id}`}
    >
      <div className="relative flex items-center gap-4 bg-accent/30 p-4">
        <img
          src={`${import.meta.env.BASE_URL}poses/${thumbSlug}.png`}
          alt=""
          className="h-20 w-20 shrink-0 rounded-xl object-cover shadow-soft"
          draggable={false}
        />
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5 text-primary">
            <Icon className="h-4 w-4" />
            <h3 className="truncate font-serif text-lg leading-tight" data-testid={`text-profile-name-${profile.id}`}>
              {profile.name}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">{profile.tagline}</p>
        </div>
        {active && (
          <Badge className="absolute right-3 top-3 gap-1" data-testid={`badge-active-${profile.id}`}>
            <Check className="h-3 w-3" /> Active
          </Badge>
        )}
      </div>

      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <p className="text-sm text-muted-foreground">{profile.description}</p>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1 tabular-nums">
            <Clock className="h-3 w-3" /> {profile.minutesPerSession} min
          </Badge>
          <Badge variant="outline" className="gap-1">
            <CalendarDays className="h-3 w-3" /> {days}
          </Badge>
          <Badge variant="outline" className="tabular-nums">
            {profile.recommendedAsanas.length} poses
          </Badge>
          {profile.recommendedBreathing.length > 0 && (
            <Badge variant="outline" className="tabular-nums">
              {profile.recommendedBreathing.length} breath
            </Badge>
          )}
        </div>

        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button
              className="inline-flex items-center gap-1 text-xs font-medium text-secondary hover:underline"
              data-testid={`button-why-${profile.id}`}
            >
              <Info className="h-3.5 w-3.5" /> Why this profile?
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <p className="rounded-lg bg-accent/40 p-3 text-xs text-muted-foreground" data-testid={`text-why-${profile.id}`}>
              {profile.why}
            </p>
          </CollapsibleContent>
        </Collapsible>

        <div className="mt-auto pt-1">
          <Button
            className="w-full"
            variant={active ? "outline" : "default"}
            disabled={active || activate.isPending}
            onClick={() => activate.mutate()}
            data-testid={`button-activate-${profile.id}`}
          >
            {active ? (
              <>
                <Check className="mr-1.5 h-4 w-4" /> Currently active
              </>
            ) : (
              "Activate"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
