import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { KEYS, writeString } from "@/lib/localPrefs";
import {
  ArrowRight,
  BookOpen,
  Compass,
  Heart,
  Play,
  Smile,
  Sparkles,
  UserRound,
  Wind,
} from "lucide-react";

const FEATURES = [
  {
    icon: BookOpen,
    title: "208 illustrated poses",
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
    a: "Yes. Sadhana is free and open source. Practice data stays on your device identity — no account required.",
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
  const [, navigate] = useLocation();

  useEffect(() => {
    document.title = "Sadhana — Calm guided yoga practice";
  }, []);

  const enterApp = () => {
    writeString(KEYS.welcomeSeen, "1");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#landing-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 md:px-6">
          <Link href="/welcome" className="cursor-pointer" aria-label="Sadhana home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm md:flex" aria-label="Landing">
            <a href="#features" className="text-muted-foreground transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how" className="text-muted-foreground transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#faq" className="text-muted-foreground transition-colors hover:text-foreground">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="hidden min-h-11 cursor-pointer sm:inline-flex" asChild>
              <Link href="/asanas">Browse poses</Link>
            </Button>
            <Button className="min-h-11 cursor-pointer" onClick={enterApp} data-testid="landing-cta-header">
              Open app
            </Button>
          </div>
        </div>
      </header>

      <main id="landing-main">
        <section className="relative overflow-hidden border-b border-border/50">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.12),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_hsl(var(--secondary)/0.14),_transparent_50%)]"
            aria-hidden
          />
          <div className="relative mx-auto grid max-w-5xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center md:px-6 md:py-24">
            <div className="space-y-6">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Sādhanā</p>
              <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
                A calm, guided yoga practice — free, illustrated, and ready when you are.
              </h1>
              <p className="max-w-md text-base leading-relaxed text-muted-foreground md:text-lg">
                Pose library, voice-guided sessions, pathways, and kids stories in one quiet companion.
                No account. No pressure. Just practice.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="min-h-12 cursor-pointer" onClick={enterApp} data-testid="landing-cta-primary">
                  Start practicing <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="min-h-12 cursor-pointer" asChild>
                  <Link href="/trainer">
                    <UserRound className="mr-1.5 h-4 w-4" /> Try Yoga Trainer
                  </Link>
                </Button>
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <li className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Guided voice
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5 text-primary" /> Men · Women · Pregnancy
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <Wind className="h-3.5 w-3.5 text-primary" /> Breath + journal
                </li>
              </ul>
            </div>
            <div className="relative mx-auto w-full max-w-md">
              <img
                src={`${import.meta.env.BASE_URL}poses/tadasana.png`}
                alt="Illustrated Mountain Pose from the Sadhana asana library"
                className="w-full rounded-2xl border border-border/60 object-cover shadow-soft-lg"
                width={600}
                height={1200}
              />
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-5xl px-4 py-16 md:px-6">
          <div className="mb-10 max-w-xl space-y-2">
            <h2 className="font-serif text-3xl font-semibold tracking-tight">Built for real practice</h2>
            <p className="text-muted-foreground">
              Everything you need to show up for a few mindful minutes — or a longer journey.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="surface p-5">
                  <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-serif text-xl">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="how" className="border-y border-border/50 bg-card/30">
          <div className="mx-auto max-w-5xl px-4 py-16 md:px-6">
            <h2 className="mb-10 font-serif text-3xl font-semibold tracking-tight">How it works</h2>
            <ol className="grid gap-6 md:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="space-y-2">
                  <span className="font-serif text-4xl text-primary/80">{s.n}</span>
                  <h3 className="font-serif text-xl">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16 md:px-6">
          <div className="surface-banner mx-auto max-w-5xl border-primary/25 p-8 text-center md:p-12">
            <h2 className="font-serif text-3xl font-semibold tracking-tight">Ready when you are</h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Open the app, pick a mood or path, and begin. You can explore the landing page again anytime from Settings.
            </p>
            <Button size="lg" className="mt-6 min-h-12 cursor-pointer" onClick={enterApp} data-testid="landing-cta-final">
              Enter Sadhana <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-5xl px-4 pb-16 md:px-6">
          <h2 className="mb-8 font-serif text-3xl font-semibold tracking-tight">FAQ</h2>
          <div className="space-y-4">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-border/70 bg-card/50 px-4 py-3 open:shadow-soft"
              >
                <summary className="cursor-pointer list-none font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  {item.q}
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
          <p>Sadhana — a daily, dedicated practice. MIT open source.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/" className="hover:text-foreground" onClick={() => writeString(KEYS.welcomeSeen, "1")}>
              App home
            </Link>
            <Link href="/asanas" className="hover:text-foreground">
              Asana library
            </Link>
            <Link href="/profiles" className="hover:text-foreground">
              Profiles
            </Link>
            <Link href="/kids" className="hover:text-foreground">
              Kids
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
