import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Logo, LotusMark } from "@/components/Logo";
import { FadeIn } from "@/components/motion";
import {
  KEYS,
  readString,
  writeJson,
  writeString,
  type ExperienceLevel,
  type PracticeIntent,
  type ReminderPrefs,
} from "@/lib/localPrefs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PROFILES } from "@/data/profiles";
import { resolveIcon } from "@/lib/icons";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import type { Preferences } from "@shared/schema";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  Moon,
  Sparkles,
  Waves,
} from "lucide-react";

const FEATURED_PROFILE_IDS = [
  "stress-relief",
  "busy-mom",
  "better-sleep",
  "working-professional",
  "mens-strength",
  "womens-wellness",
  "pregnancy",
  "flexibility-splits",
] as const;

const INTENTS: { id: PracticeIntent; label: string; hint: string; icon: typeof Waves }[] = [
  { id: "calm", label: "Find calm", hint: "Soft shapes and longer exhales", icon: Waves },
  { id: "strength", label: "Build strength", hint: "Steady standing and core work", icon: Sparkles },
  { id: "flexibility", label: "Open and stretch", hint: "Hips, hamstrings, and length", icon: Compass },
  { id: "sleep", label: "Sleep better", hint: "Evening wind-down rituals", icon: Moon },
  { id: "explore", label: "Just explore", hint: "Browse poses and try what fits", icon: Compass },
];

const EXPERIENCE: { id: ExperienceLevel; label: string; hint: string }[] = [
  { id: "new", label: "New to yoga", hint: "Gentle cues, props, and short sessions" },
  { id: "some", label: "Some experience", hint: "Familiar basics, ready to deepen" },
  { id: "regular", label: "I practice regularly", hint: "Full library and longer holds" },
];

const INTENT_TO_PROFILE: Partial<Record<PracticeIntent, string>> = {
  calm: "stress-relief",
  strength: "weight-loss-energy",
  flexibility: "flexibility-splits",
  sleep: "better-sleep",
  explore: "working-professional",
};

type PathAudience = "all" | "everyday" | "men" | "women" | "pregnancy";

const PATH_AUDIENCE_FILTERS: { id: PathAudience; label: string }[] = [
  { id: "all", label: "All paths" },
  { id: "everyday", label: "Everyday" },
  { id: "men", label: "Men" },
  { id: "women", label: "Women" },
  { id: "pregnancy", label: "Pregnancy" },
];

const PATH_AUDIENCE_PROFILE: Partial<Record<PathAudience, string>> = {
  men: "mens-strength",
  women: "womens-wellness",
  pregnancy: "pregnancy",
};

function matchesPathAudience(
  profile: (typeof PROFILES)[number],
  audience: PathAudience,
): boolean {
  if (audience === "all") return true;
  if (audience === "men") return profile.id === "mens-strength";
  if (audience === "women") return profile.id === "womens-wellness";
  if (audience === "pregnancy") return profile.id === "pregnancy";
  return !["mens-strength", "womens-wellness", "pregnancy"].includes(profile.id);
}

const HERO_SRC = `${import.meta.env.BASE_URL}poses/adho-mukha-svanasana.png`;
const TOTAL_STEPS = 6; // 0 welcome … 5 confirm
const DEFAULT_REMINDER: ReminderPrefs = { enabled: true, hour: 18, notifications: false };

type Step = 0 | 1 | 2 | 3 | 4 | 5;

const STEP_TITLES: Record<Step, string> = {
  0: "Welcome",
  1: "Your intent",
  2: "Your name",
  3: "Your path",
  4: "Your pace",
  5: "Preferences",
};

function ProgressHeader({ step }: { step: Step }) {
  if (step === 0) return null;
  const pct = Math.round((step / (TOTAL_STEPS - 1)) * 100);
  return (
    <div className="mb-8 space-y-3" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="font-medium text-foreground">
          Step {step} of {TOTAL_STEPS - 1}
          <span className="text-muted-foreground"> · {STEP_TITLES[step]}</span>
        </p>
        <p className="tabular-nums text-muted-foreground">{pct}%</p>
      </div>
      <Progress value={pct} className="h-1.5" aria-label={`Registration progress ${pct}%`} />
    </div>
  );
}

