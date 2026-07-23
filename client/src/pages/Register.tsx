import { type FormEvent, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo, LotusMark } from "@/components/Logo";
import { FadeIn, Reveal } from "@/components/motion";
import { KEYS, writeString } from "@/lib/localPrefs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PROFILES } from "@/data/profiles";
import { resolveIcon } from "@/lib/icons";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { ArrowRight, ArrowDown } from "lucide-react";

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

const HERO_SRC = `${import.meta.env.BASE_URL}poses/adho-mukha-svanasana.png`;

export default function Register() {
  useDocumentTitle("Create your practice · Sadhana");
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const featuredProfiles = useMemo(
    () =>
      FEATURED_PROFILE_IDS.map((id) => PROFILES.find((p) => p.id === id)).filter(
        (p): p is (typeof PROFILES)[number] => Boolean(p),
      ),
    [],
  );

  const activate = useMutation({
    mutationFn: (id: string) => apiRequest("POST", "/api/profile/activate", { profileId: id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/profile/active"] }),
  });

  const enterApp = async (opts: { withSetup: boolean }) => {
    setError(null);
    setSubmitting(true);
    try {
      const trimmed = name.trim();
      if (opts.withSetup && trimmed) {
        writeString(KEYS.practitionerName, trimmed);
      }
      if (opts.withSetup && profileId) {
        await activate.mutateAsync(profileId);
      }
      writeString(KEYS.welcomeSeen, "1");
      if (opts.withSetup) {
        writeString(KEYS.onboardingDone, "1");
      }
      navigate("/");
    } catch (e) {
      setError((e as Error).message || "Could not finish setup. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void enterApp({ withSetup: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#create-practice"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to create practice
      </a>

      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 md:px-6">
          <Link href="/register" className="cursor-pointer text-primary-foreground" aria-label="Sadhana home">
            <span className="flex items-center gap-2 drop-shadow-sm">
              <LotusMark size={26} />
              <span className="font-serif text-xl font-semibold tracking-tight">Sadhana</span>
            </span>
          </Link>
          <Button
            variant="ghost"
            className="min-h-11 cursor-pointer text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            asChild
          >
            <Link href="/welcome">About</Link>
          </Button>
        </div>
      </header>

      <main>
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
                Create your practice
              </h1>
              <p className="max-w-md text-base leading-relaxed text-primary-foreground/85 md:text-lg">
                A quiet place to begin — choose a name and path, then step onto the mat when you are ready.
              </p>
              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  className="min-h-12 cursor-pointer bg-primary-foreground text-foreground hover:bg-primary-foreground/90"
                  asChild
                >
                  <a href="#create-practice" data-testid="register-cta-hero">
                    Begin setup <ArrowDown className="ml-1.5 h-4 w-4" />
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="min-h-12 cursor-pointer border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  onClick={() => void enterApp({ withSetup: false })}
                  disabled={submitting}
                  data-testid="register-cta-skip"
                >
                  Continue without setup
                </Button>
              </div>
            </FadeIn>
          </div>
        </section>

        <section
          id="create-practice"
          className="relative border-t border-border/50 bg-[radial-gradient(ellipse_at_top,_hsl(var(--secondary)/0.12),_transparent_55%),hsl(var(--background))]"
        >
          <div className="mx-auto max-w-xl px-4 py-16 md:px-6 md:py-20">
            <Reveal className="mb-8 space-y-2">
              <div className="mb-4">
                <Logo />
              </div>
              <h2 className="font-serif text-3xl font-semibold tracking-tight">Your practice identity</h2>
              <p className="text-muted-foreground">
                No password or email — your practice stays on this device. Add a name and path so Home
                greets you clearly.
              </p>
            </Reveal>

            <form
              onSubmit={onSubmit}
              className="surface space-y-6 p-5 md:p-6"
              data-testid="register-form"
              noValidate
            >
              <div className="space-y-2">
                <Label htmlFor="practitioner-name">Your name</Label>
                <Input
                  id="practitioner-name"
                  name="name"
                  autoComplete="name"
                  placeholder="How should we greet you?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="min-h-11"
                  maxLength={48}
                  data-testid="register-name"
                />
                <p className="text-xs text-muted-foreground">Optional — you can change this later in Settings.</p>
              </div>

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Choose a starting path</legend>
                <p className="text-xs text-muted-foreground">
                  Pick what fits today. You can switch profiles anytime.
                </p>
                <div className="grid max-h-[min(50vh,22rem)] gap-2 overflow-y-auto pr-1">
                  {featuredProfiles.map((p) => {
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
              </fieldset>

              {error && (
                <p className="text-sm text-destructive" role="alert" data-testid="register-error">
                  {error}
                </p>
              )}

              <div className="flex flex-col gap-3">
                <Button
                  type="submit"
                  size="lg"
                  className="min-h-12 w-full cursor-pointer"
                  disabled={submitting || activate.isPending}
                  data-testid="register-submit"
                >
                  {submitting || activate.isPending ? "Creating…" : "Create my practice"}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Prefer the full product tour?{" "}
                  <Link href="/welcome" className="underline-offset-2 hover:underline">
                    Visit the welcome page
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
          <p>Sadhana — a daily, dedicated practice.</p>
          <Link href="/welcome" className="hover:text-foreground">
            About Sadhana
          </Link>
        </div>
      </footer>
    </div>
  );
}
