import { Link } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LotusMark } from "@/components/Logo";
import { KEYS, writeString } from "@/lib/localPrefs";
import { FadeIn, Reveal } from "@/components/motion";
import {
  ArrowRight,
  BookOpen,
  Compass,
  Play,
  Smile,
  UserRound,
} from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const ProductDemoVideo = lazy(() =>
  import("@/components/ProductDemoVideo").then((m) => ({ default: m.ProductDemoVideo })),
);

const HERO_SRC = `${import.meta.env.BASE_URL}poses/vrksasana.png`;

const FEATURES = [
  {
    icon: BookOpen,
    title: "200+ illustrated poses",
    body: "English-first guides with Sanskrit names, step-by-step cues, variations, and contraindications.",
  },
  {
    icon: Play,
    title: "Guided voice sessions",
    body: "Build a sequence or tap Yoga Trainer — listen as you move, at your own pace.",
  },
  {
    icon: Compass,
    title: "Paths that fit your life",
    body: "Profiles for everyday goals, men, women, and pregnancy — plus multi-week pathways.",
  },
  {
    icon: Smile,
    title: "Kids stories & breath",
    body: "Parent-gated animal poses and playful breathing games with stickers.",
  },
];

const STEPS = [
  { n: "1", title: "Choose how you feel", body: "Trainer, mood quick-starts, or a practice profile." },
  { n: "2", title: "Follow the guide", body: "Illustrated poses with optional calm voice narration." },
  { n: "3", title: "Track gently", body: "Streaks, heatmap, and journal — progress without pressure." },
];

const FAQ = [
  {
    q: "Is Sadhana free?",
    a: "Yes. Sadhana is free and open source. Practise as a guest and everything stays on this device, or create a free account to sync your streak, journal, and sequences across browsers.",
  },
  {
    q: "Do I need an account?",
    a: "No. Accounts are optional. If you make one later, the practice already saved on this device moves across with you.",
  },
  {
    q: "Do I need yoga experience?",
    a: "No. Beginner variations, props cues, and short mood sessions make it easy to start in five minutes.",
  },
  {
    q: "Is it safe in pregnancy?",
    a: "There is a dedicated Pregnancy profile with belly-friendly shapes. Always follow your clinician’s guidance.",
  },
  {
    q: "Can kids use it?",
    a: "Yes — the Kids section uses story poses and breath games, unlocked with a simple parent math gate.",
  },
];

