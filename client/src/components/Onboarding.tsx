import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PROFILES } from "@/data/profiles";
import { asanaBySlug } from "@/data/content";
import { usePractice } from "@/context/PracticeContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { KEYS, writeString } from "@/lib/localPrefs";
import { resolveIcon } from "@/lib/icons";
import { MotionToggle } from "@/components/MotionToggle";
import { VoiceToggle } from "@/components/VoiceToggle";
import { Compass, Play, Sparkles } from "lucide-react";

const QUICK_START_POSES = [
  { slug: "balasana", holdSeconds: 60 },
  { slug: "paschimottanasana", holdSeconds: 60 },
  { slug: "viparita-karani", holdSeconds: 180 },
  { slug: "savasana", holdSeconds: 60 },
];

export function Onboarding({
  open,
  onDone,
}: {
  open: boolean;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { loadSession } = usePractice();
  const { data: active } = useQuery<{ profileId: string } | null>({
    queryKey: ["/api/profile/active"],
  });

  const activate = useMutation({
    mutationFn: (profileId: string) =>
      apiRequest("POST", "/api/profile/activate", { profileId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/profile/active"] }),
  });

  const hasPath = !!(pickedId || active?.profileId);

  const finish = (opts?: { goPractice?: boolean }) => {
    writeString(KEYS.onboardingDone, "1");
    onDone();
    if (opts?.goPractice) navigate("/guided");
  };

  const startQuick = () => {
    const poses = QUICK_START_POSES.map((p) => {
      const asana = asanaBySlug(p.slug);
      return asana ? { asana, holdSeconds: p.holdSeconds } : null;
    }).filter((x): x is { asana: NonNullable<ReturnType<typeof asanaBySlug>>; holdSeconds: number } => x != null);
    loadSession(poses, { label: "5 min · Welcome practice" });
    finish();
    navigate("/guided");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        data-testid="onboarding-dialog"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {step === 0 && "Welcome to Sadhana"}
            {step === 1 && "Try a 5-minute practice"}
            {step === 2 && "Make it yours"}
          </DialogTitle>
          <DialogDescription>
            {step === 0 && "Pick a path that fits your life — you can change it anytime."}
            {step === 1 && "A short guided flow to feel how sessions work."}
            {step === 2 && "Voice narration and soft motion — toggle what feels calm."}
          </DialogDescription>
        </DialogHeader>

        {step === 0 && (
          <div className="grid max-h-[50vh] gap-2 overflow-y-auto">
            {PROFILES.slice(0, 6).map((p) => {
              const Icon = resolveIcon(p.icon);
              const selected = (pickedId ?? active?.profileId) === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPickedId(p.id);
                    activate.mutate(p.id);
                  }}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/40 ${
                    selected ? "border-primary bg-accent/30" : "border-border"
                  }`}
                  data-testid={`onboarding-profile-${p.id}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.tagline}</span>
                  </span>
                </button>
              );
            })}
            <Button
              className="mt-2"
              onClick={() => setStep(1)}
              disabled={!hasPath}
              data-testid="onboarding-next-1"
            >
              <Compass className="mr-1.5 h-4 w-4" /> Continue
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setStep(1)} data-testid="onboarding-skip-path">
              Skip for now
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Child's Pose → Forward Fold → Legs-Up-the-Wall → Rest. About five minutes with
              voice guidance.
            </p>
            <Button className="w-full" onClick={startQuick} data-testid="onboarding-start-quick">
              <Play className="mr-1.5 h-4 w-4" /> Begin welcome practice
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setStep(2)}
              data-testid="onboarding-skip-practice"
            >
              Maybe later — continue setup
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-3">
              <VoiceToggle />
            </div>
            <div className="rounded-lg border border-border p-3">
              <MotionToggle />
            </div>
            <Button
              className="w-full"
              onClick={() => finish({ goPractice: true })}
              data-testid="onboarding-finish"
            >
              <Sparkles className="mr-1.5 h-4 w-4" /> Start practice
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">Step {step + 1} of 3</p>
      </DialogContent>
    </Dialog>
  );
}
