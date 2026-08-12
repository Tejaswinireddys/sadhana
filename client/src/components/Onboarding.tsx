/**
 * Onboarding — first-run personalization that beats account-wall apps (e.g. Glo).
 *
 * Glo’s /onboarding is essentially “sign in to start.” Sadhana leads with brand,
 * a clear life-path, and a free guided practice — no email required.
 */
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
import { LotusMark } from "@/components/Logo";
import { FadeIn } from "@/components/motion";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Compass,
  Play,
  Sparkles,
  Heart,
  ShieldCheck,
} from "lucide-react";

const QUICK_START_POSES = [
  { slug: "balasana", holdSeconds: 60 },
  { slug: "paschimottanasana", holdSeconds: 60 },
  { slug: "viparita-karani", holdSeconds: 180 },
  { slug: "savasana", holdSeconds: 60 },
];

/** Primary paths first — less overwhelm than a long scroll. */
const PRIMARY_PATH_IDS = [
  "busy-mom",
  "stress-relief",
  "better-sleep",
  "working-professional",
  "mens-strength",
  "womens-wellness",
];

const MORE_PATH_IDS = ["pregnancy", "flexibility-splits"];

const STEP_LABELS = ["Your path", "First practice", "Your setup"] as const;

export function Onboarding({
  open,
  onDone,
}: {
  open: boolean;
  onDone: () => void;
}) {
  useDocumentTitle(open ? "Welcome · Sadhana" : "Sadhana");
  const [step, setStep] = useState(0);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [showMorePaths, setShowMorePaths] = useState(false);
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

  const activeId = pickedId ?? active?.profileId ?? null;
  const hasPath = !!activeId;
  const pickedProfile = PROFILES.find((p) => p.id === activeId);

  const pathIds = showMorePaths
    ? [...PRIMARY_PATH_IDS, ...MORE_PATH_IDS]
    : PRIMARY_PATH_IDS;
  const featuredProfiles = pathIds
    .map((id) => PROFILES.find((p) => p.id === id))
    .filter(Boolean) as typeof PROFILES;

  const finish = (opts?: { goPractice?: boolean; goLibrary?: boolean }) => {
    writeString(KEYS.onboardingDone, "1");
    onDone();
    if (opts?.goPractice) navigate("/guided");
    else if (opts?.goLibrary) navigate("/asanas");
  };

  const startQuick = () => {
    const poses = QUICK_START_POSES.map((p) => {
      const asana = asanaBySlug(p.slug);
      return asana ? { asana, holdSeconds: p.holdSeconds } : null;
    }).filter(
      (x): x is { asana: NonNullable<ReturnType<typeof asanaBySlug>>; holdSeconds: number } =>
        x != null,
    );
    loadSession(poses, { label: "Welcome practice", plannedMinutes: 5 });
    finish();
    navigate("/guided");
  };

  const pickPath = (id: string) => {
    setPickedId(id);
    activate.mutate(id);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent
        className="max-h-[92vh] overflow-hidden border-border/60 bg-card p-0 sm:max-w-lg"
        data-testid="onboarding-dialog"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Brand atmosphere — Glo leads with login; we lead with Sadhana */}
        <div className="relative overflow-hidden border-b border-border/50 bg-gradient-to-br from-primary/15 via-accent/40 to-background px-5 pb-4 pt-6 sm:px-6">
          <div
            className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-primary/10 blur-2xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-12 left-8 h-28 w-28 rounded-full bg-secondary/15 blur-2xl"
            aria-hidden
          />
          <div className="relative flex items-center gap-2.5">
            <LotusMark size={32} className="text-primary" />
            <p className="font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
              Sadhana
            </p>
          </div>
          <p className="relative mt-1.5 max-w-sm text-sm text-muted-foreground">
            A daily dedicated practice — free to start, no account wall.
          </p>

          {/* Step progress */}
          <ol
            className="relative mt-4 flex gap-1.5"
            aria-label={`Step ${step + 1} of 3`}
          >
            {STEP_LABELS.map((label, i) => (
              <li key={label} className="min-w-0 flex-1">
                <div
                  className={cn(
                    "h-1 rounded-full transition-colors duration-500",
                    i <= step ? "bg-primary" : "bg-border",
                  )}
                />
                <p
                  className={cn(
                    "mt-1.5 truncate text-[10px] font-medium uppercase tracking-wide",
                    i === step ? "text-primary" : "text-muted-foreground/70",
                  )}
                >
                  {label}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <div className="max-h-[min(58vh,28rem)] overflow-y-auto px-5 py-4 sm:px-6">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">
              {step === 0 && "What brings you to the mat?"}
              {step === 1 && "Feel how practice works"}
              {step === 2 && "Make it calm for you"}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {step === 0 &&
                "Pick a path — we’ll tune recommendations. Change anytime. No signup required."}
              {step === 1 &&
                "A five-minute guided flow. Move first — other apps ask for email before you breathe."}
              {step === 2 && "Voice cues and soft motion. Toggle what feels right, then begin."}
            </DialogDescription>
          </DialogHeader>

          {step === 0 && (
            <FadeIn key="step-0" className="mt-4 space-y-3" delay={0.05}>
              <p className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-2.5 py-1 text-[11px] font-medium text-foreground/80">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
                Practice as a guest — account optional later
              </p>

              <div className="grid gap-2" role="listbox" aria-label="Practice paths">
                {featuredProfiles.map((p, idx) => {
                  const Icon = resolveIcon(p.icon);
                  const selected = activeId === p.id;
                  return (
                    <FadeIn key={p.id} delay={0.04 + idx * 0.03}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => pickPath(p.id)}
                        className={cn(
                          "flex w-full min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-all duration-300",
                          selected
                            ? "border-primary bg-accent/40 shadow-sm"
                            : "border-border/80 hover:border-primary/30 hover:bg-accent/25",
                        )}
                        data-testid={`onboarding-profile-${p.id}`}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium text-foreground">{p.name}</span>
                          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                            {p.tagline}
                          </span>
                        </span>
                      </button>
                    </FadeIn>
                  );
                })}
              </div>

              {!showMorePaths && (
                <button
                  type="button"
                  onClick={() => setShowMorePaths(true)}
                  className="flex w-full min-h-10 cursor-pointer items-center justify-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  data-testid="onboarding-more-paths"
                >
                  Pregnancy, flexibility & more
                  <ChevronDown className="h-4 w-4" />
                </button>
              )}

              <Button
                className="min-h-12 w-full cursor-pointer gap-2 rounded-full text-base"
                onClick={() => setStep(1)}
                disabled={!hasPath}
                data-testid="onboarding-next-1"
              >
                <Compass className="h-4 w-4" />
                Continue{pickedProfile ? ` · ${pickedProfile.name}` : ""}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11 w-full cursor-pointer"
                onClick={() => setStep(1)}
                data-testid="onboarding-skip-path"
              >
                Skip for now
              </Button>
            </FadeIn>
          )}

          {step === 1 && (
            <FadeIn key="step-1" className="mt-4 space-y-4" delay={0.05}>
              {pickedProfile && (
                <p className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm text-foreground/85">
                  Path: <span className="font-medium">{pickedProfile.name}</span>
                  <span className="text-muted-foreground">
                    {" · "}~{pickedProfile.minutesPerSession} min sessions when you settle in
                  </span>
                </p>
              )}

              <div className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-accent/50 to-muted/20 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                  Welcome flow · ~5 min
                </p>
                <p className="mt-2 font-serif text-lg text-foreground">
                  Child&apos;s Pose → Forward Fold → Legs-Up-the-Wall → Rest
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Voice-guided on the mat — the fastest way to feel Sadhana.
                </p>
                <ul className="mt-3 flex gap-2 overflow-x-auto pb-0.5" aria-hidden>
                  {QUICK_START_POSES.map((p) => (
                    <li
                      key={p.slug}
                      className="h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-border/50 bg-card"
                    >
                      <img loading="lazy" width={600} height={1200}
                        src={`${import.meta.env.BASE_URL}poses/${p.slug}.png`}
                        alt=""
                        className="h-full w-full object-cover object-top"
                      />
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                className="min-h-12 w-full cursor-pointer gap-2 rounded-full text-base"
                onClick={startQuick}
                data-testid="onboarding-start-quick"
              >
                <Play className="mr-0.5 h-4 w-4 fill-current" /> Begin welcome practice
              </Button>
              <Button
                variant="outline"
                className="min-h-11 w-full cursor-pointer rounded-full"
                onClick={() => setStep(2)}
                data-testid="onboarding-skip-practice"
              >
                Maybe later — finish setup
              </Button>
            </FadeIn>
          )}

          {step === 2 && (
            <FadeIn key="step-2" className="mt-4 space-y-4" delay={0.05}>
              <div className="space-y-2">
                <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                  <VoiceToggle />
                </div>
                <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                  <MotionToggle />
                </div>
              </div>

              <Button
                className="min-h-12 w-full cursor-pointer gap-2 rounded-full text-base"
                onClick={() => finish({ goPractice: true })}
                data-testid="onboarding-finish"
              >
                <Sparkles className="h-4 w-4" /> Start practice
              </Button>
              <Button
                variant="outline"
                className="min-h-11 w-full cursor-pointer rounded-full"
                onClick={() => finish({ goLibrary: true })}
                data-testid="onboarding-explore-library"
              >
                <Heart className="h-4 w-4" /> Explore the pose library
              </Button>
            </FadeIn>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