export default function Landing() {
  useDocumentTitle("Welcome · Sadhana");

  useEffect(() => {
    document.title = "Sadhana — Calm guided yoga practice";
  }, []);

  /** Enter the app without bouncing back through WelcomeRedirect. */
  const enterApp = () => writeString(KEYS.welcomeSeen, "1");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#landing-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 pt-3 md:px-6">
          <Link
            href="/welcome"
            className="flex cursor-pointer items-center gap-2 text-primary-foreground drop-shadow-sm"
            aria-label="Sadhana home"
          >
            <LotusMark size={26} />
            <span className="font-serif text-xl font-semibold tracking-tight">Sadhana</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-primary-foreground/85 md:flex" aria-label="Landing">
            <a href="#features" className="transition-colors duration-200 hover:text-primary-foreground">
              Features
            </a>
            <a href="#how" className="transition-colors duration-200 hover:text-primary-foreground">
              How it works
            </a>
            <a href="#faq" className="transition-colors duration-200 hover:text-primary-foreground">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="hidden min-h-11 cursor-pointer text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:inline-flex"
              asChild
            >
              <Link href="/asanas" onClick={enterApp}>
                Browse poses
              </Link>
            </Button>
            <Button
              className="min-h-11 cursor-pointer bg-primary-foreground text-foreground hover:bg-primary-foreground/90"
              asChild
              data-testid="landing-cta-header"
            >
              <Link href="/register">Create practice</Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="landing-main">
        {/* Hero-centric: brand + one headline + support + CTAs on full-bleed yoga visual */}
        <section className="relative min-h-[100svh] overflow-hidden">
          <img
            src={HERO_SRC}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[center_28%] hero-photo-breath"
            width={1200}
            height={1600}
            decoding="async"
            fetchPriority="high"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-[linear-gradient(180deg,hsl(165_28%_8%/0.55)_0%,hsl(165_28%_8%/0.28)_42%,hsl(165_28%_8%/0.78)_100%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,hsl(var(--primary)/0.22),transparent_55%)]"
            aria-hidden
          />

          <div className="relative mx-auto flex min-h-[100svh] max-w-5xl flex-col justify-end px-4 pb-16 pt-28 md:justify-center md:px-6 md:pb-24 md:pt-24">
            <FadeIn className="max-w-xl space-y-5 text-primary-foreground">
              <p
                className="font-serif text-5xl font-semibold tracking-tight md:text-7xl"
                data-testid="landing-brand"
              >
                Sadhana
              </p>
              <h1 className="font-serif text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
                Your daily yoga companion — calm, illustrated, and ready in minutes.
              </h1>
              <p className="max-w-md text-base leading-relaxed text-primary-foreground/85 md:text-lg">
                Free guided practice on this device. No email, no password — just begin.
              </p>
              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  className="min-h-12 cursor-pointer bg-primary-foreground text-foreground hover:bg-primary-foreground/90"
                  asChild
                  data-testid="landing-cta-primary"
                >
                  <Link href="/register">
                    Create your practice <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="min-h-12 cursor-pointer border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  asChild
                >
                  <Link href="/trainer" onClick={enterApp}>
                    <UserRound className="mr-1.5 h-4 w-4" /> Try Yoga Trainer
                  </Link>
                </Button>
              </div>
            </FadeIn>
          </div>
        </section>

        <section id="features" className="relative overflow-hidden yoga-atmosphere">
          <div className="pointer-events-none absolute inset-0 yoga-grain" aria-hidden />
          <div className="relative mx-auto max-w-5xl px-4 py-16 md:px-6 md:py-20">
            <Reveal className="mb-12 max-w-xl space-y-2">
              <h2 className="font-serif text-3xl font-semibold tracking-tight">Built for real practice</h2>
              <p className="text-muted-foreground">
                Everything you need to show up for a few mindful minutes — or a longer journey.
              </p>
            </Reveal>
            <div className="grid gap-10 sm:grid-cols-2">
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <Reveal key={f.title} delay={i * 0.05} className="space-y-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="font-serif text-xl font-semibold">{f.title}</h3>
                    <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <section id="demo" className="border-y border-border/50 bg-card/40">
          <div className="mx-auto max-w-5xl px-4 py-16 md:px-6">
            <Reveal className="mb-8 max-w-xl space-y-2">
              <h2 className="font-serif text-3xl font-semibold tracking-tight">See it in practice</h2>
              <p className="text-muted-foreground">
                A real one-minute walkthrough: answer four questions, flow through a guided voice
                session, then browse pathways, the illustrated pose library, and breathing — light or dark.
              </p>
            </Reveal>
            <Reveal delay={0.06}>
              <Suspense
                fallback={
                  <div className="aspect-video animate-pulse rounded-2xl bg-muted/40" aria-hidden />
                }
              >
                <ProductDemoVideo title="A real walkthrough of the Sadhana app" />
              </Suspense>
            </Reveal>
          </div>
        </section>

        <section id="how" className="yoga-atmosphere">
          <div className="mx-auto max-w-5xl px-4 py-16 md:px-6 md:py-20">
            <h2 className="mb-12 font-serif text-3xl font-semibold tracking-tight">How it works</h2>
            <ol className="grid gap-10 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <Reveal key={s.n} delay={i * 0.06} className="space-y-2">
                  <span className="font-serif text-4xl text-primary/80">{s.n}</span>
                  <h3 className="font-serif text-xl font-semibold">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        <section className="relative overflow-hidden border-y border-border/50">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(var(--primary)/0.14),_transparent_65%)]" aria-hidden />
          <div className="relative mx-auto max-w-5xl px-4 py-16 text-center md:px-6 md:py-20">
            <FadeIn className="mx-auto max-w-lg space-y-4">
              <p className="font-serif text-4xl font-semibold tracking-tight md:text-5xl">Sadhana</p>
              <h2 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">
                Begin your practice today
              </h2>
              <p className="text-muted-foreground">
                A one-minute setup — intent, name, path, and preferences — then Home greets you clearly.
              </p>
              <Button size="lg" className="mt-2 min-h-12 cursor-pointer" asChild data-testid="landing-cta-final">
                <Link href="/register">
                  Create your practice <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </FadeIn>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-5xl px-4 py-16 md:px-6">
          <h2 className="mb-8 font-serif text-3xl font-semibold tracking-tight">FAQ</h2>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group border-b border-border/70 py-3 open:pb-4"
              >
                <summary className="cursor-pointer list-none font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  {item.q}
                </summary>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
          <p>Sadhana — a daily, dedicated practice. MIT open source.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/register" className="cursor-pointer transition-colors duration-200 hover:text-foreground">
              Create practice
            </Link>
            <Link href="/" className="cursor-pointer transition-colors duration-200 hover:text-foreground" onClick={enterApp}>
              App home
            </Link>
            <Link href="/asanas" className="cursor-pointer transition-colors duration-200 hover:text-foreground" onClick={enterApp}>
              Asana library
            </Link>
            <Link href="/privacy" className="cursor-pointer transition-colors duration-200 hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="cursor-pointer transition-colors duration-200 hover:text-foreground">
              Terms
            </Link>
            <Link href="/health-disclaimer" className="cursor-pointer transition-colors duration-200 hover:text-foreground">
              Health disclaimer
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
