import { Link } from "wouter";
import { useEffect, useState } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { FadeIn } from "@/components/motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearBuddyPairRemote,
  pairBuddyRemote,
  readBuddy,
  registerBuddyRemote,
  sendBuddyNudgeRemote,
  writeBuddy,
  type PracticeBuddy,
} from "@/lib/practiceBuddy";
import { useToast } from "@/hooks/use-toast";

/**
 * Community challenges — privacy-first, no body-comparison leaderboards.
 * Practice buddy is opt-in pairing via share code only.
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
    privacy: "Private progress only — no public leaderboard.",
  },
] as const;

export default function Challenges() {
  useDocumentTitle("Challenges · Sadhana");
  const { toast } = useToast();
  const [buddy, setBuddy] = useState<PracticeBuddy>(() => readBuddy());
  const [pairCode, setPairCode] = useState("");
  const [name, setName] = useState(buddy.displayName);

  useEffect(() => {
    void registerBuddyRemote(buddy).then(setBuddy);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- register once on mount
  }, []);

  return (
    <FadeIn className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Challenges</h1>
        <p className="max-w-xl text-muted-foreground">
          Goal-based cohorts without body comparison. Pair with one practice buddy if you want
          encouragement — never a public feed.
        </p>
      </header>

      <Card className="shadow-soft" data-testid="practice-buddy">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-xl">Practice buddy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Share your code with one person. No leaderboards, no body metrics — just a nudge that
            showing up is enough. Encouragement can arrive as a push when your buddy has reminders
            on.
          </p>
          <div className="space-y-2">
            <Label htmlFor="buddy-name">Your display name</Label>
            <Input
              id="buddy-name"
              className="min-h-11"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                const next = { ...buddy, displayName: name.trim() || "Friend" };
                writeBuddy(next);
                setBuddy(next);
                void registerBuddyRemote(next);
              }}
            />
          </div>
          <p className="rounded-md border border-border bg-accent/20 px-3 py-2 font-mono text-sm" data-testid="buddy-code">
            Your code: {buddy.code}
          </p>
          {buddy.pairedWithCode ? (
            <div className="space-y-2">
              <p className="text-sm">
                Paired with <strong>{buddy.pairedName}</strong> ({buddy.pairedWithCode})
              </p>
              <p className="text-sm text-muted-foreground italic">{buddy.encouragement}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="min-h-11"
                  onClick={() => {
                    void sendBuddyNudgeRemote().then(({ buddy: next, deliveredPush }) => {
                      setBuddy(next);
                      toast({
                        title: deliveredPush > 0 ? "Encouragement sent" : "Encouragement recorded",
                        description:
                          deliveredPush > 0
                            ? "A push went to your buddy's device."
                            : "Saved — your buddy will see it next time they open Challenges (enable push for live delivery).",
                      });
                    });
                  }}
                  data-testid="buddy-nudge"
                >
                  Send encouragement
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => {
                    void clearBuddyPairRemote().then(setBuddy);
                  }}
                >
                  Unpair
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                className="min-h-11"
                placeholder="Their code (SB-…)"
                value={pairCode}
                onChange={(e) => setPairCode(e.target.value.toUpperCase())}
                aria-label="Buddy share code"
                data-testid="buddy-pair-input"
              />
              <Button
                className="min-h-11"
                onClick={() => {
                  void pairBuddyRemote(pairCode, name.trim() || "Friend").then((next) => {
                    setBuddy(next);
                    setPairCode("");
                    toast({
                      title: next.pairedWithCode ? "Paired" : "Could not pair",
                      description: next.pairedWithCode
                        ? "You’re connected privately — no public feed."
                        : "Ask your buddy to open Challenges once, then enter their SB- code.",
                    });
                  });
                }}
                data-testid="buddy-pair"
              >
                Pair
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
