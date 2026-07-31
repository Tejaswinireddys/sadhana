import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { FadeIn } from "@/components/motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Community challenges — privacy-first, no body-comparison leaderboards.
 * Participation is local/enrolment-based for now (no social graph).
 */
const CHALLENGES = [
  {
    id: "seven-calm-mornings",
    title: "Seven calm mornings",
    blurb: "Show up for any 10-minute practice before noon, seven times.",
    pathwaySlug: "foundations-beginner",
    privacy: "Private by default — only you see completion.",
  },
  {
    id: "stress-release-circle",
    title: "Stress release week",
    blurb: "Complete the Stress Release Week program at your own pace.",
    pathwaySlug: "stress-release-week",
    privacy: "No calorie or shape metrics. Supportive check-ins only.",
  },
  {
    id: "chair-crew",
    title: "Chair crew",
    blurb: "Three chair or limited-mobility sessions this week.",
    pathwaySlug: "chair-limited-mobility",
    privacy: "Aliases only if group mode ships later; report/block ready.",
  },
] as const;

export default function Challenges() {
  useDocumentTitle("Challenges · Sadhana");
  return (
    <FadeIn className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Challenges</h1>
        <p className="max-w-xl text-muted-foreground">
          Goal-based cohorts without body comparison. Moderation and private defaults come before
          any public leaderboard.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {CHALLENGES.map((c) => (
          <Card key={c.id} className="shadow-soft" data-testid={`challenge-${c.id}`}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="font-serif text-xl">{c.title}</CardTitle>
                <Badge variant="outline">Private</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{c.blurb}</p>
              <p className="text-xs text-muted-foreground">{c.privacy}</p>
              <Button className="min-h-11" asChild>
                <Link href={`/pathways/${c.pathwaySlug}`}>Open program</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </FadeIn>
  );
}
