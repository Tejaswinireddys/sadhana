import { useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { VoicePlayer } from "@/components/VoicePlayer";
import { ParentGate } from "@/components/ParentGate";
import { Confetti } from "@/components/Confetti";
import { EmptyState } from "@/components/EmptyState";
import { useKidsGate } from "@/context/KidsGateContext";
import { kidsPoseBySlug } from "@/data/kids";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { todayISO } from "@/lib/sadhana";
import { ArrowLeft, Check, Star } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Pressable } from "@/components/motion";

export default function KidsPose() {
  const { slug } = useParams();
  const { unlocked } = useKidsGate();
  const pose = kidsPoseBySlug(slug);
  useDocumentTitle(pose ? `${pose.title} · Kids · Sadhana` : "Kids story · Sadhana");
  const [done, setDone] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const finish = useMutation({
    mutationFn: async () => {
      // Award a sticker and log a kids session
      await apiRequest("POST", "/api/kids/stickers", { poseSlug: slug });
      await apiRequest("POST", "/api/sessions", {
        date: todayISO(),
        durationMinutes: 5,
        asanas: JSON.stringify([pose?.poseName ?? slug]),
        pathwaySlug: null,
        notes: `Kids story: ${pose?.title ?? slug}`,
        kind: "kids",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kids/stickers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      setDone(true);
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 2600);
    },
  });

  if (!pose) {
    return (
      <EmptyState title="Story not found" description="That yoga adventure isn't here.">
        <Button asChild>
          <Link href="/kids">Back to Kids</Link>
        </Button>
      </EmptyState>
    );
  }

  return (
    <>
      <ParentGate />
      {unlocked && (
        <div className="kids-zone animate-fade-in space-y-6 p-5 sm:p-8" data-testid={`kids-pose-${pose.slug}`}>
          <Confetti active={celebrate} />

          <Link
            href="/kids"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/70 hover:text-foreground"
            data-testid="link-back-kids"
          >
            <ArrowLeft className="h-4 w-4" /> All stories
          </Link>

          <div className="grid items-center gap-6 md:grid-cols-2">
            <div className="flex items-center justify-center rounded-2xl bg-[hsl(41_80%_88%)] p-6 dark:bg-white/5">
              <img
                src={`${import.meta.env.BASE_URL}kids/${pose.image}.png`}
                alt={pose.poseName}
                className="kids-bob h-64 w-64 object-contain"
                draggable={false}
                data-testid={`img-kids-${pose.slug}`}
              />
            </div>
            <div className="space-y-3">
              <h1 className="kids-title text-4xl font-bold leading-tight" data-testid="text-kids-story-title">
                {pose.title}
              </h1>
              <p className="text-lg font-semibold text-[hsl(16_72%_48%)]">
                {pose.poseName}
                {pose.sanskrit && (
                  <span className="ml-2 align-middle text-sm font-normal italic text-foreground/55">
                    {pose.sanskrit}
                  </span>
                )}
              </p>
              <div className="space-y-2 text-foreground/80">
                {pose.story.map((line, i) => (
                  <p key={i} className="text-base leading-relaxed">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* Story time audio */}
          <VoicePlayer src={`${import.meta.env.BASE_URL}voice/kids-${pose.slug}.mp3`} slug={pose.slug} label="Story time" />

          {/* I did it! */}
          <div className="flex flex-col items-center gap-4 pt-2">
            {done ? (
              <div className="flex flex-col items-center gap-2" data-testid="kids-celebration">
                <Star className="star-pop h-20 w-20 fill-[hsl(38_92%_60%)] text-[hsl(38_92%_50%)]" />
                <p className="kids-title text-2xl font-bold">
                  {pose.sticker ? `You earned the “${pose.sticker}” sticker! Hooray!` : "You earned a star! Hooray!"}
                </p>
                <Button
                  size="lg"
                  className="rounded-full bg-[hsl(92_35%_45%)] hover:bg-[hsl(92_35%_38%)]"
                  asChild
                  data-testid="button-next-story"
                >
                  <Link href="/kids">Pick another story</Link>
                </Button>
              </div>
            ) : (
              <Pressable>
                <Button
                  size="lg"
                  className="rounded-full bg-[hsl(16_72%_55%)] px-10 text-lg hover:bg-[hsl(16_72%_48%)]"
                  onClick={() => finish.mutate()}
                  disabled={finish.isPending}
                  data-testid="button-i-did-it"
                >
                  <Check className="mr-2 h-6 w-6" /> I did it!
                </Button>
              </Pressable>
            )}
          </div>
        </div>
      )}
    </>
  );
}
