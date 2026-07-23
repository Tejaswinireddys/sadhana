// ProfileCard — a single personalization preset card on the /profiles page.
//   - outcome chip + multi-pose preview strip
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
import { PoseImage } from "@/components/PoseImage";
import { Check, Clock, CalendarDays, ChevronDown, Info, Sparkles } from "lucide-react";

const AUDIENCE_BADGE: Record<string, string> = {
  "mens-strength": "For men",
  "womens-wellness": "For women",
  pregnancy: "Pregnancy",
};

export function ProfileCard({ profile, active }: { profile: Profile; active: boolean }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const Icon = resolveIcon(profile.icon);
  const previewSlugs = profile.recommendedAsanas.slice(0, 3);
  const outcome = profile.tagline;
  const audience = AUDIENCE_BADGE[profile.id];

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
      <div className="surface-banner relative space-y-3 border-0 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3
                className="font-serif text-lg leading-tight"
                data-testid={`text-profile-name-${profile.id}`}
              >
                {profile.name}
              </h3>
              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                {audience && (
                  <Badge variant="secondary" data-testid={`badge-audience-${profile.id}`}>
                    {audience}
                  </Badge>
                )}
                {active && (
                  <Badge className="gap-1" data-testid={`badge-active-${profile.id}`}>
                    <Check className="h-3 w-3" /> Active
                  </Badge>
                )}
              </div>
            </div>
            <p
              className="mt-1 inline-flex items-start gap-1.5 text-sm font-medium text-foreground"
              data-testid={`text-profile-outcome-${profile.id}`}
            >
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              <span>{outcome}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-2" aria-label="Sample poses in this path">
          {previewSlugs.map((slug) => (
            <PoseImage
              key={slug}
              slug={slug}
              alt=""
              className="h-16 w-16 shrink-0"
              aspect="aspect-square"
              rounded="rounded-xl"
              breath={false}
              shadow
              sizes="64px"
            />
          ))}
        </div>
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
              type="button"
              className="inline-flex min-h-11 cursor-pointer items-center gap-1 text-xs font-medium text-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid={`button-why-${profile.id}`}
            >
              <Info className="h-3.5 w-3.5" /> Why this profile?
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <p
              className="surface-inset p-3 text-xs text-muted-foreground"
              data-testid={`text-why-${profile.id}`}
            >
              {profile.why}
            </p>
          </CollapsibleContent>
        </Collapsible>

        <div className="mt-auto pt-1">
          <Button
            className="min-h-11 w-full cursor-pointer"
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
              `Use ${profile.name}`
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