export default function Register() {
  useDocumentTitle("Create your practice · Sadhana");
  const [, navigate] = useLocation();
  const returning = !!readString(KEYS.onboardingDone);

  const [step, setStep] = useState<Step>(0);
  const [intent, setIntent] = useState<PracticeIntent | null>(
    () => (readString(KEYS.practiceIntent) as PracticeIntent | null) ?? null,
  );
  const [name, setName] = useState(() => readString(KEYS.practitionerName) ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [pathAudience, setPathAudience] = useState<PathAudience>("all");
  const [experience, setExperience] = useState<ExperienceLevel | null>(
    () => (readString(KEYS.experienceLevel) as ExperienceLevel | null) ?? null,
  );
  const [voiceOn, setVoiceOn] = useState(true);
  const [motionOn, setMotionOn] = useState(true);
  const [reminderOn, setReminderOn] = useState(true);
  const [reminderHour, setReminderHour] = useState(18);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: prefs } = useQuery<Preferences>({
    queryKey: ["/api/preferences"],
    enabled: step >= 5,
  });
  const prefsSeeded = useRef(false);

  useEffect(() => {
    if (!prefs || prefsSeeded.current) return;
    prefsSeeded.current = true;
    setVoiceOn(prefs.voiceEnabled === 1);
    setMotionOn(prefs.motionEnabled === 1);
  }, [prefs]);

  const featuredProfiles = useMemo(
    () =>
      FEATURED_PROFILE_IDS.map((id) => PROFILES.find((p) => p.id === id)).filter(
        (p): p is (typeof PROFILES)[number] => Boolean(p),
      ),
    [],
  );

  const visiblePathProfiles = useMemo(
    () => featuredProfiles.filter((p) => matchesPathAudience(p, pathAudience)),
    [featuredProfiles, pathAudience],
  );

  const selectedProfile = profileId ? PROFILES.find((p) => p.id === profileId) : null;

  const activate = useMutation({
    mutationFn: (id: string) => apiRequest("POST", "/api/profile/activate", { profileId: id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/profile/active"] }),
  });

  const go = (next: Step) => {
    setError(null);
    setNameError(null);
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pickIntent = (id: PracticeIntent) => {
    setIntent(id);
    if (!profileId) {
      const suggested = INTENT_TO_PROFILE[id];
      if (suggested) setProfileId(suggested);
    }
  };

  const pickPathAudience = (audience: PathAudience) => {
    setPathAudience(audience);
    const locked = PATH_AUDIENCE_PROFILE[audience];
    if (locked) {
      setProfileId(locked);
      return;
    }
    // Leaving Men/Women/Pregnancy — keep current pick only if it still matches.
    setProfileId((current) => {
      if (!current) return current;
      const profile = PROFILES.find((p) => p.id === current);
      if (profile && matchesPathAudience(profile, audience)) return current;
      return INTENT_TO_PROFILE[intent ?? "explore"] ?? "working-professional";
    });
  };

  const validateName = () => {
    const trimmed = name.trim();
    if (trimmed.length > 0 && trimmed.length < 2) {
      setNameError("Use at least 2 characters, or leave blank for now.");
      return false;
    }
    setNameError(null);
    return true;
  };

  const enterWithoutSetup = () => {
    writeString(KEYS.welcomeSeen, "1");
    // Leave onboardingDone unset so the in-app tour can still help.
    navigate("/");
  };

  const finish = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const trimmed = name.trim();
      if (trimmed) writeString(KEYS.practitionerName, trimmed);
      if (intent) writeString(KEYS.practiceIntent, intent);
      if (experience) writeString(KEYS.experienceLevel, experience);

      if (profileId) {
        await activate.mutateAsync(profileId);
      }

      await apiRequest("PATCH", "/api/preferences", {
        voiceEnabled: voiceOn ? 1 : 0,
        motionEnabled: motionOn ? 1 : 0,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/preferences"] });

      writeJson<ReminderPrefs>(KEYS.reminder, {
        ...DEFAULT_REMINDER,
        enabled: reminderOn,
        hour: reminderHour,
      });

      writeString(KEYS.welcomeSeen, "1");
      writeString(KEYS.onboardingDone, "1");
      navigate("/");
    } catch (e) {
      setError((e as Error).message || "Could not finish setup. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const canContinueFromPath = !!profileId;
  const canContinueFromExperience = !!experience;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#register-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to registration
      </a>

      <header className={`inset-x-0 top-0 z-20 ${step === 0 ? "absolute" : "sticky border-b border-border/60 bg-background/90 backdrop-blur"}`}>
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 md:px-6">
          <Link
            href="/register"
            className={`cursor-pointer ${step === 0 ? "text-primary-foreground" : ""}`}
            aria-label="Sadhana home"
            onClick={() => go(0)}
          >
            <span className={`flex items-center gap-2 ${step === 0 ? "drop-shadow-sm" : ""}`}>
              {step === 0 ? <LotusMark size={26} /> : null}
              {step === 0 ? (
                <span className="font-serif text-xl font-semibold tracking-tight">Sadhana</span>
              ) : (
                <Logo />
              )}
            </span>
          </Link>
          <Button
            variant="ghost"
            className={`min-h-11 cursor-pointer ${
              step === 0
                ? "text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                : ""
            }`}
            asChild
          >
            <Link href="/welcome">About</Link>
          </Button>
        </div>
      </header>

      <main id="register-main">
        {step === 0 && (
          <section className="relative min-h-[100svh] overflow-hidden">
            <img
              src={HERO_SRC}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
              width={1200}
              height={1600}
              decoding="async"
              fetchPriority="high"
              aria-hidden
            />
            <div
              className="absolute inset-0 bg-[linear-gradient(180deg,hsl(30_18%_12%/0.45)_0%,hsl(30_18%_12%/0.28)_38%,hsl(30_18%_12%/0.72)_100%)]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_80%,hsl(var(--primary)/0.28),transparent_55%)]"
              aria-hidden
            />

            <div className="relative mx-auto flex min-h-[100svh] max-w-5xl flex-col justify-end px-4 pb-16 pt-28 md:justify-center md:px-6 md:pb-24 md:pt-24">
              <FadeIn className="max-w-xl space-y-5 text-primary-foreground">
                <p className="font-serif text-4xl font-semibold tracking-tight md:text-6xl" data-testid="register-brand">
                  Sadhana
                </p>
                <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
                  {returning ? "Update your practice" : "Create your practice"}
                </h1>
                <p className="max-w-md text-base leading-relaxed text-primary-foreground/85 md:text-lg">
                  A short guided setup — intent, name, path, and preferences — so Home greets you
                  clearly. No email or password; everything stays on this device.
                </p>
                <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
                  <Button
                    size="lg"
                    className="min-h-12 cursor-pointer bg-primary-foreground text-foreground hover:bg-primary-foreground/90"
                    onClick={() => go(1)}
                    data-testid="register-cta-begin"
                  >
                    {returning ? "Continue setup" : "Begin setup"} <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                  {!returning && (
                    <Button
                      size="lg"
                      variant="outline"
                      className="min-h-12 cursor-pointer border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                      onClick={enterWithoutSetup}
                      data-testid="register-cta-skip"
                    >
                      Explore first
                    </Button>
                  )}
                </div>
                <p className="text-sm text-primary-foreground/70">About 1 minute · 5 steps after this</p>
              </FadeIn>
            </div>
          </section>
        )}

        {step > 0 && (
          <section className="relative border-t border-border/50 bg-[radial-gradient(ellipse_at_top,_hsl(var(--secondary)/0.12),_transparent_55%),hsl(var(--background))]">
            <div className="mx-auto max-w-xl px-4 py-10 md:px-6 md:py-14">
              <ProgressHeader step={step} />

              <FadeIn key={step} className="space-y-6">
                {step === 1 && (
                  <>
                    <header className="space-y-2">
                      <h2 className="font-serif text-3xl font-semibold tracking-tight">What brings you here?</h2>
                      <p className="text-muted-foreground">
                        Pick one focus for now — you can change paths anytime.
                      </p>
                    </header>
                    <div className="grid gap-2" role="listbox" aria-label="Practice intent">
                      {INTENTS.map((item) => {
                        const Icon = item.icon;
                        const selected = intent === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onClick={() => pickIntent(item.id)}
                            className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/40 ${
                              selected ? "border-primary bg-accent/30" : "border-border"
                            }`}
                            data-testid={`register-intent-${item.id}`}
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <Icon className="h-4 w-4" />
                            </span>
                            <span>
                              <span className="block font-medium">{item.label}</span>
                              <span className="text-xs text-muted-foreground">{item.hint}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                      <Button variant="ghost" className="min-h-11 cursor-pointer" onClick={() => go(0)}>
                        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                      </Button>
                      <Button
                        className="min-h-11 cursor-pointer"
                        disabled={!intent}
                        onClick={() => go(2)}
                        data-testid="register-next-intent"
                      >
                        Continue <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <header className="space-y-2">
                      <h2 className="font-serif text-3xl font-semibold tracking-tight">What should we call you?</h2>
                      <p className="text-muted-foreground">
                        Optional — Home can greet you by name. Change it later in Settings.
                      </p>
                    </header>
                    <div className="space-y-2">
                      <Label htmlFor="practitioner-name">Your name</Label>
                      <Input
                        id="practitioner-name"
                        name="name"
                        autoComplete="name"
                        autoFocus
                        placeholder="How should we greet you?"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (nameError) setNameError(null);
                        }}
                        onBlur={() => validateName()}
                        className="min-h-11"
                        maxLength={48}
                        aria-invalid={!!nameError}
                        aria-describedby={nameError ? "name-error" : undefined}
                        data-testid="register-name"
                      />
                      {nameError ? (
                        <p id="name-error" className="text-sm text-destructive" role="alert">
                          {nameError}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">2–48 characters if you add one.</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                      <Button variant="ghost" className="min-h-11 cursor-pointer" onClick={() => go(1)}>
                        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                      </Button>
                      <Button
                        className="min-h-11 cursor-pointer"
                        onClick={() => {
                          if (!validateName()) return;
                          go(3);
                        }}
                        data-testid="register-next-name"
                      >
                        Continue <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <header className="space-y-2">
                      <h2 className="font-serif text-3xl font-semibold tracking-tight">Choose a starting path</h2>
                      <p className="text-muted-foreground">
                        Pick Men, Women, Pregnancy, or an everyday goal — this shapes Home recommendations.
                        Switch anytime from My path.
                      </p>
                    </header>
                    <div
                      className="flex flex-wrap gap-2"
                      role="group"
                      aria-label="Filter paths by audience"
                    >
                      {PATH_AUDIENCE_FILTERS.map((f) => {
                        const on = pathAudience === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => pickPathAudience(f.id)}
                            className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-medium transition-colors ${
                              on
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card text-foreground hover:bg-accent/40"
                            }`}
                            data-testid={`register-audience-${f.id}`}
                          >
                            {f.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid max-h-[min(52vh,24rem)] gap-2 overflow-y-auto pr-1">
                      {visiblePathProfiles.map((p) => {
                        const Icon = resolveIcon(p.icon);
                        const selected = profileId === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setProfileId(p.id)}
                            className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/40 ${
                              selected ? "border-primary bg-accent/30" : "border-border"
                            }`}
                            aria-pressed={selected}
                            data-testid={`register-profile-${p.id}`}
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
                    </div>
                    {pathAudience === "men" && (
                      <p className="text-sm text-muted-foreground" data-testid="register-men-hint">
                        Men’s path selected — athletic hips, chest mobility, and strength-friendly recovery.
                      </p>
                    )}
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                      <Button variant="ghost" className="min-h-11 cursor-pointer" onClick={() => go(2)}>
                        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                      </Button>
                      <Button
                        className="min-h-11 cursor-pointer"
                        disabled={!canContinueFromPath}
                        onClick={() => go(4)}
                        data-testid="register-next-path"
                      >
                        Continue <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}

                {step === 4 && (
                  <>
                    <header className="space-y-2">
                      <h2 className="font-serif text-3xl font-semibold tracking-tight">Where are you starting?</h2>
                      <p className="text-muted-foreground">
                        Helps us keep cues gentle or let you go deeper — no judgment.
                      </p>
                    </header>
                    <div className="grid gap-2" role="listbox" aria-label="Experience level">
                      {EXPERIENCE.map((item) => {
                        const selected = experience === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onClick={() => setExperience(item.id)}
                            className={`flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-left transition-colors hover:bg-accent/40 ${
                              selected ? "border-primary bg-accent/30" : "border-border"
                            }`}
                            data-testid={`register-experience-${item.id}`}
                          >
                            <span className="font-medium">{item.label}</span>
                            <span className="text-xs text-muted-foreground">{item.hint}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                      <Button variant="ghost" className="min-h-11 cursor-pointer" onClick={() => go(3)}>
                        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                      </Button>
                      <Button
                        className="min-h-11 cursor-pointer"
                        disabled={!canContinueFromExperience}
                        onClick={() => go(5)}
                        data-testid="register-next-experience"
                      >
                        Continue <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}

                {step === 5 && (
                  <>
                    <header className="space-y-2">
                      <h2 className="font-serif text-3xl font-semibold tracking-tight">Make it feel right</h2>
                      <p className="text-muted-foreground">
                        Voice, motion, and a gentle evening nudge — all adjustable later.
                      </p>
                    </header>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                        <div>
                          <p className="font-medium">Voice guidance</p>
                          <p className="text-xs text-muted-foreground">Calm narration during guided sessions</p>
                        </div>
                        <Switch
                          checked={voiceOn}
                          onCheckedChange={setVoiceOn}
                          aria-label="Voice guidance"
                          data-testid="register-voice"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                        <div>
                          <p className="font-medium">Soft motion</p>
                          <p className="text-xs text-muted-foreground">Subtle pose and breath animations</p>
                        </div>
                        <Switch
                          checked={motionOn}
                          onCheckedChange={setMotionOn}
                          aria-label="Soft motion"
                          data-testid="register-motion"
                        />
                      </div>
                      <div className="space-y-3 rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">Evening practice nudge</p>
                            <p className="text-xs text-muted-foreground">In-app reminder when the tab is open</p>
                          </div>
                          <Switch
                            checked={reminderOn}
                            onCheckedChange={setReminderOn}
                            aria-label="Evening practice nudge"
                            data-testid="register-reminder"
                          />
                        </div>
                        {reminderOn && (
                          <div className="flex items-center gap-3">
                            <Label htmlFor="register-reminder-hour" className="shrink-0 text-sm">
                              After
                            </Label>
                            <Input
                              id="register-reminder-hour"
                              type="number"
                              min={0}
                              max={23}
                              value={reminderHour}
                              onChange={(e) =>
                                setReminderHour(Math.min(23, Math.max(0, Number(e.target.value) || 0)))
                              }
                              className="min-h-11 w-20"
                              data-testid="register-reminder-hour"
                            />
                            <span className="text-sm text-muted-foreground">:00 local</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 rounded-lg border border-border/70 bg-muted/25 p-4">
                      <p className="text-sm font-medium">Ready to create</p>
                      <ul className="space-y-1.5 text-sm text-muted-foreground">
                        <li className="flex gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          {name.trim() ? `Greet as ${name.trim()}` : "No display name yet"}
                        </li>
                        <li className="flex gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          Path: {selectedProfile?.name ?? "None selected"}
                        </li>
                        <li className="flex gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          Intent: {INTENTS.find((i) => i.id === intent)?.label ?? "—"} ·{" "}
                          {EXPERIENCE.find((e) => e.id === experience)?.label ?? "—"}
                        </li>
                      </ul>
                      <p className="text-xs text-muted-foreground">
                        No account email — practice data stays with this browser via device identity.
                      </p>
                    </div>

                    {error && (
                      <p className="text-sm text-destructive" role="alert" data-testid="register-error">
                        {error}
                      </p>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                      <Button
                        variant="ghost"
                        className="min-h-11 cursor-pointer"
                        onClick={() => go(4)}
                        disabled={submitting}
                      >
                        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                      </Button>
                      <Button
                        size="lg"
                        className="min-h-12 cursor-pointer"
                        disabled={submitting || activate.isPending || !profileId}
                        onClick={() => void finish()}
                        data-testid="register-submit"
                      >
                        {submitting || activate.isPending ? "Creating…" : "Create my practice"}
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </FadeIn>
            </div>
          </section>
        )}
      </main>

      {step > 0 && (
        <footer className="border-t border-border/60 py-8">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
            <p>Sadhana — a daily, dedicated practice.</p>
            <Link href="/welcome" className="hover:text-foreground">
              About Sadhana
            </Link>
          </div>
        </footer>
      )}
    </div>
  );
}
